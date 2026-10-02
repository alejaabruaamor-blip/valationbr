// Consulta o status da cobranca PIX (BravoPay ou FreePay)
// GET /api/check_status/?txid=...

const INGEST = 'https://ignite-joy-quiz.lovable.app/api/public/ingest';
const INGEST_TOKEN = '8082d4bbd11dea94c7ea0815844c30f8137c619a';

async function notifyPaid(txid, amountCents, stage) {
  try {
    await fetch(INGEST, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-ingest-token': INGEST_TOKEN },
      body: JSON.stringify({ txid: txid, status: 'paid', amount_cents: amountCents || 0, stage: stage || null, product_name: 'Ebook Design' }),
    });
  } catch (e) {}
}

async function checkBravo(txid) {
  if (!process.env.BRAVOPAY_API_KEY) return null;
  const r = await fetch('https://bravopay.club/api/v1/transactions/' + encodeURIComponent(txid), {
    headers: { authorization: 'Bearer ' + process.env.BRAVOPAY_API_KEY, accept: 'application/json' },
  });
  if (r.status === 404) return null;
  const j = await r.json().catch(function () { return null; });
  if (!j) return null;
  const d = j.data && typeof j.data === 'object' ? j.data : j;
  if (!d.status && !d.id) return null;
  const st = String(d.status || 'PENDING').toUpperCase();
  const cents = d.amount_cents || d.amount || 0;
  return { paid: st === 'PAID', status: st, cents: cents, stage: d.metadata && d.metadata.stage, raw: j };
}

async function checkFree(txid) {
  if (!process.env.FREEPAY_PUBLIC_KEY || !process.env.FREEPAY_SECRET_KEY) return null;
  const auth = 'Basic ' + Buffer.from(process.env.FREEPAY_PUBLIC_KEY + ':' + process.env.FREEPAY_SECRET_KEY).toString('base64');
  const r = await fetch('https://api.freepaybrasil.com/v1/payment-transaction/info/' + encodeURIComponent(txid), {
    headers: { accept: 'application/json', authorization: auth },
  });
  const j = await r.json().catch(function () { return null; });
  if (!j || j.success === false) return null;
  const d = j.data && typeof j.data === 'object' ? j.data : j;
  const st = String(d.status || 'PENDING').toUpperCase();
  return { paid: st === 'PAID', status: st, cents: d.amount || 0, stage: null, raw: j };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const url = new URL(req.url, 'http://localhost');
  const txid = url.searchParams.get('txid') || url.searchParams.get('id') || url.searchParams.get('transaction_id') || '';
  if (!txid) return res.status(400).json({ paid: false, error: 'txid ausente' });

  // IDs da FreePay sao 32 caracteres hexadecimais; o resto e BravoPay.
  const looksFree = /^[0-9a-f]{32}$/i.test(txid);
  const order = looksFree ? [checkFree, checkBravo] : [checkBravo, checkFree];

  try {
    let result = null;
    for (const fn of order) {
      try { result = await fn(txid); } catch (e) { result = null; }
      if (result) break;
    }
    if (!result) return res.status(200).json({ paid: false, status: 'PENDING', txid: txid });
    if (result.paid) await notifyPaid(txid, result.cents, result.stage);
    return res.status(200).json({ paid: result.paid, status: result.status, txid: txid, raw: result.raw });
  } catch (err) {
    return res.status(200).json({ paid: false, status: 'PENDING', error: String(err && err.message) });
  }
};
