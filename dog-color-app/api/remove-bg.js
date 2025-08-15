// dog-color-app/api/remove-bg.js
import fetch from 'node-fetch';
import FormData from 'form-data';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    }

    const { filename = 'image.jpg', mime = 'image/jpeg', data } = req.body || {};
    if (!data) {
      return res.status(400).json({ error: 'NO_IMAGE_DATA' });
    }

    // Base64 -> Buffer
    let buffer;
    try {
      buffer = Buffer.from(data, 'base64');
    } catch (e) {
      console.error('[API] INVALID_BASE64:', e);
      return res.status(400).json({ error: 'INVALID_BASE64', detail: String(e) });
    }

    // 受け入れ形式（ClipDropは png/jpg/webp 想定）
    const normMime = mime.toLowerCase();
    if (!/^image\/(png|jpe?g|webp)$/.test(normMime)) {
      console.error('[API] UNSUPPORTED_TYPE:', normMime);
      return res.status(415).json({ error: 'UNSUPPORTED_TYPE', detail: normMime });
    }

    // サイズ上限（暫定 6MB。大きければ 2000px くらいに縮小してから再送を推奨）
    const MAX = 6 * 1024 * 1024;
    if (buffer.length > MAX) {
      console.error('[API] FILE_TOO_LARGE:', buffer.length);
      return res.status(413).json({ error: 'FILE_TOO_LARGE', size: buffer.length, max: MAX });
    }

    const apiKey = process.env.CLIPDROP_API_KEY;
    if (!apiKey) {
      console.error('[API] Missing CLIPDROP_API_KEY');
      return res.status(500).json({ error: 'MISSING_API_KEY' });
    }

    // ClipDrop へ multipart/form-data で送る
    const form = new FormData();
    form.append('image_file', buffer, { filename, contentType: normMime });

    console.log('[API] calling ClipDrop', {
      size: buffer.length,
      mime: normMime,
      filename
    });

    const r = await fetch('https://clipdrop-api.co/remove-background/v1', {
      method: 'POST',
      headers: { 'x-api-key': apiKey },
      body: form
    });

    const ct = r.headers.get('content-type') || '';
    if (!r.ok) {
      const text = ct.includes('application/json') ? await r.text() : await r.text();
      console.error('[API] ClipDrop error', r.status, text);
      return res.status(502).json({
        error: 'CLIPDROP_ERROR',
        status: r.status,
        detail: text.slice(0, 1000), // 長すぎる場合はカット
        ct
      });
    }

    // ClipDropは透明PNGが返ってくる
    const buf = Buffer.from(await r.arrayBuffer());
    console.log('[API] ClipDrop OK, bytes:', buf.length, 'ct:', ct);
    res.setHeader('Content-Type', 'image/png');
    return res.send(buf);
  } catch (e) {
    console.error('[API] SERVER_ERROR', e);
    return res.status(500).json({ error: 'SERVER_ERROR', detail: String(e) });
  }
}
