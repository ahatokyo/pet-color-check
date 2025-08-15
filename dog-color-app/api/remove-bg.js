// dog-color-app/api/remove-bg.js
// - クライアントから { filename, mime, data(base64) } を受け取る
// - ClipDrop に投げて、成功時は image/png をそのまま返却
// - 失敗時はステータスと詳細を JSON で返し、Function Logs にも出力

import fetch from 'node-fetch';
import FormData from 'form-data';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    }

    const body = req.body || {};
    const filename = body.filename || 'image.jpg';
    const mime = (body.mime || 'image/jpeg').toLowerCase();
    const base64 = body.data || body.imageBase64 || ''; // 両方に対応

    // 入力チェック
    if (!base64) {
      console.error('[remove-bg] NO_IMAGE_DATA');
      return res.status(400).json({ error: 'NO_IMAGE_DATA' });
    }
    if (!/^image\/(png|jpe?g|webp)$/.test(mime)) {
      console.error('[remove-bg] UNSUPPORTED_TYPE:', mime);
      return res.status(415).json({ error: 'UNSUPPORTED_TYPE', mime });
    }

    // dataURL 形式にも対応（"data:image/png;base64,..." を切り出し）
    const raw = base64.includes(',') ? base64.split(',')[1] : base64;

    let buffer;
    try {
      buffer = Buffer.from(raw, 'base64');
    } catch (e) {
      console.error('[remove-bg] INVALID_BASE64:', e);
      return res.status(400).json({ error: 'INVALID_BASE64', detail: String(e) });
    }

    // 4MB制限（Vercel無制限ではないため）
    if (buffer.length > 4 * 1024 * 1024) {
      console.error('[remove-bg] FILE_TOO_LARGE:', buffer.length);
      return res.status(413).json({ error: 'FILE_TOO_LARGE', size: buffer.length });
    }

    const apiKey = process.env.CLIPDROP_API_KEY;
    if (!apiKey) {
      console.error('[remove-bg] Missing CLIPDROP_API_KEY');
      return res.status(500).json({ error: 'MISSING_API_KEY' });
    }

    // フォーム組み立て
    const form = new FormData();
    form.append('image_file', buffer, { filename, contentType: mime });

    // ClipDrop へ
    const r = await fetch('https://clipdrop-api.co/remove-background/v1', {
      method: 'POST',
      headers: { 'x-api-key': apiKey },
      body: form
    });

    const text = await r.text(); // 成功でもPNGバイナリが入るため先に確保
    console.log('[remove-bg] ClipDrop status:', r.status);

    if (!r.ok) {
      // 失敗時の本文をログ出力
      console.error('[remove-bg] ClipDrop error body:', text);
      return res.status(502).json({
        error: 'CLIPDROP_ERROR',
        status: r.status,
        detail: text
      });
    }

    // 成功：text には PNG の生データが入っているのでバイナリ化して返す
    const out = Buffer.from(text, 'binary');
    res.setHeader('Content-Type', 'image/png');
    res.send(out);
  } catch (e) {
    console.error('[remove-bg] SERVER_ERROR:', e);
    res.status(500).json({ error: 'SERVER_ERROR', detail: String(e) });
  }
}
