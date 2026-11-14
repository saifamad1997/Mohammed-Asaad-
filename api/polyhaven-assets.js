export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const upstream = await fetch('https://api.polyhaven.com/assets?type=models', {
      headers: { 'User-Agent': 'MohammadAsaadFurnitureStudio/1.0' }
    });
    if (!upstream.ok) return res.status(upstream.status).json({ error: 'Poly Haven API error', status: upstream.status });
    const data = await upstream.json();
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=86400');
    return res.status(200).json(data);
  } catch (error) {
    return res.status(502).json({ error: 'Unable to reach Poly Haven', detail: String(error?.message || error) });
  }
}
