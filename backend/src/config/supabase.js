'use strict';

const { createClient } = require('@supabase/supabase-js');
const config = require('./index');

let cached = null;
let keyChecked = false;

/**
 * Decode a JWT payload without verifying signature. We only use this to read
 * the "role" claim of the configured Supabase key for a one-time sanity check.
 */
function decodeJwtPayload(token) {
  try {
    const parts = String(token).split('.');
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(b64, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * One-time check that SUPABASE_SERVICE_ROLE_KEY is actually a service_role key
 * and not (for example) the anon key pasted into the wrong env var.
 *
 * RLS is enabled on every table in this project. Only the service_role key
 * bypasses RLS — the anon key will silently fail INSERTs on tables like
 * otp_codes (which have a `USING (false)` block policy), producing 201
 * responses with no rows actually written.
 */
function assertServiceRoleKey() {
  if (keyChecked) return;
  keyChecked = true;

  const payload = decodeJwtPayload(config.supabase.serviceRoleKey);
  if (!payload) {
    // eslint-disable-next-line no-console
    console.warn('[supabase] SUPABASE_SERVICE_ROLE_KEY is not a decodable JWT — skipping role check');
    return;
  }
  if (payload.role !== 'service_role') {
    const msg = `[supabase] SUPABASE_SERVICE_ROLE_KEY has role="${payload.role}" but must be "service_role". ` +
      `RLS will block writes (otp_codes, etc.). Copy the SERVICE ROLE key from ` +
      `Supabase Dashboard → Project Settings → API → "service_role" (not "anon").`;
    // eslint-disable-next-line no-console
    console.error(msg);
    throw new Error(msg);
  }
}

/**
 * Returns a Supabase client initialized with the service role key.
 * This client bypasses RLS. NEVER expose it to the browser.
 */
function supabaseAdmin() {
  if (cached) return cached;
  if (!config.supabase.url || !config.supabase.serviceRoleKey) {
    throw new Error('Supabase env vars not configured');
  }
  assertServiceRoleKey();
  cached = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}

module.exports = { supabaseAdmin };