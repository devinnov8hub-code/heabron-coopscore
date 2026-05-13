'use strict';

const config = require('../../config');
const { baseTemplate, button, infoBox, warningBox, dangerBox, code } = require('./_base');

const { brand, publicAppUrl } = config;

// ============================================================================
// 1. OTP — signup / password reset
// ============================================================================
function otp({ fullName, otpCode, purpose }) {
  const title = purpose === 'signup' ? 'Verify your email' : 'Reset your password';
  const intro =
    purpose === 'signup'
      ? `Welcome to ${brand.name}. Use the code below to confirm your email and finish creating your field agent account.`
      : `We received a request to reset the password on your ${brand.name} account. Enter this code in the app to continue.`;

  return {
    subject: purpose === 'signup' ? `Your ${brand.name} verification code` : `Reset your ${brand.name} password`,
    html: baseTemplate({
      title,
      preheader: `Your verification code is ${otpCode}`,
      bodyHtml: `
        <h2 style="margin:0 0 8px 0;color:#1F2A24;font-size:22px;">${title}</h2>
        <p style="margin:0 0 16px 0;color:#3D4842;line-height:1.6;">Hi ${fullName || 'there'},</p>
        <p style="margin:0 0 8px 0;color:#3D4842;line-height:1.6;">${intro}</p>
        ${code(otpCode)}
        ${warningBox(`This code expires in <strong>10 minutes</strong>. If you didn't request it, you can safely ignore this email.`)}
      `,
    }),
  };
}

// ============================================================================
// 2. Field agent application submitted
// ============================================================================
function agentApplicationSubmitted({ fullName }) {
  return {
    subject: `We received your ${brand.name} application`,
    html: baseTemplate({
      title: 'Application received',
      preheader: 'Your field agent application is under review',
      bodyHtml: `
        <h2 style="margin:0 0 8px 0;color:#1F2A24;font-size:22px;">Thanks, ${fullName} — we've got your application</h2>
        <p style="margin:0 0 16px 0;color:#3D4842;line-height:1.6;">Your field agent application has been received and is being reviewed by our team.</p>
        ${infoBox(`
          <strong>What happens next?</strong><br />
          Our team reviews your identity documents and selfie. This usually takes <strong>24 – 48 hours</strong>. You'll get another email the moment a decision is made.
        `)}
        <p style="margin:16px 0 0 0;color:#3D4842;line-height:1.6;">While you wait, you can sign in to view your application status.</p>
      `,
    }),
  };
}

// ============================================================================
// 3. Field agent approved
// ============================================================================
function agentApproved({ fullName }) {
  return {
    subject: `🎉 You're approved — welcome to ${brand.name}`,
    html: baseTemplate({
      title: 'Agent application approved',
      preheader: 'Your field agent account is now active',
      bodyHtml: `
        <h2 style="margin:0 0 8px 0;color:#1F2A24;font-size:22px;">Welcome aboard, ${fullName}</h2>
        <p style="margin:0 0 16px 0;color:#3D4842;line-height:1.6;">Your application has been approved. Your ${brand.name} field agent account is now <strong>active</strong> — you can start onboarding cooperatives and farmers right away.</p>
        ${button('Open the app', publicAppUrl)}
        ${infoBox(`
          <strong>Quick start</strong><br />
          1. Sign in with the email + password you registered<br />
          2. Create your first cooperative<br />
          3. Add farmers and log deliveries<br />
          4. Track financing requests and repayments
        `)}
      `,
    }),
  };
}

// ============================================================================
// 4. Field agent rejected
// ============================================================================
function agentRejected({ fullName, reason }) {
  return {
    subject: `${brand.name} application update`,
    html: baseTemplate({
      title: 'Application update',
      preheader: 'A decision has been made on your application',
      bodyHtml: `
        <h2 style="margin:0 0 8px 0;color:#1F2A24;font-size:22px;">Hi ${fullName}</h2>
        <p style="margin:0 0 16px 0;color:#3D4842;line-height:1.6;">After reviewing your application, we're unable to approve your ${brand.name} field agent account at this time.</p>
        ${reason ? dangerBox(`<strong>Reason:</strong><br />${reason}`) : ''}
        <p style="margin:16px 0;color:#3D4842;line-height:1.6;">If you believe this is a mistake, or you'd like to provide additional information, please reach out to <a href="mailto:${brand.supportEmail}" style="color:${brand.primary};">${brand.supportEmail}</a>.</p>
      `,
    }),
  };
}

// ============================================================================
// 5. Agent suspended
// ============================================================================
function agentSuspended({ fullName, reason }) {
  return {
    subject: `${brand.name} account suspended`,
    html: baseTemplate({
      title: 'Account suspended',
      preheader: 'Your field agent access has been temporarily suspended',
      bodyHtml: `
        <h2 style="margin:0 0 8px 0;color:#1F2A24;font-size:22px;">Hi ${fullName}</h2>
        <p style="margin:0 0 16px 0;color:#3D4842;line-height:1.6;">Your ${brand.name} field agent account has been <strong>suspended</strong> by an administrator. You won't be able to sign in or submit data until this is resolved.</p>
        ${reason ? dangerBox(`<strong>Reason:</strong><br />${reason}`) : ''}
        <p style="margin:16px 0;color:#3D4842;line-height:1.6;">For assistance, contact <a href="mailto:${brand.supportEmail}" style="color:${brand.primary};">${brand.supportEmail}</a>.</p>
      `,
    }),
  };
}

// ============================================================================
// 6. Partner account created (auto-password)
// ============================================================================
function partnerCreated({ organizationName, contactName, email, autoPassword, loginUrl }) {
  return {
    subject: `Welcome to ${brand.name} — your organization account is ready`,
    html: baseTemplate({
      title: 'Your partner portal is ready',
      preheader: `Sign-in details for ${organizationName}`,
      bodyHtml: `
        <h2 style="margin:0 0 8px 0;color:#1F2A24;font-size:22px;">Welcome, ${contactName || organizationName}</h2>
        <p style="margin:0 0 16px 0;color:#3D4842;line-height:1.6;">An administrator at ${brand.name} has set up a partner portal account for <strong>${organizationName}</strong>. Use the credentials below to sign in.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F4EE;border:1px solid #E5E2D6;border-radius:10px;margin:16px 0;">
          <tr>
            <td style="padding:18px 20px;">
              <p style="margin:0 0 6px 0;color:#6B7370;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Email</p>
              <p style="margin:0 0 14px 0;color:#1F2A24;font-size:15px;font-weight:600;">${email}</p>
              <p style="margin:0 0 6px 0;color:#6B7370;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Temporary password</p>
              <p style="margin:0;color:#1F2A24;font-size:18px;font-weight:700;font-family:'JetBrains Mono','Courier New',monospace;letter-spacing:1px;">${autoPassword}</p>
            </td>
          </tr>
        </table>
        ${button('Sign in to the partner portal', loginUrl)}
        ${warningBox(`<strong>Action required.</strong> For your security, you'll be asked to change this password the first time you sign in. Don't share these credentials with anyone outside your organization.`)}
      `,
    }),
  };
}

// ============================================================================
// 7. Partner password reset by admin
// ============================================================================
function partnerPasswordReset({ organizationName, contactName, newPassword, loginUrl }) {
  return {
    subject: `Your ${brand.name} partner password was reset`,
    html: baseTemplate({
      title: 'Password reset',
      preheader: 'An admin reset your partner portal password',
      bodyHtml: `
        <h2 style="margin:0 0 8px 0;color:#1F2A24;font-size:22px;">Password reset</h2>
        <p style="margin:0 0 16px 0;color:#3D4842;line-height:1.6;">Hi ${contactName || organizationName}, an administrator has reset the password on your ${brand.name} partner portal account.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F4EE;border:1px solid #E5E2D6;border-radius:10px;margin:16px 0;">
          <tr>
            <td style="padding:18px 20px;">
              <p style="margin:0 0 6px 0;color:#6B7370;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">New temporary password</p>
              <p style="margin:0;color:#1F2A24;font-size:18px;font-weight:700;font-family:'JetBrains Mono','Courier New',monospace;letter-spacing:1px;">${newPassword}</p>
            </td>
          </tr>
        </table>
        ${button('Sign in', loginUrl)}
        ${warningBox(`You'll be asked to choose a new password as soon as you sign in.`)}
      `,
    }),
  };
}

// ============================================================================
// 8. Financing request submitted (admin notification)
// ============================================================================
function financingSubmittedToAdmin({ adminName, cooperativeName, farmerName, amount, agentName }) {
  return {
    subject: `New financing request: ${cooperativeName}`,
    html: baseTemplate({
      title: 'New financing request',
      preheader: `${cooperativeName} requested ₦${Number(amount).toLocaleString()}`,
      bodyHtml: `
        <h2 style="margin:0 0 8px 0;color:#1F2A24;font-size:22px;">New financing request</h2>
        <p style="margin:0 0 16px 0;color:#3D4842;line-height:1.6;">${adminName ? `Hi ${adminName}, a` : 'A'} field agent has submitted a new financing request for review.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F4EE;border:1px solid #E5E2D6;border-radius:10px;margin:16px 0;">
          <tr><td style="padding:16px 20px;">
            <p style="margin:0;color:#6B7370;font-size:12px;">COOPERATIVE</p><p style="margin:2px 0 10px 0;font-weight:600;">${cooperativeName}</p>
            ${farmerName ? `<p style="margin:0;color:#6B7370;font-size:12px;">FARMER</p><p style="margin:2px 0 10px 0;font-weight:600;">${farmerName}</p>` : ''}
            <p style="margin:0;color:#6B7370;font-size:12px;">AMOUNT</p><p style="margin:2px 0 10px 0;font-weight:600;">₦${Number(amount).toLocaleString()}</p>
            <p style="margin:0;color:#6B7370;font-size:12px;">SUBMITTED BY</p><p style="margin:2px 0 0 0;font-weight:600;">${agentName}</p>
          </td></tr>
        </table>
        ${button('Review request', `${publicAppUrl}/admin/financing`)}
      `,
    }),
  };
}

// ============================================================================
// 9. Financing forwarded to partner
// ============================================================================
function financingForwardedToPartner({ partnerName, cooperativeName, amount, cooperativeTier, dashboardUrl }) {
  return {
    subject: `Financing request forwarded to ${partnerName}`,
    html: baseTemplate({
      title: 'Financing request for your review',
      preheader: `${cooperativeName} — ₦${Number(amount).toLocaleString()}`,
      bodyHtml: `
        <h2 style="margin:0 0 8px 0;color:#1F2A24;font-size:22px;">A new financing request needs your decision</h2>
        <p style="margin:0 0 16px 0;color:#3D4842;line-height:1.6;">${brand.name} has forwarded a financing request to <strong>${partnerName}</strong>.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F4EE;border:1px solid #E5E2D6;border-radius:10px;margin:16px 0;">
          <tr><td style="padding:16px 20px;">
            <p style="margin:0;color:#6B7370;font-size:12px;">COOPERATIVE</p><p style="margin:2px 0 10px 0;font-weight:600;">${cooperativeName}</p>
            <p style="margin:0;color:#6B7370;font-size:12px;">AMOUNT REQUESTED</p><p style="margin:2px 0 10px 0;font-weight:600;">₦${Number(amount).toLocaleString()}</p>
            <p style="margin:0;color:#6B7370;font-size:12px;">COOPSCORE TIER</p><p style="margin:2px 0 0 0;font-weight:600;">${cooperativeTier || 'Pending'}</p>
          </td></tr>
        </table>
        ${button('View in portal', dashboardUrl)}
      `,
    }),
  };
}

// ============================================================================
// 10. Financing approved (notify agent + farmer when contact available)
// ============================================================================
function financingApproved({ recipientName, cooperativeName, amount, dueDate }) {
  return {
    subject: `Financing approved: ${cooperativeName}`,
    html: baseTemplate({
      title: 'Financing approved',
      preheader: `₦${Number(amount).toLocaleString()} approved`,
      bodyHtml: `
        <h2 style="margin:0 0 8px 0;color:#1F2A24;font-size:22px;">Good news, ${recipientName}</h2>
        <p style="margin:0 0 16px 0;color:#3D4842;line-height:1.6;">The financing request for <strong>${cooperativeName}</strong> has been <strong>approved</strong>.</p>
        ${infoBox(`
          <strong>Approved amount:</strong> ₦${Number(amount).toLocaleString()}<br />
          ${dueDate ? `<strong>Repayment due:</strong> ${new Date(dueDate).toLocaleDateString()}` : ''}
        `)}
        ${button('View details', `${publicAppUrl}/financing`)}
      `,
    }),
  };
}

// ============================================================================
// 11. Financing rejected
// ============================================================================
function financingRejected({ recipientName, cooperativeName, amount, reason }) {
  return {
    subject: `Financing request rejected: ${cooperativeName}`,
    html: baseTemplate({
      title: 'Financing rejected',
      preheader: `Your request for ${cooperativeName} was not approved`,
      bodyHtml: `
        <h2 style="margin:0 0 8px 0;color:#1F2A24;font-size:22px;">Hi ${recipientName}</h2>
        <p style="margin:0 0 16px 0;color:#3D4842;line-height:1.6;">The financing request for <strong>${cooperativeName}</strong> (₦${Number(amount).toLocaleString()}) has been <strong>rejected</strong>.</p>
        ${reason ? dangerBox(`<strong>Reason:</strong><br />${reason}`) : ''}
        <p style="margin:16px 0;color:#3D4842;line-height:1.6;">You can submit a revised request after addressing the reason above.</p>
      `,
    }),
  };
}

// ============================================================================
// 12. Financing disbursed
// ============================================================================
function financingDisbursed({ recipientName, cooperativeName, amount, dueDate }) {
  return {
    subject: `Financing disbursed: ${cooperativeName}`,
    html: baseTemplate({
      title: 'Financing disbursed',
      preheader: `₦${Number(amount).toLocaleString()} has been disbursed`,
      bodyHtml: `
        <h2 style="margin:0 0 8px 0;color:#1F2A24;font-size:22px;">Funds disbursed</h2>
        <p style="margin:0 0 16px 0;color:#3D4842;line-height:1.6;">Hi ${recipientName}, the approved financing for <strong>${cooperativeName}</strong> has been disbursed.</p>
        ${infoBox(`
          <strong>Disbursed amount:</strong> ₦${Number(amount).toLocaleString()}<br />
          ${dueDate ? `<strong>Repayment due:</strong> ${new Date(dueDate).toLocaleDateString()}` : ''}
        `)}
      `,
    }),
  };
}

// ============================================================================
// 13. Repayment recorded
// ============================================================================
function repaymentRecorded({ recipientName, farmerName, amount, outstandingBalance }) {
  return {
    subject: `Repayment recorded for ${farmerName}`,
    html: baseTemplate({
      title: 'Repayment recorded',
      preheader: `₦${Number(amount).toLocaleString()} from ${farmerName}`,
      bodyHtml: `
        <h2 style="margin:0 0 8px 0;color:#1F2A24;font-size:22px;">Repayment recorded</h2>
        <p style="margin:0 0 16px 0;color:#3D4842;line-height:1.6;">Hi ${recipientName}, a repayment from <strong>${farmerName}</strong> has been logged.</p>
        ${infoBox(`
          <strong>Amount paid:</strong> ₦${Number(amount).toLocaleString()}<br />
          ${outstandingBalance != null ? `<strong>Outstanding balance:</strong> ₦${Number(outstandingBalance).toLocaleString()}` : ''}
        `)}
      `,
    }),
  };
}

// ============================================================================
// 14. Settlement requested (admin)
// ============================================================================
function settlementRequested({ adminName, agentName, amount }) {
  return {
    subject: `Settlement request: ${agentName}`,
    html: baseTemplate({
      title: 'Settlement request',
      preheader: `${agentName} requested ₦${Number(amount).toLocaleString()}`,
      bodyHtml: `
        <h2 style="margin:0 0 8px 0;color:#1F2A24;font-size:22px;">New settlement request</h2>
        <p style="margin:0 0 16px 0;color:#3D4842;line-height:1.6;">${adminName ? `Hi ${adminName}, agent` : 'Agent'} <strong>${agentName}</strong> has requested a settlement of <strong>₦${Number(amount).toLocaleString()}</strong>.</p>
        ${button('Review settlement', `${publicAppUrl}/admin/wallet-management`)}
      `,
    }),
  };
}

// ============================================================================
// 15. Settlement approved
// ============================================================================
function settlementApproved({ recipientName, amount }) {
  return {
    subject: `Settlement approved`,
    html: baseTemplate({
      title: 'Settlement approved',
      preheader: `Your settlement of ₦${Number(amount).toLocaleString()} was approved`,
      bodyHtml: `
        <h2 style="margin:0 0 8px 0;color:#1F2A24;font-size:22px;">Settlement approved</h2>
        <p style="margin:0 0 16px 0;color:#3D4842;line-height:1.6;">Hi ${recipientName}, your settlement request for <strong>₦${Number(amount).toLocaleString()}</strong> has been approved and is being processed to your bank account.</p>
      `,
    }),
  };
}

// ============================================================================
// 16. Credit score updated (low-tier alert to admin)
// ============================================================================
function creditScoreAlert({ adminName, cooperativeName, oldScore, newScore, tier }) {
  return {
    subject: `Credit score alert: ${cooperativeName}`,
    html: baseTemplate({
      title: 'Credit score alert',
      preheader: `${cooperativeName} moved to Tier ${tier}`,
      bodyHtml: `
        <h2 style="margin:0 0 8px 0;color:#1F2A24;font-size:22px;">Credit score change</h2>
        <p style="margin:0 0 16px 0;color:#3D4842;line-height:1.6;">${adminName ? `Hi ${adminName}, the` : 'The'} credit score for <strong>${cooperativeName}</strong> has changed.</p>
        ${warningBox(`
          <strong>Previous score:</strong> ${oldScore}<br />
          <strong>New score:</strong> ${newScore}<br />
          <strong>New tier:</strong> ${tier}
        `)}
      `,
    }),
  };
}

module.exports = {
  otp,
  agentApplicationSubmitted,
  agentApproved,
  agentRejected,
  agentSuspended,
  partnerCreated,
  partnerPasswordReset,
  financingSubmittedToAdmin,
  financingForwardedToPartner,
  financingApproved,
  financingRejected,
  financingDisbursed,
  repaymentRecorded,
  settlementRequested,
  settlementApproved,
  creditScoreAlert,
};
