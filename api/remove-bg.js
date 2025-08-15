// api/remove-bg.js
const fetch = require('node-fetch');
const FormData = require('form-data');

// Vercelのサーバーレス関数（Node.js）
// フロントから base64 を受け取り、Clipdropに投げて透過PNGを返します。
module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.statusCode = 405;
      return res.json({ error: 'Method not allowed' });
    }

    // JSON本文を読む
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString('utf8');
    const body = JSON.parse(raw || '{}');
    const imageBase64 = body.imageBase64;
    if (!imageBase64) {
      res.statusCode = 400;
      return res.json({ error: 'imageBase64 is required' });
    }

    // base64をバイナリへ
    const base64Data = imageBase64.split(',')[1] || '';
    const buf = Buffer.from(base64Data, 'base64');

    // form-dataでClipdropに送る
    const form = new FormData();
    form.append('image_file', buf, { filename: 'upload.jpg' });

    const resp = await fetch('https://clipdrop-api.co/remove-background/v1', {
      method: 'POST',
      headers: { 'x-api-key': process.env.CLIPDROP_API_KEY },
      body: form
    });

    if (!resp.ok) {
      const text = await resp.text();
      res.statusCode = 500;
      return res.json({ error: 'remove-bg failed', detail: text });
    }

    const arrayBuf = await resp.arrayBuffer();
    const outb64 = Buffer.from(arrayBuf).toString('base64');
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({ transparentPngBase64: `data:image/png;base64,${outb64}` });
  } catch (e) {
    res.statusCode = 500;
    return res.json({ error: 'server error', detail: e?.message });
  }
};
