// Recebe os avisos de pagamento (postback) da FreePay Brasil
// POST /api/webhook
// Repassa o aviso para o painel de vendas (Lovable).

const PANEL_WEBHOOK =
  'https://ignite-joy-quiz.lovable.app/api/public/freepay-webhook';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString('utf8');
    console.log('freepay webhook:', raw.slice(0, 2000));

    try {
      await fetch(PANEL_WEBHOOK, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: raw || '{}',
      });
    } catch (e) {
      console.log('painel forward error:', String(e && e.message));
    }
  } catch (e) {
    console.log('freepay webhook error:', String(e && e.message));
  }
  return res.status(200).json({ received: true });
};
