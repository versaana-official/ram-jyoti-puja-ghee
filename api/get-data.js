import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { collection } = req.query;

  if (!collection) {
    return res.status(400).json({ error: 'Collection parameter is required' });
  }

  const dirPath = path.join(process.cwd(), 'content', collection);

  try {
    if (!fs.existsSync(dirPath)) {
      return res.status(200).json([]);
    }

    const files = fs.readdirSync(dirPath);
    const data = files
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const filePath = path.join(dirPath, file);
        const fileContent = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(fileContent);
      });

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
