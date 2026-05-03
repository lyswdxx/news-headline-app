// ==========================================
// 视频 + 热点聚合（Vercel 可用版）
// ==========================================

// RSSHub 公共池（境外相对稳定）
const RSSHUB_PROXIES = [
  'https://rsshub.app',
  'https://rsshub.uneies.com',
  'https://rsshub.bili.xyz'
];

const BILI_RANKING = 'https://api.bilibili.com/x/web-interface/ranking/v2?rid=0&type=all';

// 清洗文本
function cleanText(str) {
  if (!str) return '';
  return str.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

// 方案 A：RSSHub 抓 B 站热门（不带 Cookie 也能用）
async function fetchBiliViaRSSHub(keyword = '') {
  for (const proxy of RSSHUB_PROXIES) {
    try {
      const url = `${proxy}/bilibili/popular/all`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (!res.ok) continue;

      const xml = await res.text();
      const items = [];
      const blocks = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];

      for (const block of blocks) {
        let title = block.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '';
        let link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '';
        let author = block.match(/<author>([\s\S]*?)<\/author>/)?.[1] || '';

        title = cleanText(title);
        if (keyword && !title.includes(keyword)) continue;

        if (title && link) {
          items.push({
            title: title.slice(0, 80),
            link: link,
            channel: author || 'B站UP主',
            published: new Date().toISOString(),
            description: title,
            thumbnail: ''
          });
        }
        if (items.length >= 8) break;
      }

      if (items.length) return items;
    } catch (e) {
      console.warn('RSSHub失败', e.message);
    }
  }
  return [];
}

// 方案 B：B站排行榜（加反风控头）
async function fetchBiliRanking(keyword = '') {
  try {
    const res = await fetch(BILI_RANKING, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.bilibili.com/',
        'Origin': 'https://www.bilibili.com',
        'Accept': 'application/json, text/plain, */*'
      }
    });

    const data = await res.json();
    if (data.code !== 0) return [];

    let videos = data.data?.list || [];
    if (keyword) {
      videos = videos.filter(v => v.title.includes(keyword));
      if (!videos.length) return [];
    }

    return videos.slice(0, 8).map(v => ({
      title: v.title,
      link: `https://www.bilibili.com/video/${v.bvid}`,
      channel: v.owner?.name || 'B站UP主',
      published: new Date().toISOString(),
      description: v.desc || '',
      thumbnail: v.pic || '',
      stat: v.stat?.view || 0
    }));
  } catch (err) {
    return [];
  }
}

// 兜底数据（高质量、有热度的真实感内容）
const FALLBACK_VIDEOS = [
  { title: '五一旅游“特种兵”爆火，三天玩转五省', channel: '旅游博主', desc: '年轻人旅行新方式引发热议' },
  { title: '华为Pura 80 Ultra 深度评测，这次真的成了', channel: '数码评测', desc: '影像系统全面升级' },
  { title: '周杰伦杭州演唱会全场大合唱《七里香》', channel: '音乐现场', desc: '前奏一响全场泪崩' },
  { title: '小米SU7交付现场，雷军亲自开车门', channel: '汽车博主', desc: '首批车主提车' },
  { title: 'AI一键生成视频，普通人也能做大片', channel: '科技前沿', desc: 'Sora级模型免费体验' },
  { title: '淄博烧烤持续爆火，本地人排队到凌晨', channel: '美食探店', desc: '热度不减' }
];

function getFallback(keyword) {
  let list = [...FALLBACK_VIDEOS];
  if (keyword) {
    const kw = keyword.toLowerCase();
    list = list.filter(v => v.title.toLowerCase().includes(kw));
    if (list.length === 0) list = [{ title: `${keyword}最新热门视频`, channel: '热点', desc: `${keyword}全网热议` }];
  }
  return list.slice(0, 6).map(v => ({
    title: v.title,
    link: `https://search.bilibili.com?keyword=${encodeURIComponent(v.title)}`,
    channel: v.channel,
    published: new Date().toISOString(),
    description: v.desc,
    thumbnail: ''
  }));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { kw } = req.query;
  const keyword = (kw || '').trim();

  try {
    // 1. RSSHub（最稳）
    let videos = await fetchBiliViaRSSHub(keyword);
    if (videos.length) return res.status(200).json({ videos, source: 'rsshub' });

    // 2. B站排行榜（加头）
    videos = await fetchBiliRanking(keyword);
    if (videos.length) return res.status(200).json({ videos, source: 'bili-ranking' });

    // 3. 最终兜底
    const fallback = getFallback(keyword);
    res.status(200).json({ videos: fallback, source: 'fallback' });
  } catch (err) {
    res.status(200).json({ videos: getFallback('热门'), source: 'error-fallback' });
  }
}