// dog-color-app/api/remove-bg.js
import fetch from 'node-fetch';
import FormData from 'form-data';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    }

    // 後方互換: 旧payload { imageBase64: "data:image/png;base64,..." or "...base64" } を許容
    // 新payload { filename, mime, data } も許容
    let filename = 'upload.png';
    let mime = 'image/png';
    let base64;

    if (req.body && typeof req.body === 'object') {
      // 新方式
      if (req.body.data) {
        base64 = req.body.data;
        if (req.body.filename) filename = req.body.filename;
        if (req.body.mime) mime = req.body.mime;
      }
      // 旧方式
      else if (req.body.imageBase64) {
        const raw = String(req.body.imageBase64);
        // dataURL の場合は先頭を剥がして mime を拾う
        const m = raw.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
        if (m) {
          mime = m[1];
          base64 = m[2];
          // 拡張子は簡易推定
          if (/jpeg|jpg/.test(mime)) filename = 'upload.jpg';
          else if (/png/.test(mime)) filename = 'upload.png';
          else if (/webp/.test(mime)) filename = 'upload.webp';
        } else {
          // プレーンなbase64だけが来た場合
          base64 = raw;
        }
      }
    }

    if (!base64) {
      return res.status(400).json({ error: 'NO_IMAGE_DATA' });
    }

    // Base64 → Buffer
    let buffer;
    try {
      buffer = Buffer.from(base64, 'base64');
    } catch (e) {
      return res.status(400).json({ error: 'INVALID_BASE64', detail: String(e) });
    }

    // 形式・サイズチェック（必要に応じ調整）
    if (!/^image\/(png|jpe?g|webp)$/i.test(mime)) {
      return res.status(415).json({ error: 'UNSUPPORTED_TYPE', detail: mime });
    }
    if (buffer.length > 4 * 1024 * 1024) {
      return res.status(413).json({ error: 'FILE_TOO_LARGE', size: buffer.length });
    }

    const apiKey = process.env.CLIPDROP_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'MISSING_API_KEY' });
    }

    const form = new FormData();
    // Node環境では Blob ではなく Buffer を渡す
    form.append('image_file', buffer, { filename, contentType: mime });

    const resp = await fetch('https://clipdrop-api.co/remove-background/v1', {
      method: 'POST',
      headers: { 'x-api-key': apiKey },
      body: form
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error('ClipDrop error', resp.status, t);
      return res.status(502).json({ error: 'CLIPDROP_ERROR', status: resp.status, detail: t });
    }

    const arr = await resp.arrayBuffer();

    // 返し方は2通り：①PNGバイナリを直接 ②base64のdataURL
    // フロントの実装が扱いやすい方を選んでください。
    // --- ① 画像を直接返す（<img src="/api/remove-bg?..." /> のような使い方向け） ---
    // res.setHeader('Content-Type', 'image/png');
    // return res.send(Buffer.from(arr));

    // --- ② JSONで dataURL を返す（今回のブラウザ実装に馴染みやすい） ---
    const b64 = Buffer.from(arr).toString('base64');
    return res.status(200).json({ transparentPngBase64: `data:image/png;base64,${b64}` });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'SERVER_ERROR', detail: String(e) });
  }
}
