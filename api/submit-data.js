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

    try {
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

        if (!token) {
            return res.status(500).json({ error: "Server misconfiguration: GITHUB_TOKEN environment variable is missing in Vercel." });
        }

        const uniqueId = data.order_id || data.cart_id || data.id || `inq-${Date.now()}`;
        const filePath = `content/${collection}/${uniqueId}.json`;

        const headers = {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'RamJyoti-Vercel-API',
            'Content-Type': 'application/json'
        };

        // Step 1: Ensure branch exists if writing to data-log
        if (branch === 'data-log') {
            const branchCheck = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches/${branch}`, { headers });
            if (branchCheck.status === 404) {
                const mainRefRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/main`, { headers });
                if (mainRefRes.ok) {
                    const mainRefData = await mainRefRes.json();
                    const createBranchRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({
                            ref: `refs/heads/${branch}`,
                            sha: mainRefData.object.sha
                        })
                    });
                    if (!createBranchRes.ok && createBranchRes.status !== 422) {
                        const errText = await createBranchRes.text();
                        throw new Error(`Failed to create branch ${branch}: ${errText}`);
                    }
                } else {
                    throw new Error("Failed to fetch 'main' branch reference to create 'data-log'");
                }
            }
        }

        // Step 2: Check if file already exists (get SHA for updates)
        let sha = undefined;
        const checkRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`, { headers });
        if (checkRes.ok) {
            sha = (await checkRes.json()).sha;
        }

        // Step 3: Commit file to GitHub
        const contentBase64 = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
        const putRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({
                message: `Data log update: ${collection}/${uniqueId}`,
                content: contentBase64,
                branch: branch,
                ...(sha && { sha })
            })
        });

        if (!putRes.ok) {
            const errBody = await putRes.text();
            throw new Error(`GitHub commit failed (${putRes.status}): ${errBody}`);
        }

        return res.status(200).json({ success: true, id: uniqueId });
    } catch (err) {
        console.error("Submit data error:", err);
        return res.status(500).json({ error: err.message || "Failed to commit data to GitHub" });
    }
}
