'use strict';

const config = require('../../config');

/**
 * Base HTML email skeleton. Inline CSS only — Gmail/Outlook strip <style>.
 * Branded with the Heabron forest-green + harvest-gold palette to match
 * the rest of the platform.
 */
function baseTemplate({ title, preheader = '', bodyHtml }) {
  const { brand } = config;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#F5F4EE;font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1F2A24;-webkit-font-smoothing:antialiased;">
    <span style="display:none;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${preheader}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F4EE;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(31,42,36,0.06);">
            <!-- Header -->
            <tr>
              <td style="background:linear-gradient(135deg,${brand.primary} 0%,#3A8A5E 100%);padding:28px 32px;text-align:left;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td>
                      <img src="${brand.logoUrl}" alt="${brand.name}" width="120" style="display:block;max-width:120px;height:auto;" />
                    </td>
                    <td align="right" style="color:#FFFFFF;font-size:13px;letter-spacing:0.4px;">
                      ${brand.name}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:36px 32px;">
                ${bodyHtml}
              </td>
            </tr>

            <!-- Divider -->
            <tr>
              <td style="padding:0 32px;">
                <hr style="border:none;border-top:1px solid #E5E2D6;margin:0;" />
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:24px 32px 32px;color:#6B7370;font-size:12px;line-height:1.6;">
                <p style="margin:0 0 8px 0;">
                  This message was sent by ${brand.name}.<br />
                  Questions? <a href="mailto:${brand.supportEmail}" style="color:${brand.primary};text-decoration:none;">${brand.supportEmail}</a> · <a href="${brand.website}" style="color:${brand.primary};text-decoration:none;">${brand.website}</a>
                </p>
                <p style="margin:8px 0 0 0;color:#9AA0A6;font-size:11px;">
                  © ${new Date().getFullYear()} Heabron Farm Limited. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function button(label, href) {
  const { brand } = config;
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr>
      <td style="border-radius:10px;background:${brand.primary};">
        <a href="${href}" style="display:inline-block;padding:13px 28px;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:15px;border-radius:10px;">${label}</a>
      </td>
    </tr>
  </table>`;
}

function infoBox(html) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EFF6F1;border:1px solid #D9E8DE;border-radius:10px;margin:16px 0;">
    <tr><td style="padding:16px 18px;color:#1F4D33;font-size:14px;line-height:1.55;">${html}</td></tr>
  </table>`;
}

function warningBox(html) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FEF3D1;border:1px solid #F2D689;border-radius:10px;margin:16px 0;">
    <tr><td style="padding:16px 18px;color:#5C4A0F;font-size:14px;line-height:1.55;">${html}</td></tr>
  </table>`;
}

function dangerBox(html) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FDECEC;border:1px solid #F4BFBF;border-radius:10px;margin:16px 0;">
    <tr><td style="padding:16px 18px;color:#7A1B1B;font-size:14px;line-height:1.55;">${html}</td></tr>
  </table>`;
}

function code(text) {
  return `<div style="font-family:'JetBrains Mono','Courier New',monospace;font-size:24px;letter-spacing:6px;font-weight:700;color:${config.brand.primary};background:#F5F4EE;border:1px dashed #D6D3C2;padding:18px;text-align:center;border-radius:10px;margin:20px 0;">${text}</div>`;
}

module.exports = { baseTemplate, button, infoBox, warningBox, dangerBox, code };
