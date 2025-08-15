// dog-color-app/api/remove-bg.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { imageBase64 } = req.body || {};
    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 is required' });

    const apiKey = process.env.CLIPDROP_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Missing CLIPDROP_API_KEY' });

    const raw = imageBase64.split(',')[1] || imageBase64;
    const bytes = Buffer.from(raw, 'base64');

    const form = new FormData();
    form.append('image_file', new Blob([bytes]), 'upload.png');

    const resp = await fetch('https://clipdrop-api.co/remove-background/v1', {
      method: 'POST',
      headers: { 'x-api-key': apiKey },
      body: form
    });

    if (!resp.ok) {
      const t = await resp.text();
      return res.status(resp.status).json({ error: 'clipdrop_failed', detail: t });
    }

    const arr = await resp.arrayBuffer();
    const b64 = Buffer.from(arr).toString('base64');
    return res.status(200).json({ transparentPngBase64: `data:image/png;base64,${b64}` });
  } catch (e) {
    return res.status(500).json({ error: 'server_error', detail: String(e) });
  }
}
