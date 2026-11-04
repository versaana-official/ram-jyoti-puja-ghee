export default async function handler(req, res) {
    const allowedOrigin = process.env.SITE_URL || 'https://ram-jyoti-puja-ghee.vercel.app';
    const origin = req.headers.origin;
    if (origin === allowedOrigin || origin?.includes('localhost')) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { collection } = req.query;
    const ALLOWED_COLLECTIONS = ["orders", "inquiries", "abandoned_carts", "products", "promocodes", "site_content", "testimonials"];

    if (!collection || !ALLOWED_COLLECTIONS.includes(collection)) {
        return res.status(400).json({ error: "Invalid collection" });
    }

    const owner = process.env.GITHUB_OWNER || 'versaana-official';
    const repo = process.env.GITHUB_REPO || 'ram-jyoti-puja-ghee';
    const token = process.env.GITHUB_TOKEN;
    const branch = ['orders', 'inquiries', 'abandoned_carts'].includes(collection) ? 'data-log' : 'main';

    const headers = {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'RamJyoti-Vercel-API'
    };

    try {
        if (collection === 'site_content') {
            // Try single file first (Decap File Collection)
            let fileRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/content/site_content.json?ref=${branch}`, { headers });
            if (fileRes.ok) {
                const fileData = await fileRes.json();
                const content = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf8'));
                return res.status(200).json([content]);
            }
            // Fallback: Try folder collection if single file doesn't exist
            const folderRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/content/site_content?ref=${branch}`, { headers });
            if (folderRes.ok) {
                const files = await folderRes.json();
                if (Array.isArray(files)) {
                    const items = [];
                    for (const file of files) {
                        if (file.type === 'file' && file.name.endsWith('.json')) {
                            const r = await fetch(file.download_url, { headers: { 'User-Agent': 'RamJyoti-Vercel-API' } });
                            if (r.ok) items.push(await r.json());
                        }
                    }
                    return res.status(200).json(items);
                }
            }
            return res.status(200).json([]);
        }

        // Standard folder collections
        const url = `https://api.github.com/repos/${owner}/${repo}/contents/content/${collection}?ref=${branch}`;
        const response = await fetch(url, { headers });

        if (response.status === 404) return res.status(200).json([]);
        if (!response.ok) throw new Error(`GitHub API error: ${response.statusText}`);

        const files = await response.json();
        if (!Array.isArray(files)) return res.status(200).json([]);

        const items = [];
        for (const file of files) {
            if (file.type === 'file' && file.name.endsWith('.json')) {
                const fileRes = await fetch(file.download_url, { headers: { 'User-Agent': 'RamJyoti-Vercel-API' } });
                if (fileRes.ok) {
                    items.push(await fileRes.json());
                }
            }
        }

        return res.status(200).json(items);
    } catch (err) {
        console.error("Get data error:", err);
        return res.status(500).json({ error: "Failed to retrieve collection data" });
    }
}
