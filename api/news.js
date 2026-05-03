// 免费 RSS 抓取新闻，作为 /api/news 接口
const FEEDS = {
  科技:   'https://feeds.feedburner.com/36kr/news/all',
  财经:   'https://wallstreetcn.com/feed',
  人工智能:'https://www.jiqizhixin.com/rss',
  体育:   'https://rss.sina.com.cn/news/china/focus15.xml',
  健康:   'https://rss.sina.com.cn/news/health/focus15.xml',
  社会民生:'https://rss.sina.com.cn/news/society/focus15.xml',
  汽车:   'https://rss.sina.com.cn/news/auto/focus15.xml',
  教育:   'https://rss.sina.com.cn/news/edu/focus15.xml',
};

// 通用备用源（关键词搜索用）
const FALLBACK = 'https://rss.sina.com.cn/news/china/focus15.xml';

function stripHtml(str) {
  return (str || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function parseRSS(xml) {
  const items = [];
  const blocks = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
  for (const block of blocks.slice(0, 8)) {
    const get = (tag) => {
      const m = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
      return m ? stripHtml(m[1] || m[2] || '') : '';
    };
    const title = get('title');
    const summary = get('description') || get('summary');
    const source = (xml.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '综合';
    if (title) items.push({ title, summary: summary.slice(0, 150), source: stripHtml(source).slice(0, 20) });
  }
  return items;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { topic, kw } = req.query;
  const feedUrl = FEEDS[topic] || FALLBACK;

  try {
    const r = await fetch(feedUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const xml = await r.text();
    let items = parseRSS(xml);

    // 关键词过滤
    if (kw && kw !== topic) {
      const kwLower = kw.toLowerCase();
      const filtered = items.filter(i =>
        i.title.toLowerCase().includes(kwLower) ||
        i.summary.toLowerCase().includes(kwLower)
      );
      if (filtered.length >= 2) items = filtered;
    }

    res.status(200).json({ news: items.slice(0, 5) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
