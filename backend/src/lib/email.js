// Email delivery for in-app notifications, through Resend.
//
// Every notification the app already creates (ticket assigned, @mention, the
// four PRD events) is also sent to the recipient's inbox. The in-app bell stays
// the source of truth: email is best-effort, so a failure here is logged and
// never fails the request that raised the notification.
//
// Configuration (Railway → backend → Variables):
//   RESEND_API_KEY  required. Without it, emails are skipped and logged once.
//   EMAIL_FROM      sender, e.g. "FluxusTeam <notifications@fluxx.ng>".
//                   Must be on a domain verified in Resend. The default,
//                   onboarding@resend.dev, only delivers to the Resend
//                   account owner's own address — fine for testing only.
//   FRONTEND_URL    where links in the email point. Defaults to the Vercel app.
//   EMAIL_NOTIFICATIONS  set to "off" to stop emails without removing the key.

const { PrismaClient } = require('@prisma/client');
const { Resend } = require('resend');

const prisma = new PrismaClient();

const FROM = process.env.EMAIL_FROM || 'FluxusTeam Kanban <onboarding@resend.dev>';
const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://fluxusteamkanban.vercel.app').replace(/\/+$/, '');

let client = null;
let warned = false;

function getClient() {
  if (process.env.EMAIL_NOTIFICATIONS === 'off') return null;
  if (!process.env.RESEND_API_KEY) {
    if (!warned) {
      console.warn('[email] RESEND_API_KEY is not set — notification emails are disabled');
      warned = true;
    }
    return null;
  }
  if (!client) client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Comment bodies are rich text; the email shows them as plain text.
function toPlainText(s) {
  return String(s ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Same destination the notification bell opens.
function linkFor(notification) {
  if (notification.boardId && notification.ticketId) {
    return `${FRONTEND_URL}/board/${notification.boardId}?ticket=${notification.ticketId}`;
  }
  if (notification.boardId) return `${FRONTEND_URL}/board/${notification.boardId}`;
  return `${FRONTEND_URL}/dashboard`;
}

function render({ name, title, body, link }) {
  const bodyHtml = escapeHtml(body).replace(/\n/g, '<br>');
  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f4f5f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#172b4d">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px">
    <tr><td style="padding:28px 28px 8px">
      <p style="margin:0 0 4px;font-size:13px;color:#5e6c84">FluxusTeam Kanban</p>
      <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3">${escapeHtml(title)}</h1>
      <p style="margin:0 0 8px;font-size:15px">Hi ${escapeHtml(name)},</p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.5">${bodyHtml}</p>
      <a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 18px;background:#0052cc;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600">Open in FluxusTeam</a>
    </td></tr>
    <tr><td style="padding:20px 28px 28px;font-size:12px;color:#5e6c84">
      You're getting this because of activity on a board you belong to.
    </td></tr>
  </table>
</body></html>`;
  const text = `${title}\n\nHi ${name},\n\n${body}\n\nOpen in FluxusTeam: ${link}\n`;
  return { html, text };
}

async function deliver(notification) {
  const resend = getClient();
  if (!resend) return;

  const user = await prisma.user.findUnique({
    where: { id: notification.userId },
    select: { email: true, name: true },
  });
  if (!user?.email) return;

  const body = toPlainText(notification.body);
  const { html, text } = render({
    name: user.name || 'there',
    title: notification.title,
    body,
    link: linkFor(notification),
  });

  const { error } = await resend.emails.send({
    from: FROM,
    to: user.email,
    subject: notification.title,
    html,
    text,
  });
  if (error) {
    console.error(`[email] Resend rejected ${notification.type} to ${user.email}:`, error.message || error);
  }
}

/**
 * Email the recipient of an in-app notification. Fire-and-forget: call it
 * without awaiting, next to the socket emit. Never throws.
 */
function emailNotification(notification) {
  if (!notification) return;
  deliver(notification).catch((e) => {
    console.error(`[email] failed to send ${notification.type}:`, e.message || e);
  });
}

module.exports = { emailNotification, linkFor, toPlainText, render };
