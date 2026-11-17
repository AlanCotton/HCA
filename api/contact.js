// HCA contact form: emails each enquiry via Resend.
// Needs these environment variables in Vercel:
//   RESEND_API_KEY  - from resend.com
//   CONTACT_TO      - where enquiries go (default hello@hca.uk.com)
//   CONTACT_FROM    - a sender on a domain verified in Resend, e.g. "HCA website <website@hca.uk.com>"
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false });
  }
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const clean = (v, max) => String(v || '').trim().slice(0, max);

  // Honeypot: bots fill this in; pretend success.
  if (clean(body['bot-field'], 200)) return res.status(200).json({ ok: true });

  const name = clean(body.name, 200);
  const email = clean(body.email, 200);
  const business = clean(body.business, 200);
  const phone = clean(body.phone, 60);
  const message = clean(body.message, 5000);
  const source = clean(body.source, 60) || 'HCA';

  if (!name || !email || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'missing_fields' });
  }
  const key = process.env.RESEND_API_KEY;
  if (!key) return res.status(503).json({ ok: false, error: 'not_configured' });

  const text = [
    'Name: ' + name,
    'Email: ' + email,
    'Agency: ' + (business || '-'),
    'Phone: ' + (phone || '-'),
    'Source: ' + source,
    '',
    message
  ].join('\n');

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.CONTACT_FROM || 'HCA website <onboarding@resend.dev>',
      to: [process.env.CONTACT_TO || 'hello@hca.uk.com'],
      reply_to: email,
      subject: 'Website enquiry from ' + name + (business ? ' (' + business + ')' : ''),
      text
    })
  });
  if (!r.ok) return res.status(502).json({ ok: false, error: 'send_failed' });
  return res.status(200).json({ ok: true });
};
