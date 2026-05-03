// 备用源：rsshub 失败时使用 invidious 或 mock
const RSSHUB_BASE = 'https://rsshub.app';
const INVIDIOUS_INSTANCES = [
  'https://y.com.cm',
  'https://invidious.snopyta.org',
  'https://inv.riverside.rocks'
];
const TRENDING = { US:'/youtube/trending/US', JP:'/youtube/trending/JP', KR:'/youtube/trending/KR', GB:'/youtube/trending/GB' };

function cleanText(s){ return (s||'').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim(); }

// 尝试从 RSSHub 获取
async function fetchFromRSSHub(region){
  const url = RSSHUB_BASE + (TRENDING[region]||TRENDING.US);
  const res = await fetch(url, { headers:{'User-Agent':'Mozilla/5.0'} });
  if(!res.ok) return [];
  const xml = await res.text();
  const blocks = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
  const items = [];
  for(const block of blocks.slice(0,12)){
    const title = block.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '';
    const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '';
    const author = block.match(/<author>([\s\S]*?)<\/author>/)?.[1] || '';
    const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || '';
    let desc = block.match(/<description>([\s\S]*?)<\/description>/)?.[1] || '';
    let thumb = '';
    const imgMatch = desc.match(/<img[^>]+src="([^">]+)"/);
    if(imgMatch) thumb = imgMatch[1];
    desc = cleanText(desc).slice(0,300);
    if(title && link){
      items.push({
        title: cleanText(title).slice(0,100),
        link, channel: cleanText(author).slice(0,50) || 'YouTube',
        published: pubDate, description: desc, thumbnail: thumb
      });
    }
  }
  return items;
}

// 尝试从 Invidious 实例获取（JSON API）
async function fetchFromInvidious(region){
  const regionMap = { US:'US', JP:'JP', KR:'KR', GB:'GB' };
  const code = regionMap[region] || 'US';
  for(const instance of INVIDIOUS_INSTANCES){
    try{
      const url = `${instance}/api/v1/trending?region=${code}`;
      const res = await fetch(url, { headers:{'User-Agent':'Mozilla/5.0'} });
      if(!res.ok) continue;
      const data = await res.json();
      if(Array.isArray(data)){
        return data.slice(0,12).map(v=> ({
          title: cleanText(v.title).slice(0,100),
          link: `https://youtube.com/watch?v=${v.videoId}`,
          channel: cleanText(v.author).slice(0,50),
          published: v.publishedText || '',
          description: cleanText(v.description||'').slice(0,300),
          thumbnail: v.videoThumbnails?.[0]?.url || ''
        }));
      }
    }catch(e){ continue; }
  }
  return [];
}

// 最终获取函数，带缓存和降级
let cache = { data: null, expire: 0 };
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { region='US' } = req.query;
  const now = Date.now();
  if(cache.data && cache.expire > now && cache.region === region){
    return res.status(200).json({ videos: cache.data });
  }
  let videos = [];
  try{
    videos = await fetchFromRSSHub(region);
    if(videos.length === 0) videos = await fetchFromInvidious(region);
  }catch(e){}
  if(videos.length === 0){
    // 模拟数据确保界面不空
    videos = [
      { title: '热门视频示例（网络抓取失败）', link: '#', channel: '示例频道', published: new Date().toISOString(), description: '请稍后重试，或切换其他地区。您仍可体验“生成介绍文”功能。', thumbnail: '' },
      { title: '第二个示例视频', link: '#', channel: '示例频道', published: new Date().toISOString(), description: '我们正在努力恢复数据源', thumbnail: '' }
    ];
  }
  cache = { data: videos, expire: now + 5*60*1000, region };
  res.status(200).json({ videos });
}