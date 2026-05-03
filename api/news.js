// 稳定 RSS 源（均为国际可访问，无需代理）
const FEEDS = {
  科技: [
    'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml',
    'https://feeds.feedburner.com/TechCrunch',
  ],
  财经: [
    'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml',
    'https://feeds.bloomberg.com/markets/news.rss',
  ],
  人工智能: [
    'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml',
    'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',
  ],
  体育: [
    'https://rss.nytimes.com/services/xml/rss/nyt/Sports.xml',
    'https://www.espn.com/espn/rss/news',
  ],
  健康: [
    'https://rss.nytimes.com/services/xml/rss/nyt/Health.xml',
    'https://www.who.int/feeds/entity/news-room/feature-stories/zh/rss.xml',
  ],
  社会民生: [
    'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
    'https://feeds.bbc.co.uk/news/world/rss.xml',
  ],
  汽车: [
    'https://www.autoblog.com/rss.xml',
    'https://www.caranddriver.com/news/rss',
  ],
  教育: [
    'https://rss.nytimes.com/services/xml/rss/nyt/Education.xml',
    'https://www.chronicle.com/rss/news',
  ],
};
// 通用备用源（全球通用）
const FALLBACK = [
  'https://feeds.bbci.co.uk/news/world/rss.xml',
  'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
];

// 清理 HTML 标签，同时过滤常见推广语
function cleanText(str) {
  if (!str) return '';
  let text = str.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  // 过滤微信公众号/推广语
  text = text.replace(/欢迎关注.*?微信公众号.*?（微信号：.*?）。*$/g, '')
             .replace(/更多精彩内容.*$/g, '')
             .replace(/第一时间为您奉上.*$/g, '')
             .replace(/点击.*?了解更多.*$/g, '')
             .trim();
  return text;
}

async function fetchFeed(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const xml = await res.text();
    const items = [];
    // 匹配标准 RSS <item> 或 Atom <entry>
    const blocks = xml.match(/<item>([\s\S]*?)<\/item>/g) || xml.match(/<entry>([\s\S]*?)<\/entry>/g) || [];
    for (const block of blocks.slice(0, 8)) {
      let title = (block.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '');
      let summary = (block.match(/<description>([\s\S]*?)<\/description>/)?.[1] ||
                     block.match(/<summary>([\s\S]*?)<\/summary>/)?.[1] || '');
      title = cleanText(title);
      summary = cleanText(summary);
      if (title) {
        items.push({
          title: title.slice(0, 80),
          summary: summary.slice(0, 200),
          source: new URL(url).hostname.replace(/^www\./, ''),
        });
      }
    }
    return items;
  } catch (err) {
    console.error(`抓取失败 ${url}:`, err.message);
    return [];
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { topic, kw } = req.query;
  let feeds = FEEDS[topic] || FALLBACK;
  let allItems = [];
  for (const url of feeds) {
    const items = await fetchFeed(url);
    if (items.length) {
      allItems.push(...items);
      if (allItems.length >= 12) break;
    }
  }
  // 如果还是没抓到，返回友好提示
  if (allItems.length === 0) {
    return res.status(200).json({
      news: [{
        title: '暂时无法获取新闻，请稍后重试',
        summary: '可能是网络问题或RSS源临时不可用，建议刷新页面',
        source: '系统提示'
      }]
    });
  }
  // 关键词过滤
  if (kw && kw !== topic && kw.trim() !== '') {
    const kwl = kw.toLowerCase().trim();
    const filtered = allItems.filter(i =>
      i.title.toLowerCase().includes(kwl) || i.summary.toLowerCase().includes(kwl)
    );
    if (filtered.length > 0) allItems = filtered;
  }
  // 去重
  const unique = [];
  const seen = new Set();
  for (const item of allItems) {
    if (!seen.has(item.title)) {
      seen.add(item.title);
      unique.push(item);
    }
  }
  res.status(200).json({ news: unique.slice(0, 6) });
}