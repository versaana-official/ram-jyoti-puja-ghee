import fetch from 'node-fetch';
import crypto from 'crypto';

export default async function handler(req, res) {
    const allowedOrigin = process.env.SITE_URL || 'https://ram-jyoti-puja-ghee.vercel.app';
    const origin = req.headers.origin;
    if (origin === allowedOrigin || origin?.includes('localhost')) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { collection, data } = req.body;
    const ALLOWED_COLLECTIONS = ["orders", "inquiries", "abandoned_carts", "products", "promocodes", "site_content", "testimonials"];

    if (!collection || !ALLOWED_COLLECTIONS.includes(collection) || !data) {
        return res.status(400).json({ error: "Invalid collection or missing data payload" });
    }

    const BRANCH_MAP = {
        products: "main", promocodes: "main", site_content: "main", testimonials: "main",
        orders: "data-log", inquiries: "data-log", abandoned_carts: "data-log"
    };

    const branch = BRANCH_MAP[collection] || "data-log";
    const owner = process.env.GITHUB_OWNER || 'versaana-official';
    const repo = process.env.GITHUB_REPO || 'ram-jyoti-puja-ghee';
    const token = process.env.GITHUB_TOKEN;

    const uniqueId = data.order_id || data.cart_id || data.id || crypto.randomUUID();
    const filePath = `content/${collection}/${uniqueId}.json`;

    try {
        let sha = undefined;
        const checkRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`, {
            headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'RamJyoti-Vercel-API' }
        });
        
        if (checkRes.ok) {
            sha = (await checkRes.json()).sha;
        }

        const contentBase64 = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
        const putRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json', 'User-Agent': 'RamJyoti-Vercel-API'
            },
            body: JSON.stringify({
                message: `Data log update: ${collection}/${uniqueId}`,
                content: contentBase64,
                branch: branch,
                ...(sha && { sha })
            })
        });

        if (!putRes.ok) throw new Error(`GitHub commit failed: ${await putRes.text()}`);

        return res.status(200).json({ success: true, id: uniqueId });
    } catch (err) {
        console.error("Submit data error:", err);
        return res.status(500).json({ error: "Failed to commit data to GitHub" });
    }
}
