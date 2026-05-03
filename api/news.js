// 稳定 RSS 源（海外可访问，主题匹配）
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
  娱乐: [
    'https://rss.cnn.com/services/rss/entertainment/',
    'https://feeds.feedburner.com/ew/inside-tv',
    'https://www.tmz.com/rss.xml',
    'https://www.eonline.com/rss/news',
    // 中文娱乐：使用 Google News RSS 搜索关键词（返回的内容会自动清理 HTML）
    'https://news.google.com/rss/search?q=%E9%A6%99%E6%B8%AF%E5%A8%B1%E4%B9%90&hl=zh-CN&gl=CN&ceid=CN:zh-Hans',
    'https://news.google.com/rss/search?q=%E9%A6%99%E6%B8%AF%E6%98%8E%E6%98%9F&hl=zh-CN&gl=CN&ceid=CN:zh-Hans',
  ],
};

// 分类专用备用（避免降级到不相关源）
const CATEGORY_FALLBACK = {
  娱乐: [
    'https://rss.cnn.com/services/rss/entertainment/',
    'https://news.google.com/rss/search?q=%E5%A8%B1%E4%B9%90&hl=zh-CN&gl=CN&ceid=CN:zh-Hans',
  ],
};

// 全局备用（仅当分类源和专用备用都失败时使用，娱乐分类不会走到这里）
const GLOBAL_FALLBACK = [
  'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
  'https://feeds.bbci.co.uk/news/world/rss.xml',
];

// 强化清理函数：移除 HTML 标签、解码 HTML 实体、删除多余空白
function cleanText(str) {
  if (!str) return '';
  // 1. 替换常见的 HTML 实体
  let text = str.replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&nbsp;/g, ' ');
  // 2. 移除所有 HTML 标签（包括 <a>、<br>、<img> 等）
  text = text.replace(/<[^>]*>/g, ' ');
  // 3. 移除 CDATA 标记
  text = text.replace(/<!\[CDATA\[|\]\]>/g, '');
  // 4. 压缩空白字符并去除首尾空格
  text = text.replace(/\s+/g, ' ').trim();
  // 5. 过滤常见的推广语
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
    for (const block of blocks.slice(0, 8)) {
      let title = (block.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '');
      let summary = (block.match(/<description>([\s\S]*?)<\/description>/)?.[1] ||
                     block.match(/<summary>([\s\S]*?)<\/summary>/)?.[1] || '');
      // 应用强力清理
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
  
  let feeds = FEEDS[topic] || [];
  let allItems = [];
  
  // 抓取分类主源
  for (const url of feeds) {
    const items = await fetchFeed(url);
    if (items.length) {
      allItems.push(...items);
      if (allItems.length >= 12) break;
    }
  }
  
  // 如果主源失败，尝试分类专用备用
  if (allItems.length === 0 && CATEGORY_FALLBACK[topic]) {
    for (const url of CATEGORY_FALLBACK[topic]) {
      const items = await fetchFeed(url);
      if (items.length) {
        allItems.push(...items);
        if (allItems.length >= 6) break;
      }
    }
  }
  
  // 非娱乐分类才允许使用全局备用（避免娱乐拿到不相关新闻）
  if (allItems.length === 0 && topic !== '娱乐') {
    for (const url of GLOBAL_FALLBACK) {
      const items = await fetchFeed(url);
      if (items.length) {
        allItems.push(...items);
        if (allItems.length >= 6) break;
      }
    }
  }
  
  if (allItems.length === 0) {
    return res.status(200).json({
      news: [{
        title: '暂时无法获取娱乐新闻，请稍后重试',
        summary: '可能是网络问题或RSS源临时不可用，建议刷新页面或更换关键词',
        source: '系统提示'
      }]
    });
  }
  
  // 关键词过滤（用户输入的 kw）
  if (kw && kw !== topic && kw.trim() !== '') {
    const kwl = kw.toLowerCase().trim();
    const filtered = allItems.filter(i =>
      i.title.toLowerCase().includes(kwl) || i.summary.toLowerCase().includes(kwl)
    );
    if (filtered.length > 0) {
      allItems = filtered;
    } else {
      return res.status(200).json({
        news: [{
          title: `未找到与“${kw}”相关的娱乐新闻`,
          summary: '请尝试其他关键词或稍后重试',
          source: '系统提示'
        }]
      });
    }
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