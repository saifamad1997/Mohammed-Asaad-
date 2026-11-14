export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const id = String(req.query?.id || '').trim();
  if (!/^[a-zA-Z0-9_-]{1,120}$/.test(id)) return res.status(400).json({ error: 'Invalid asset id' });
  try {
    const upstream = await fetch('https://api.polyhaven.com/files/' + encodeURIComponent(id), {
      headers: { 'User-Agent': 'MohammadAsaadFurnitureStudio/1.0' }
    });
    if (!upstream.ok) return res.status(upstream.status).json({ error: 'Poly Haven file lookup failed', status: upstream.status });
    const data = await upstream.json();
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=86400');
    return res.status(200).json(data);
  } catch (error) {
    return res.status(502).json({ error: 'Unable to load model files', detail: String(error?.message || error) });
  }
}
