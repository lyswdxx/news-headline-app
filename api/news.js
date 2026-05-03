const CATEGORY_FEEDS = {
  科技: ['https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml', 'https://feeds.feedburner.com/TechCrunch'],
  财经: ['https://rss.nytimes.com/services/xml/rss/nyt/Business.xml', 'https://feeds.bloomberg.com/markets/news.rss'],
  人工智能: ['https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml', 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml'],
  体育: ['https://rss.nytimes.com/services/xml/rss/nyt/Sports.xml', 'https://www.espn.com/espn/rss/news'],
  健康: ['https://rss.nytimes.com/services/xml/rss/nyt/Health.xml', 'https://www.who.int/feeds/entity/news-room/feature-stories/zh/rss.xml'],
  社会民生: ['https://rss.nytimes.com/services/xml/rss/nyt/World.xml', 'https://feeds.bbc.co.uk/news/world/rss.xml'],
  汽车: ['https://www.autoblog.com/rss.xml', 'https://www.caranddriver.com/news/rss'],
  教育: ['https://rss.nytimes.com/services/xml/rss/nyt/Education.xml', 'https://www.chronicle.com/rss/news'],
  娱乐: ['https://rss.cnn.com/services/rss/entertainment/', 'https://feeds.feedburner.com/ew/inside-tv', 'https://www.tmz.com/rss.xml'],
};

function getSearchUrl(keyword) {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`;
}

function cleanText(str) {
  if (!str) return '';
  return str.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
    .replace(/欢迎关注.*?微信公众号.*$/g, '').replace(/更多精彩内容.*$/g, '');
}

async function fetchFeed(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const xml = await res.text();
    const blocks = xml.match(/<item>([\s\S]*?)<\/item>/g) || xml.match(/<entry>([\s\S]*?)<\/entry>/g) || [];
    const items = [];
    for (const block of blocks.slice(0, 10)) {
      let title = block.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '';
      let summary = block.match(/<description>([\s\S]*?)<\/description>/)?.[1] || block.match(/<summary>([\s\S]*?)<\/summary>/)?.[1] || '';
      title = cleanText(title);
      summary = cleanText(summary);
      if (title && title.length > 5) {
        items.push({
          title: title.slice(0, 80),
          summary: summary.slice(0, 200),
          source: new URL(url).hostname.replace(/^www\./, '')
        });
      }
    }
    return items;
  } catch (err) {
    return [];
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { topic, kw } = req.query;
  if (kw && kw !== topic && kw.trim()) {
    const searchUrl = getSearchUrl(kw.trim());
    const items = await fetchFeed(searchUrl);
    if (items.length) {
      const unique = [];
      const seen = new Set();
      for (const i of items) if (!seen.has(i.title)) { seen.add(i.title); unique.push(i); }
      return res.status(200).json({ news: unique.slice(0, 6) });
    } else {
      return res.status(200).json({ news: [{ title: `未找到与“${kw}”相关新闻`, summary: '请尝试其他关键词', source: '系统' }] });
    }
  }
  let feeds = CATEGORY_FEEDS[topic] || [];
  let all = [];
  for (const url of feeds) {
    const items = await fetchFeed(url);
    if (items.length) { all.push(...items); if (all.length >= 12) break; }
  }
  if (!all.length) return res.status(200).json({ news: [{ title: `暂无“${topic}”新闻`, summary: '请稍后重试', source: '系统' }] });
  const unique = [];
  const seen = new Set();
  for (const i of all) if (!seen.has(i.title)) { seen.add(i.title); unique.push(i); }
  res.status(200).json({ news: unique.slice(0, 6) });
}