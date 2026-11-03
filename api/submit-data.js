export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { collection, data } = req.body;
  if (!collection || !data) {
    return res.status(400).json({ error: 'Collection and data are required' });
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'GITHUB_TOKEN environment variable is missing on Vercel' });
  }

  const owner = "versaana-official";
  const repo = "ram-jyoti-puja-ghee";
  const branch = "main";

  const uniqueId = data.order_id || data.cart_id || `inquiry-${Date.now()}`;
  const filePath = `content/${collection}/${uniqueId}.json`;
  const fileContent = JSON.stringify(data, null, 2);
  const encodedContent = Buffer.from(fileContent).toString('base64');

  try {
    let sha = null;
    const checkRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'RamJyoti-CMS-Agent',
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    if (checkRes.ok) {
      const fileData = await checkRes.json();
      sha = fileData.sha;
    }

    const payload = {
      message: `CMS Auto-Submission: New ${collection} entry [${uniqueId}]`,
      content: encodedContent,
      branch: branch
    };
    if (sha) payload.sha = sha;

    const commitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'RamJyoti-CMS-Agent',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!commitRes.ok) {
      const errText = await commitRes.text();
      return res.status(500).json({ error: `GitHub API error: ${errText}` });
    }

    const commitData = await commitRes.json();
    return res.status(200).json({ success: true, commit: commitData.commit.sha });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
