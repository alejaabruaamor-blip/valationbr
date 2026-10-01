// Consulta o status da cobranca PIX na FreePay Brasil
// GET /check_status.php?txid=...  (rewrite -> /api/check_status)

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const url = new URL(req.url, 'http://localhost');
  const txid =
    url.searchParams.get('txid') ||
    url.searchParams.get('id') ||
    url.searchParams.get('transaction_id') ||
    '';

  if (!txid) return res.status(400).json({ paid: false, error: 'txid ausente' });

  if (txid.indexOf('tx_') === 0) {
    try {
      const r = await fetch('https://bravopay.club/api/v1/transactions/' + encodeURIComponent(txid), {
        headers: { authorization: 'Bearer ' + (process.env.BRAVOPAY_API_KEY || '') },
      });
      const j = await r.json().catch(function () { return null; });
      const st = String((j && (j.status || (j.data && j.data.status))) || 'PENDING').toUpperCase();
      if (st === 'PAID') {
        try {
          await fetch('https://ignite-joy-quiz.lovable.app/api/public/ingest', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-ingest-token': '8082d4bbd11dea94c7ea0815844c30f8137c619a' },
            body: JSON.stringify({ txid: txid, status: 'paid', amount_cents: j.amount_cents, stage: (j.metadata && j.metadata.stage) || 'checkout', product_name: 'Ebook Design' }),
          });
        } catch (e) {}
      }
      return res.status(200).json({ paid: st === 'PAID', status: st, txid: txid, raw: j });
    } catch (err) {
      return res.status(200).json({ paid: false, status: 'PENDING', error: String(err && err.message) });
    }
  }

  if (!process.env.FREEPAY_PUBLIC_KEY || !process.env.FREEPAY_SECRET_KEY) {
    return res.status(500).json({ paid: false, error: 'Credenciais da FreePay nao configuradas' });
  }

  const auth =
    'Basic ' +
    Buffer.from(process.env.FREEPAY_PUBLIC_KEY + ':' + process.env.FREEPAY_SECRET_KEY).toString('base64');

  try {
    const r = await fetch(
      'https://api.freepaybrasil.com/v1/payment-transaction/info/' + encodeURIComponent(txid),
      { headers: { accept: 'application/json', authorization: auth } }
    );
    const json = await r.json().catch(function () {
      return null;
    });

    const status = String((json && (json.status || (json.data && json.data.status))) || '').toUpperCase();

    return res.status(200).json({
      paid: status === 'PAID',
      status: status || 'PENDING',
      txid: txid,
      raw: json,
    });
  } catch (err) {
    return res.status(200).json({ paid: false, status: 'PENDING', error: String(err && err.message) });
  }
};
