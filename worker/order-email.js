// Cloudflare Worker: sends the "order received, waiting on Jay to confirm" email.
// Secrets and settings live in Cloudflare, never in this repo:
//   BREVO_API_KEY (secret), SENDER_EMAIL, SENDER_NAME, ALLOWED_ORIGIN (e.g. https://jaminhassan-debug.github.io)
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clip = (s, n) => String(s == null ? '' : s).slice(0, n);
const money = (n) => '£' + (Number(n) || 0).toFixed(2);

function cors(env) {
  return { 'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Vary': 'Origin' };
}

export default {
  async fetch(req, env) {
    const h = cors(env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: h });
    if (req.headers.get('Origin') !== env.ALLOWED_ORIGIN) return new Response('Forbidden', { status: 403, headers: h });

    let o;
    try { o = await req.json(); } catch (e) { return new Response('Bad request', { status: 400, headers: h }); }
    const email = clip(o.email, 120).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return new Response('Bad email', { status: 400, headers: h });
    const lines = Array.isArray(o.lines) ? o.lines.slice(0, 30) : [];
    const first = esc(clip(o.name, 60).split(' ')[0] || 'there');
    const rows = lines.map((l) => '<tr><td style="padding:4px 0">' + esc(clip(l.name, 120)) + '</td><td style="padding:4px 0;text-align:right">' + money(l.price) + '</td></tr>').join('');
    const mode = o.mode === 'Delivery' ? 'Delivery' : 'Collection';
    const html = '<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#1a1816">' +
      '<h2 style="color:#c84f00;margin:0 0 8px">We have your order</h2>' +
      '<p>Hi ' + first + ', thanks for ordering from DesiSmash. Your order has been <b>received and is waiting on Jay to confirm</b>. ' +
      'Jay will reply on WhatsApp to confirm it. If you have not pressed send in WhatsApp yet, please do, so he sees it.</p>' +
      '<p style="background:#fff1e3;border:2px solid #c84f00;border-radius:10px;padding:10px 14px"><b>' + mode + ':</b> ' + esc(clip(o.when, 60)) + (mode === 'Delivery' ? '<br>' + esc(clip(o.address, 160)) : '') + '</p>' +
      '<table style="width:100%;border-collapse:collapse;border-top:1px solid #e4dfd8;border-bottom:1px solid #e4dfd8">' + rows + '</table>' +
      '<p style="font-size:18px;text-align:right"><b>Total ' + money(o.total) + '</b><br><span style="font-size:13px;color:#5f5851">Pay on ' + (mode === 'Delivery' ? 'delivery' : 'collection') + '</span></p>' +
      '<p style="font-size:12px;color:#5f5851">This is an automatic message about your order only. Allergies: tell us when you order.</p></div>';

    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: env.SENDER_EMAIL, name: env.SENDER_NAME || 'DesiSmash' },
        to: [{ email }],
        subject: 'Order received, waiting on Jay to confirm',
        htmlContent: html
      })
    });
    return new Response(r.ok ? 'ok' : 'send failed', { status: r.ok ? 200 : 502, headers: h });
  }
};
