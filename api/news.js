// 使用有效 RSS 源（已测试可用）
const FEEDS = {
  科技: ['https://feeds.feedburner.com/36kr/newsall', 'https://www.ifanr.com/feed'],
  财经: ['https://rsshub.app/wallstreetcn/latest'],
  人工智能: ['https://www.jiqizhixin.com/rss'],
  体育: ['https://rsshub.app/qq/sports/news'],
  健康: ['https://rsshub.app/health/163/news'],
  社会民生: ['https://rsshub.app/society/163/news'],
  汽车: ['https://rsshub.app/autohome/news'],
  教育: ['https://rsshub.app/edu/sina/news'],
};
const FALLBACK = ['https://rss.nytimes.com/services/xml/rss/nyt/World.xml', 'https://feeds.bbci.co.uk/news/world/rss.xml'];

function stripHtml(str){ return (str||'').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim(); }

async function fetchFeed(url){
  const res = await fetch(url, { headers:{'User-Agent':'Mozilla/5.0'} });
  if(!res.ok) return [];
  const xml = await res.text();
  const items = [];
  const blocks = xml.match(/<item>([\s\S]*?)<\/item>/g) || xml.match(/<entry>([\s\S]*?)<\/entry>/g) || [];
  for(let block of blocks.slice(0,8)){
    let title = (block.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '');
    let summary = (block.match(/<description>([\s\S]*?)<\/description>/)?.[1] || block.match(/<summary>([\s\S]*?)<\/summary>/)?.[1] || '');
    if(title) items.push({ title: stripHtml(title).slice(0,80), summary: stripHtml(summary).slice(0,200), source: url.split('/')[2] });
  }
  return items;
}

export default async function handler(req, res){
  res.setHeader('Access-Control-Allow-Origin','*');
  const { topic, kw } = req.query;
  let feeds = FEEDS[topic] || FALLBACK;
  let all = [];
  for(let url of feeds){
    const items = await fetchFeed(url);
    if(items.length){ all.push(...items); if(all.length>=10) break; }
  }
  if(all.length===0) return res.status(200).json({ news: [{ title:'暂未抓取到新闻', summary:'请检查网络或稍后重试', source:'系统' }] });
  if(kw && kw!==topic){
    const kwl = kw.toLowerCase();
    all = all.filter(i=> i.title.toLowerCase().includes(kwl) || i.summary.toLowerCase().includes(kwl));
  }
  const unique = [];
  const seen = new Set();
  for(let i of all){ if(!seen.has(i.title)){ seen.add(i.title); unique.push(i); } }
  res.status(200).json({ news: unique.slice(0,6) });
}