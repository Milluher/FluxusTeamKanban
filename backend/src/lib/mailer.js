// Email notifications via Resend.
// Safe by design: if RESEND_API_KEY is unset the mailer no-ops, and every send
// is wrapped so a failure only logs — it never breaks the API request or the
// in-app notification that accompanies it.
const { Resend } = require('resend');

const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;

// Must be a verified Resend domain in production. Defaults to Resend's shared
// onboarding sender, which only delivers to the account owner's address (test mode).
const FROM = process.env.EMAIL_FROM || 'FluxusTeam Kanban <onboarding@resend.dev>';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://fluxusteamkanban.vercel.app';

function ticketUrl(boardId, ticketId) {
  if (!boardId) return FRONTEND_URL;
  const base = `${FRONTEND_URL}/board/${boardId}`;
  return ticketId ? `${base}?ticket=${encodeURIComponent(ticketId)}` : base;
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Comments are stored as rich-text HTML — reduce to a short, safe plain-text snippet.
function toSnippet(html = '', max = 220) {
  const text = String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function layout({ heading, bodyHtml, ctaLabel, ctaUrl }) {
  return `
  <div style="background:#f0f2f5;padding:32px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:#1a1f3c;padding:20px 28px;">
        <span style="color:#ffffff;font-size:16px;font-weight:700;">FluxusTeam Kanban</span>
      </div>
      <div style="padding:28px;">
        <h1 style="margin:0 0 16px;font-size:18px;line-height:1.4;color:#1a1f3c;">${heading}</h1>
        ${bodyHtml}
        <a href="${ctaUrl}" style="display:inline-block;margin-top:24px;background:#e8390e;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:10px;">${ctaLabel}</a>
      </div>
      <div style="padding:16px 28px;border-top:1px solid #f0f2f5;">
        <span style="color:#9ca3af;font-size:12px;">You received this because you're a member of this board on FluxusTeam Kanban.</span>
      </div>
    </div>
  </div>`;
}

async function send({ to, subject, html }) {
  if (!resend) {
    console.warn(`[mailer] RESEND_API_KEY not set — skipping email "${subject}" to ${to}`);
    return;
  }
  if (!to) return;
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch (e) {
    console.error(`[mailer] Failed to send "${subject}" to ${to}:`, e?.message || e);
  }
}

// --- Public helpers -------------------------------------------------------

async function sendTicketAssignedEmail({ to, assigneeName, assignerName, ticketTitle, boardId, ticketId }) {
  const url = ticketUrl(boardId, ticketId);
  const by = assignerName ? ` by <strong>${escapeHtml(assignerName)}</strong>` : '';
  const bodyHtml = `
    <p style="margin:0;font-size:14px;line-height:1.6;color:#374151;">
      Hi ${escapeHtml(assigneeName || 'there')}, you've been assigned${by} to a ticket:
    </p>
    <div style="margin-top:14px;padding:14px 16px;background:#f7f8fa;border:1px solid #e5e7eb;border-radius:10px;">
      <span style="font-size:15px;font-weight:600;color:#1a1f3c;">${escapeHtml(ticketTitle)}</span>
    </div>`;
  await send({
    to,
    subject: `You were assigned: ${ticketTitle}`,
    html: layout({ heading: 'You were assigned a ticket', bodyHtml, ctaLabel: 'View ticket', ctaUrl: url }),
  });
}

async function sendMentionEmail({ to, recipientName, commenterName, ticketTitle, commentContent, boardId, ticketId }) {
  const url = ticketUrl(boardId, ticketId);
  const snippet = escapeHtml(toSnippet(commentContent));
  const bodyHtml = `
    <p style="margin:0;font-size:14px;line-height:1.6;color:#374151;">
      Hi ${escapeHtml(recipientName || 'there')}, <strong>${escapeHtml(commenterName)}</strong> mentioned you in a comment on
      <strong>${escapeHtml(ticketTitle)}</strong>:
    </p>
    <div style="margin-top:14px;padding:14px 16px;background:#f7f8fa;border-left:3px solid #e8390e;border-radius:8px;">
      <span style="font-size:14px;line-height:1.6;color:#374151;">${snippet}</span>
    </div>`;
  await send({
    to,
    subject: `${commenterName} mentioned you on "${ticketTitle}"`,
    html: layout({ heading: `${escapeHtml(commenterName)} mentioned you`, bodyHtml, ctaLabel: 'View comment', ctaUrl: url }),
  });
}

module.exports = { sendTicketAssignedEmail, sendMentionEmail };
