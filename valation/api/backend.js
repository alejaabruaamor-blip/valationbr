// Gera cobranca PIX na FreePay Brasil
// POST /backend.php  (rewrite -> /api/backend)

const API_URL = 'https://api.freepaybrasil.com/v1/payment-transaction/create';

function authHeader() {
  const pub = process.env.FREEPAY_PUBLIC_KEY || '';
  const sec = process.env.FREEPAY_SECRET_KEY || '';
  return 'Basic ' + Buffer.from(pub + ':' + sec).toString('base64');
}

function onlyDigits(v) {
  return String(v || '').replace(/\D/g, '');
}

function parseCents(value) {
  const n = parseFloat(String(value || '0').replace(/\./g, '').replace(',', '.'));
  return Math.round((isNaN(n) ? 0 : n) * 100);
}

const PANEL_URL = 'https://ignite-joy-quiz.lovable.app/api/public/ingest';
const PANEL_TOKEN = '8082d4bbd11dea94c7ea0815844c30f8137c619a';

function utmsFrom(req, body) {
  const out = {
    utm_source: body.utm_source || '',
    utm_medium: body.utm_medium || '',
    utm_campaign: body.utm_campaign || '',
    utm_content: body.utm_content || '',
    utm_term: body.utm_term || '',
  };
  try {
    const ref = req.headers.referer || req.headers.referrer || '';
    if (ref) {
      const q = new URL(ref).searchParams;
      Object.keys(out).forEach(function (k) {
        if (!out[k] && q.get(k)) out[k] = q.get(k);
      });
    }
  } catch (e) {}
  return out;
}

function stageFrom(req, body, amountCents) {
  if (body.stage) return String(body.stage);
  const ref = String(req.headers.referer || '');
  if (ref.indexOf('/rec/up1') !== -1) return 'up1';
  if (ref.indexOf('/rec/up2') !== -1) return 'up2';
  if (ref.indexOf('/rec/up3') !== -1) return 'up3';
  if (body.product_type === 'iof' || body.tipo === 'upsell') return 'up1';
  if (amountCents === 1990) return 'up2';
  if (amountCents === 2990) return 'up3';
  return 'checkout';
}

async function sendToPanel(payload) {
  try {
    await fetch(PANEL_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-ingest-token': PANEL_TOKEN },
      body: JSON.stringify(payload),
    });
  } catch (e) {}
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  try {
    return JSON.parse(raw || '{}');
  } catch (e) {
    return {};
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo nao permitido' });

  if (!process.env.FREEPAY_PUBLIC_KEY || !process.env.FREEPAY_SECRET_KEY) {
    return res.status(500).json({ error: 'Credenciais da FreePay nao configuradas' });
  }

  try {
    const body = await readBody(req);

    const bumps = Array.isArray(body.selected_orderbumps) ? body.selected_orderbumps : [];
    const extras = bumps.reduce((s, i) => s + (parseInt(i.priceInCents, 10) || 0), 0);
    let amount = parseCents(body.amount) + extras;
    if (!amount || amount < 100) amount = 100;

    const nome = (body.nome || '').trim() || 'Cliente Free Fire';
    const email = (body.email || '').trim() || 'cliente@exemplo.com';
    const telefone = onlyDigits(body.telefone) || '11999999999';
    const cpf = onlyDigits(body.cpf) || '00000000000';

    const items = [
      {
        title: 'Ebook Design',
        unit_price: parseCents(body.amount) || amount,
        quantity: 1,
        tangible: false,
        external_ref: 'ebook_design',
      },
    ];
    bumps.forEach(function (b, idx) {
      const price = parseInt(b.priceInCents, 10) || 0;
      if (price > 0) {
        items.push({
          title: b.name || b.title || 'Item adicional',
          unit_price: price,
          quantity: 1,
          tangible: false,
          external_ref: 'bump_' + idx,
        });
      }
    });

    const utms = utmsFrom(req, body);
    const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
    const host = req.headers['x-forwarded-host'] || req.headers.host;

    const payload = {
      payment_method: 'pix',
      amount: amount,
      customer: {
        name: nome,
        email: email,
        document: { type: 'cpf', number: cpf },
        phone: telefone.startsWith('55') ? telefone : '55' + telefone,
      },
      items: items,
      pix: { expires_in_days: 1 },
      postback_url: proto + '://' + host + '/api/webhook',
      metadata: {
        provider_name: 'Ebook Design',
        player_id: body.playerId || '',
        stage: stageFrom(req, body, amount),
        utm_source: utms.utm_source,
        utm_medium: utms.utm_medium,
        utm_campaign: utms.utm_campaign,
        utm_content: utms.utm_content,
        utm_term: utms.utm_term,
      },
      tracking: {
        src: utms.utm_source,
        utm_source: utms.utm_source,
        utm_medium: utms.utm_medium,
        utm_campaign: utms.utm_campaign,
        utm_content: utms.utm_content,
        utm_term: utms.utm_term,
      },
      ip: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || '127.0.0.1',
    };

    const r = await fetch(API_URL, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: authHeader(),
      },
      body: JSON.stringify(payload),
    });

    const json = await r.json().catch(function () {
      return null;
    });

    const data = json && json.data ? json.data : null;
    const qrcode = data && data.pix ? data.pix.qr_code : null;

    if (!r.ok || !qrcode || !data.id) {
      const msgs = json && json.error_messages ? json.error_messages : [];
      return res.status(400).json({
        error: (Array.isArray(msgs) && msgs.length ? msgs.join(' | ') : 'Nao foi possivel gerar o PIX'),
        raw: json,
      });
    }

    await sendToPanel(Object.assign(
      {
        txid: data.id,
        stage: stageFrom(req, body, amount),
        amount_cents: amount,
        status: String(data.status || 'pending').toLowerCase(),
        product_name: 'Ebook Design',
        customer_name: nome,
        customer_email: email,
        customer_phone: telefone,
      },
      utms
    ));

    return res.status(200).json({
      id: data.id,
      status: data.status || 'PENDING',
      amount: data.amount,
      pix: {
        qrcode: qrcode,
        expiration_date: data.pix.expiration_date || null,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao gerar PIX', detail: String(err && err.message) });
  }
};
