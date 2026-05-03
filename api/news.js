// 稳定 RSS 源（分类专用，仅当没有关键词时使用）
const CATEGORY_FEEDS = {
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
  娱乐: [
    'https://rss.cnn.com/services/rss/entertainment/',
    'https://feeds.feedburner.com/ew/inside-tv',
    'https://www.tmz.com/rss.xml',
    'https://www.eonline.com/rss/news',
  ],
};

// 通用搜索源（当用户提供关键词时使用）
// 使用 Google News RSS 搜索，支持中文关键词，返回结果会自动清理 HTML
function getSearchUrl(keyword) {
  const encoded = encodeURIComponent(keyword);
  return `https://news.google.com/rss/search?q=${encoded}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`;
}

// 强化清理 HTML 和实体
function cleanText(str) {
  if (!str) return '';
  let text = str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]*>/g, ' ')   // 移除所有 HTML 标签
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  // 过滤推广语
  text = text.replace(/欢迎关注.*?微信公众号.*?（微信号：.*?）。*$/g, '')
             .replace(/更多精彩内容.*$/g, '')
             .replace(/第一时间为您奉上.*$/g, '')
             .replace(/点击.*?了解更多.*$/g, '');
  return text;
}

async function fetchFeed(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const xml = await res.text();
    const items = [];
    const blocks = xml.match(/<item>([\s\S]*?)<\/item>/g) || xml.match(/<entry>([\s\S]*?)<\/entry>/g) || [];
    for (const block of blocks.slice(0, 10)) {
      let title = (block.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '');
      let summary = (block.match(/<description>([\s\S]*?)<\/description>/)?.[1] ||
                     block.match(/<summary>([\s\S]*?)<\/summary>/)?.[1] || '');
      title = cleanText(title);
      summary = cleanText(summary);
      if (title && title.length > 5) {
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

  // 优先：如果用户提供了关键词（且不为空，不等于分类名），则使用通用新闻搜索
  if (kw && kw !== topic && kw.trim() !== '') {
    const searchUrl = getSearchUrl(kw.trim());
    const items = await fetchFeed(searchUrl);
    if (items.length > 0) {
      // 去重
      const unique = [];
      const seen = new Set();
      for (const item of items) {
        if (!seen.has(item.title)) {
          seen.add(item.title);
          unique.push(item);
        }
      }
      return res.status(200).json({ news: unique.slice(0, 6) });
    } else {
      // 如果搜索失败，尝试使用分类源（但不强制降级到娱乐）
      // 如果分类源也没有，返回友好提示
      return res.status(200).json({
        news: [{
          title: `未找到与“${kw}”相关的新闻`,
          summary: '请尝试其他关键词，或稍后重试。',
          source: '系统提示'
        }]
      });
    }
  }

  // 如果没有关键词，则按照分类抓取
  let feeds = CATEGORY_FEEDS[topic] || [];
  let allItems = [];
  for (const url of feeds) {
    const items = await fetchFeed(url);
    if (items.length) {
      allItems.push(...items);
      if (allItems.length >= 12) break;
    }
  }

  if (allItems.length === 0) {
    return res.status(200).json({
      news: [{
        title: `暂时无法获取“${topic}”分类的新闻`,
        summary: '请稍后重试，或尝试输入关键词搜索。',
        source: '系统提示'
      }]
    });
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