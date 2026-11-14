import { Readable } from 'node:stream';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let source;
  try {
    source = new URL(String(req.query?.url || ''));
  } catch {
    return res.status(400).json({ error: 'Invalid model URL' });
  }

  const allowed =
    (source.hostname === 'storage.googleapis.com' && source.pathname.startsWith('/furnimesh-3d/gbl-files/')) ||
    (source.hostname === 'www.innerscene.com' && /^\/api\/library\/[a-z0-9-]+\/download$/.test(source.pathname));

  if (source.protocol !== 'https:' || !allowed) {
    return res.status(403).json({ error: 'Model source is not allowed' });
  }

  try {
    const upstream = await fetch(source.toString(), {
      headers: { 'User-Agent': 'MohammadAsaadFurnitureStudio/1.0', 'Accept': 'model/gltf-binary, application/octet-stream, */*' },
      redirect: 'follow'
    });
    if (!upstream.ok || !upstream.body) {
      return res.status(upstream.status || 502).json({ error: 'Model provider request failed', status: upstream.status });
    }

    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'model/gltf-binary');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    const length = upstream.headers.get('content-length');
    if (length) res.setHeader('Content-Length', length);
    res.status(200);

    const reader = upstream.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!res.write(Buffer.from(value))) {
        await new Promise(resolve => res.once('drain', resolve));
      }
    }
    return res.end();
  } catch (error) {
    if (!res.headersSent) return res.status(502).json({ error: 'Unable to stream 3D model', detail: String(error?.message || error) });
    return res.end();
  }
}
