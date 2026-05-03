const RSSHUB_BASE = 'https://rsshub.app';
const TRENDING = { US:'/youtube/trending/US', JP:'/youtube/trending/JP', KR:'/youtube/trending/KR', GB:'/youtube/trending/GB' };

function cleanText(s){ return (s||'').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim(); }

async function fetchTrending(region){
  const url = RSSHUB_BASE + (TRENDING[region]||TRENDING.US);
  try{
    const res = await fetch(url, { headers:{'User-Agent':'Mozilla/5.0'} });
    if(!res.ok) return [];
    const xml = await res.text();
    const items = [];
    const blocks = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
    for(const block of blocks.slice(0,12)){
      const title = block.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '';
      const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '';
      const author = block.match(/<author>([\s\S]*?)<\/author>/)?.[1] || '';
      const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || '';
      let desc = block.match(/<description>([\s\S]*?)<\/description>/)?.[1] || '';
      let thumb = '';
      const img = desc.match(/<img[^>]+src="([^">]+)"/);
      if(img) thumb = img[1];
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
  }catch(e){ return []; }
}

export default async function handler(req, res){
  res.setHeader('Access-Control-Allow-Origin','*');
  const { region='US' } = req.query;
  const videos = await fetchTrending(region);
  if(!videos.length) return res.status(200).json({ videos:[{ title:'暂无法获取', link:'#', channel:'提示', description:'请稍后重试', thumbnail:'' }] });
  res.status(200).json({ videos });
}