import { Octokit } from "@octokit/rest";

export default function handler(req, res) {
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

  // Allowed collections for write actions
  const allowedCollections = ['inquiries', 'abandoned_carts', 'orders', 'testimonials'];
  if (!allowedCollections.includes(collection)) {
    return res.status(403).json({ error: 'Unauthorized collection target' });
  }

  const token = process.env.GITHUB_TOKEN; 
  if (!token) {
    return res.status(500).json({ error: 'GitHub token not configured on Vercel environment variables' });
  }

  const octokit = new Octokit({ auth: token });
  const owner = "versaana-official";
  const repo = "ram-jyoti-puja-ghee";
  const branch = "main";

  // Generate unique filename based on timestamp or ID
  const uniqueId = data.order_id || data.cart_id || `inquiry-${Date.now()}`;
  const filePath = `content/${collection}/${uniqueId}.json`;
  const fileContent = JSON.stringify(data, null, 2);

  octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: filePath,
    message: `CMS Submission: New ${collection} entry [${uniqueId}]`,
    content: Buffer.from(fileContent).toString('base64'),
    branch: branch,
  })
  .then(response => {
    return res.status(200).json({ success: true, commit: response.data.commit.sha });
  })
  .catch(error => {
    return res.status(500).json({ error: error.message });
  });
}
