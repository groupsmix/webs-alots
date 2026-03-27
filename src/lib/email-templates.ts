/**
 * Email templates for transactional notifications.
 *
 * All templates return { subject, html } ready to pass to sendEmail().
 */

import { escapeHtml } from "@/lib/escape-html";

function wrap(brandName: string, subject: string, bodyHtml: string): { subject: string; html: string } {
  const safeBrand = escapeHtml(brandName);
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;">
    <tr>
      <td style="padding:24px 32px;background:#0f172a;color:#ffffff;">
        <h1 style="margin:0;font-size:20px;font-weight:600;">${safeBrand}</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        ${bodyHtml}
      </td>
    </tr>
    <tr>
      <td style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
        <p style="margin:0;font-size:12px;color:#94a3b8;">
          ${safeBrand} &mdash; Healthcare Management Platform
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
  return { subject, html };
}

// ---------- Staff onboarding ----------

export function staffWelcomeEmail(params: {
  staffName: string;
  clinicName: string;
  email: string;
  loginUrl: string;
  role: string;
}): { subject: string; html: string } {
  const { staffName, clinicName, email, loginUrl, role } = params;
  const body = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#1e293b;">Welcome to ${escapeHtml(clinicName)}</h2>
    <p style="font-size:14px;line-height:1.6;color:#475569;">
      Hello ${escapeHtml(staffName)},
    </p>
    <p style="font-size:14px;line-height:1.6;color:#475569;">
      Your account has been created as <strong>${escapeHtml(role)}</strong> for ${escapeHtml(clinicName)}.
    </p>
    <p style="font-size:14px;line-height:1.6;color:#475569;">
      <strong>Email:</strong> ${escapeHtml(email)}<br/>
      Please use the button below to set your password and log in.
    </p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${escapeHtml(loginUrl)}" style="display:inline-block;padding:12px 32px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">
        Set Up Your Password
      </a>
    </div>
    <p style="font-size:12px;color:#94a3b8;">
      If you did not expect this email, please ignore it.
    </p>`;
  return wrap(clinicName, `Welcome to ${clinicName} — Set Up Your Account`, body);
}

// ---------- Clinic created notification ----------

export function clinicCreatedEmail(params: {
  clinicName: string;
  adminName: string;
  adminEmail: string;
  loginUrl: string;
}): { subject: string; html: string } {
  const { clinicName, adminName, adminEmail, loginUrl } = params;
  const body = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#1e293b;">Your Clinic Has Been Set Up</h2>
    <p style="font-size:14px;line-height:1.6;color:#475569;">
      Hello ${escapeHtml(adminName)},
    </p>
    <p style="font-size:14px;line-height:1.6;color:#475569;">
      Your clinic <strong>${escapeHtml(clinicName)}</strong> is now active on our platform.
    </p>
    <p style="font-size:14px;line-height:1.6;color:#475569;">
      <strong>Login Email:</strong> ${escapeHtml(adminEmail)}<br/>
      Please set your password using the button below.
    </p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${escapeHtml(loginUrl)}" style="display:inline-block;padding:12px 32px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">
        Set Up Your Account
      </a>
    </div>
    <p style="font-size:14px;line-height:1.6;color:#475569;">
      You can customize your clinic&apos;s branding, colors, and content from <strong>Admin &rarr; Branding</strong>.
    </p>`;
  return wrap("Oltigo", `Your Clinic "${clinicName}" Is Ready`, body);
}

// ---------- Clinic suspended notification ----------

export function clinicSuspendedEmail(params: {
  clinicName: string;
  adminName: string;
  reason?: string;
}): { subject: string; html: string } {
  const { clinicName, adminName, reason } = params;
  const body = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#dc2626;">Clinic Suspended</h2>
    <p style="font-size:14px;line-height:1.6;color:#475569;">
      Hello ${escapeHtml(adminName)},
    </p>
    <p style="font-size:14px;line-height:1.6;color:#475569;">
      Your clinic <strong>${escapeHtml(clinicName)}</strong> has been suspended.
      ${reason ? `Reason: ${escapeHtml(reason)}` : ""}
    </p>
    <p style="font-size:14px;line-height:1.6;color:#475569;">
      Access to all features has been temporarily disabled. Please contact support for more information.
    </p>`;
  return wrap("Oltigo", `Clinic "${clinicName}" Has Been Suspended`, body);
}

// ---------- Clinic reactivated notification ----------

export function clinicActivatedEmail(params: {
  clinicName: string;
  adminName: string;
}): { subject: string; html: string } {
  const { clinicName, adminName } = params;
  const body = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#16a34a;">Clinic Reactivated</h2>
    <p style="font-size:14px;line-height:1.6;color:#475569;">
      Hello ${escapeHtml(adminName)},
    </p>
    <p style="font-size:14px;line-height:1.6;color:#475569;">
      Your clinic <strong>${escapeHtml(clinicName)}</strong> has been reactivated.
      You now have full access to all features again.
    </p>`;
  return wrap("Oltigo", `Clinic "${clinicName}" Has Been Reactivated`, body);
}

// ---------- Payment failure notification ----------

export function paymentFailedEmail(params: {
  clinicName: string;
  recipientName: string;
  amount: number;
  currency: string;
}): { subject: string; html: string } {
  const { clinicName, recipientName, amount, currency } = params;
  const body = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#dc2626;">Payment Failed</h2>
    <p style="font-size:14px;line-height:1.6;color:#475569;">
      Hello ${escapeHtml(recipientName)},
    </p>
    <p style="font-size:14px;line-height:1.6;color:#475569;">
      A payment of <strong>${amount.toLocaleString()} ${escapeHtml(currency)}</strong> for clinic
      <strong>${escapeHtml(clinicName)}</strong> has failed.
    </p>
    <p style="font-size:14px;line-height:1.6;color:#475569;">
      Please update the payment method or contact support.
    </p>`;
  return wrap("Oltigo", `Payment Failed for ${clinicName}`, body);
}
