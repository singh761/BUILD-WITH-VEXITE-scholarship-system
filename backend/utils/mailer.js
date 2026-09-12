// mailer.js — sends real email notifications via Gmail/SMTP using Nodemailer.
// If SMTP isn't configured, emails are skipped (logged, not thrown) so the
// rest of the app keeps working without it.
const nodemailer = require("nodemailer");

const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const FROM_NAME = process.env.SMTP_FROM_NAME || "Adivasi Shiksha Setu";

const isConfigured = Boolean(SMTP_USER && SMTP_PASS);

let transporter = null;
if (isConfigured) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465, // true for 465 (SSL), false for 587 (STARTTLS)
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

/**
 * Sends an email. Never throws — logs and resolves false on failure so a
 * flaky mail server can't break an application/officer action.
 */
async function sendMail({ to, subject, html, text }) {
  if (!isConfigured) {
    console.log(`[mailer] Skipped "${subject}" to ${to} — SMTP_USER/SMTP_PASS not set.`);
    return false;
  }
  try {
    await transporter.sendMail({
      from: `"${FROM_NAME}" <${SMTP_USER}>`,
      to,
      subject,
      text: text || html.replace(/<[^>]+>/g, ""),
      html,
    });
    return true;
  } catch (err) {
    console.error(`[mailer] Failed to send "${subject}" to ${to}:`, err.message);
    return false;
  }
}

const STATUS_COPY = {
  submitted: { subject: "Application received", line: "We've received your scholarship application." },
  under_review: { subject: "Application under AI review", line: "Your documents are being verified." },
  institute_verified: { subject: "Institute verified your application", line: "Your institute has confirmed your enrollment details." },
  escalated: { subject: "Application escalated for faster action", line: "Your application was pending too long, so it has been escalated to the District Tribal Welfare Officer for priority handling." },
  approved: { subject: "Application approved 🎉", line: "Your scholarship application has been approved." },
  rejected: { subject: "Update on your application", line: "Your application was reviewed and could not be approved at this time." },
  disbursed: { subject: "Funds disbursed", line: "Your scholarship amount has been transferred." },
};

function wrap(bodyHtml) {
  return `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#262421;">
    <div style="background:#1E3A2F;color:#fff;padding:16px 24px;border-bottom:3px solid #C98A2C;">
      <strong>Adivasi Shiksha Setu</strong><br/>
      <span style="font-size:12px;opacity:0.85;">ST Scholarship &amp; Fellowship System</span>
    </div>
    <div style="padding:24px;">${bodyHtml}</div>
    <div style="padding:16px 24px;color:#888;font-size:12px;">This is an automated message — please don't reply directly to this email.</div>
  </div>`;
}

async function sendApplicationStatusEmail({ to, studentName, scheme, instituteName, status, note, amount }) {
  const copy = STATUS_COPY[status] || { subject: "Application update", line: `Status changed to ${status}.` };
  const amountLine = amount ? `<p><strong>Amount:</strong> ₹${Number(amount).toLocaleString("en-IN")}</p>` : "";
  const noteLine = note ? `<p style="color:#57534A;font-size:14px;">${note}</p>` : "";

  return sendMail({
    to,
    subject: `${copy.subject} — ${scheme}`,
    html: wrap(`
      <p>Hi ${studentName},</p>
      <p>${copy.line}</p>
      <p><strong>Scheme:</strong> ${scheme}<br/><strong>Institute:</strong> ${instituteName}</p>
      ${amountLine}
      ${noteLine}
      <p>You can check full details anytime by signing in to your dashboard.</p>
    `),
  });
}

async function sendGrievanceAckEmail({ to, studentName, priority }) {
  return sendMail({
    to,
    subject: priority === "High" ? "Grievance received — marked urgent" : "Grievance received",
    html: wrap(`
      <p>Hi ${studentName},</p>
      <p>We've logged your grievance${priority === "High" ? ", and flagged it as <strong>high priority</strong> for same-day attention." : "."}</p>
      <p>A welfare officer will follow up. You can track its status from the Grievances page.</p>
    `),
  });
}

async function sendGrievanceResolvedEmail({ to, studentName }) {
  return sendMail({
    to,
    subject: "Your grievance has been resolved",
    html: wrap(`
      <p>Hi ${studentName},</p>
      <p>Your grievance has been marked as resolved by a welfare officer. If the issue isn't fully fixed, please file a new grievance.</p>
    `),
  });
}

module.exports = {
  isConfigured,
  sendMail,
  sendApplicationStatusEmail,
  sendGrievanceAckEmail,
  sendGrievanceResolvedEmail,
};
