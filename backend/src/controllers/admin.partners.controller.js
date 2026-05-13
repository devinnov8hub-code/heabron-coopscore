'use strict';

const { supabaseAdmin } = require('../config/supabase');
const { ok, created, notFound, paginated, conflict, badRequest } = require('../utils/response');
const { parsePagination } = require('../utils/pagination');
const { logActivity } = require('../utils/activity');
const { generateAutoPassword } = require('../utils/crypto');
const email = require('../services/email');
const config = require('../config');

/**
 * Admin creates a partner organization. The system:
 *   1. Inserts the partner row
 *   2. Generates a strong auto-password
 *   3. Creates the auth.users record + profile + user_roles (partner_admin)
 *   4. Emails the partner with their credentials and a link to sign in
 *   5. Marks must_change_password=true so the partner is forced to change
 *      their password on first login.
 */
async function createPartner(req, res) {
  const sb = supabaseAdmin();
  const { organizationName, organizationEmail, contactPhone, address, state, logoUrl, contactName } = req.body;

  // Check existing
  const { data: existing } = await sb
    .from('partners')
    .select('id')
    .eq('organization_email', organizationEmail)
    .maybeSingle();
  if (existing) return conflict(res, 'Partner with this email already exists');

  // 1. Insert partner
  const { data: partner, error: pErr } = await sb.from('partners').insert({
    organization_name: organizationName,
    organization_email: organizationEmail,
    contact_phone: contactPhone,
    address,
    state,
    logo_url: logoUrl,
    created_by_admin_id: req.user.userId,
  }).select().single();
  if (pErr) throw pErr;

  // 2. Generate password
  const autoPassword = generateAutoPassword();

  // 3. Create auth user
  const { data: userData, error: uErr } = await sb.auth.admin.createUser({
    email: organizationEmail,
    password: autoPassword,
    email_confirm: true,
    user_metadata: { full_name: contactName || organizationName, role: 'partner_admin', partner_id: partner.id },
  });
  if (uErr) {
    await sb.from('partners').delete().eq('id', partner.id);
    return badRequest(res, `Could not create partner login: ${uErr.message}`);
  }
  const userId = userData.user.id;

  // Update profile (trigger inserts a default; we override fields)
  await sb.from('profiles').update({
    full_name: contactName || organizationName,
    email: organizationEmail,
    phone: contactPhone,
    status: 'active',
    must_change_password: true,
  }).eq('user_id', userId);

  // Replace default field_agent role with partner_admin
  await sb.from('user_roles').delete().eq('user_id', userId);
  await sb.from('user_roles').insert({ user_id: userId, role: 'partner_admin', partner_id: partner.id });

  // 4. Email credentials
  email.safe(email.sendPartnerCreated)(organizationEmail, {
    organizationName,
    contactName: contactName || organizationName,
    email: organizationEmail,
    autoPassword,
    loginUrl: `${config.publicAppUrl}/partner/login`,
  });

  await logActivity({ actor: req.user, action: 'partner_created', entityType: 'partner', entityId: partner.id, metadata: { organizationName }, req });
  return created(res, { partner, loginUserId: userId });
}

async function listPartners(req, res) {
  const sb = supabaseAdmin();
  const { page, pageSize, from, to } = parsePagination(req.query);
  const { search, status } = req.query;
  let q = sb.from('partners').select('*', { count: 'exact' });
  if (search) q = q.ilike('organization_name', `%${search}%`);
  if (status) q = q.eq('status', status);
  q = q.order('created_at', { ascending: false }).range(from, to);
  const { data, count, error } = await q;
  if (error) throw error;
  return paginated(res, data || [], { page, pageSize, total: count || 0 });
}

async function getPartner(req, res) {
  const sb = supabaseAdmin();
  const { data } = await sb.from('partners').select('*').eq('id', req.params.partnerId).maybeSingle();
  if (!data) return notFound(res);

  // Count users + financing
  const [{ count: userCount }, financing] = await Promise.all([
    sb.from('user_roles').select('user_id', { count: 'exact', head: true }).eq('partner_id', req.params.partnerId),
    sb.from('financing_requests').select('id, partner_decision, loan_amount').eq('forwarded_to_partner_id', req.params.partnerId),
  ]);

  const totals = { pending: 0, approved: 0, rejected: 0, totalAmount: 0 };
  for (const r of financing.data || []) {
    if (r.partner_decision === 'approved') {
      totals.approved += 1;
      totals.totalAmount += Number(r.loan_amount || 0);
    } else if (r.partner_decision === 'rejected') totals.rejected += 1;
    else totals.pending += 1;
  }

  return ok(res, { ...data, stats: { users: userCount || 0, financing: totals } });
}

async function updatePartner(req, res) {
  const sb = supabaseAdmin();
  const patch = {};
  if (req.body.organizationName !== undefined) patch.organization_name = req.body.organizationName;
  if (req.body.contactPhone !== undefined) patch.contact_phone = req.body.contactPhone;
  if (req.body.address !== undefined) patch.address = req.body.address;
  if (req.body.state !== undefined) patch.state = req.body.state;
  if (req.body.logoUrl !== undefined) patch.logo_url = req.body.logoUrl;
  const { data, error } = await sb.from('partners').update(patch).eq('id', req.params.partnerId).select().single();
  if (error) throw error;
  await logActivity({ actor: req.user, action: 'partner_updated', entityType: 'partner', entityId: data.id, req });
  return ok(res, data);
}

async function suspendPartner(req, res) {
  const sb = supabaseAdmin();
  await sb.from('partners').update({ status: 'suspended' }).eq('id', req.params.partnerId);
  await logActivity({ actor: req.user, action: 'partner_suspended', entityType: 'partner', entityId: req.params.partnerId, req });
  return ok(res, { suspended: true });
}

async function reactivatePartner(req, res) {
  const sb = supabaseAdmin();
  await sb.from('partners').update({ status: 'active' }).eq('id', req.params.partnerId);
  await logActivity({ actor: req.user, action: 'partner_reactivated', entityType: 'partner', entityId: req.params.partnerId, req });
  return ok(res, { reactivated: true });
}

async function resetPartnerPassword(req, res) {
  const sb = supabaseAdmin();
  const { data: partner } = await sb.from('partners').select('*').eq('id', req.params.partnerId).maybeSingle();
  if (!partner) return notFound(res);

  const { data: roles } = await sb.from('user_roles').select('user_id, profiles(email, full_name)').eq('partner_id', partner.id).eq('role', 'partner_admin');
  if (!roles?.length) return notFound(res, 'No partner admin user linked');
  const primary = roles[0];

  const newPassword = generateAutoPassword();
  await sb.auth.admin.updateUserById(primary.user_id, { password: newPassword });
  await sb.from('profiles').update({ must_change_password: true }).eq('user_id', primary.user_id);

  email.safe(email.sendPartnerPasswordReset)(primary.profiles.email, {
    organizationName: partner.organization_name,
    contactName: primary.profiles.full_name,
    newPassword,
    loginUrl: `${config.publicAppUrl}/partner/login`,
  });

  await logActivity({ actor: req.user, action: 'partner_password_reset', entityType: 'partner', entityId: partner.id, req });
  return ok(res, { reset: true });
}

module.exports = {
  createPartner,
  listPartners,
  getPartner,
  updatePartner,
  suspendPartner,
  reactivatePartner,
  resetPartnerPassword,
};
