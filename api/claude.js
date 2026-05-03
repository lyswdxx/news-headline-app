export default async function handler(req, res){
  res.setHeader('Access-Control-Allow-Origin','*');
  if(req.method==='OPTIONS') return res.status(200).end();
  if(req.method!=='POST') return res.status(405).json({ error:'Method not allowed' });
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if(!apiKey) return res.status(500).json({ error:'DEEPSEEK_API_KEY 未配置' });
  try{
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${apiKey}` },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch(err){
    res.status(500).json({ error: err.message });
  }
}