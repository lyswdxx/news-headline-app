export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.error('DEEPSEEK_API_KEY 未配置');
    return res.status(500).json({ error: 'DEEPSEEK_API_KEY 未配置，请在Vercel环境变量中添加' });
  }

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    if (!response.ok) {
      console.error('DeepSeek API 错误:', JSON.stringify(data));
      return res.status(response.status).json(data);
    }
    res.status(200).json(data);
  } catch (err) {
    console.error('代理错误:', err);
    res.status(500).json({ error: err.message });
  }
}