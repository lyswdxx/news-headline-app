// =========================
// 热点新闻接口（Vercel版）- 增加高热源
// =========================

const RSSHUB = 'https://rsshub.app';

// 热度源配置（话题性强，容易传播）
const HOT_SOURCES = [
  `${RSSHUB}/weibo/search/hot`,           // 微博热搜榜
  `${RSSHUB}/zhihu/hotlist`,              // 知乎热榜
  `${RSSHUB}/douyin/hot`,                 // 抖音热点
  `${RSSHUB}/baidu/hot`,                  // 百度热搜
  `${RSSHUB}/toutiao/hot`,                // 今日头条热榜
  `${RSSHUB}/sina/ent`,                   // 新浪娱乐
  `${RSSHUB}/163/news/ent`,               // 网易娱乐
  `${RSSHUB}/qq/ent/news`,                // 腾讯娱乐
  `${RSSHUB}/36kr/newsflashes`,           // 36氪快讯（科技热点）
  `${RSSHUB}/huxiu/index`,                // 虎嗅
];

// 分类专用源（保留原有，但可以用热度源覆盖）
const CATEGORY_FALLBACK = {
  科技: [`${RSSHUB}/36kr/newsflashes`, `${RSSHUB}/huxiu/index`, 'https://feeds.feedburner.com/TechCrunch'],
  财经: [`${RSSHUB}/wallstreetcn/latest`, 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml'],
  人工智能: [`${RSSHUB}/36kr/newsflashes/ai`, `${RSSHUB}/leiphone/ai`, 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml'],
  体育: [`${RSSHUB}/qq/sports/news`, `${RSSHUB}/sina/sports`, 'https://www.espn.com/espn/rss/news'],
  健康: [`${RSSHUB}/health/163/news`, 'https://rss.nytimes.com/services/xml/rss/nyt/Health.xml'],
  社会民生: [`${RSSHUB}/society/163/news`, `${RSSHUB}/chinanews/sh`, 'https://feeds.bbc.co.uk/news/world/rss.xml'],
  汽车: [`${RSSHUB}/autohome/news`, `${RSSHUB}/dongchedi/latest`, 'https://www.autoblog.com/rss.xml'],
  教育: [`${RSSHUB}/edu/sina/news`, 'https://www.chronicle.com/rss/news'],
  娱乐: [`${RSSHUB}/qq/ent/news`, `${RSSHUB}/163/news/ent`, `${RSSHUB}/sina/ent`, 'https://rss.cnn.com/services/rss/edition_entertainment.rss'],
};

// 搜索源（Google News 中文）
function getSearchUrl(keyword) {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`;
}

// 强化清洗：解码实体 + 移除标签
function cleanText(str) {
  if (!str) return '';
  let text = str;
  text = text.replace(/&lt;/g, '<')
             .replace(/&gt;/g, '>')
             .replace(/&amp;/g, '&')
             .replace(/&quot;/g, '"')
             .replace(/&#39;/g, "'")
             .replace(/&nbsp;/g, ' ')
             .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
  text = text.replace(/<[^>]*>/g, ' ');
  text = text.replace(/<!\[CDATA\[|\]\]>/g, '');
  text = text.replace(/\s+/g, ' ').trim();
  text = text.replace(/欢迎关注.*?微信公众号.*?（微信号：.*?）。*$/g, '')
             .replace(/更多精彩内容.*$/g, '')
             .replace(/第一时间为您奉上.*$/g, '')
             .replace(/点击.*?了解更多.*$/g, '');
  return text;
}

// 抓取 RSS
async function fetchFeed(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/rss+xml,application/xml' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const xml = await res.text();
    const blocks = xml.match(/<item>([\s\S]*?)<\/item>/g) || xml.match(/<entry>([\s\S]*?)<\/entry>/g) || [];
    return blocks.slice(0, 10).map(block => {
      const get = (tag) => block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))?.[1] || '';
      let title = get('title');
      let summary = get('description') || get('summary') || get('content');
      title = cleanText(title);
      summary = cleanText(summary);
      if (!title) return null;
      return {
        title: title.slice(0, 80),
        summary: summary.slice(0, 200),
        source: new URL(url).hostname.replace(/^www\./, ''),
      };
    }).filter(Boolean);
  } catch (err) {
    console.error(`抓取失败 ${url}:`, err.message);
    return [];
  }
}

// 兜底热度数据（保证界面不空）
function hotFallbackNews(topic, kw) {
  const base = kw || topic || '热点';
  // 模拟一些容易引发评论的话题
  return [
    { title: `${base}引发全网热议，网友吵翻了`, summary: `关于“${base}”的讨论迅速登上热搜，各方观点激烈交锋。`, source: '热度模拟' },
    { title: `${base}最新进展，网友直呼意外`, summary: `刚刚，“${base}”出现新转折，相关话题阅读量破亿。`, source: '热度模拟' },
    { title: `${base}背后真相揭秘`, summary: `深度分析“${base}”来龙去脉，很多细节首次曝光。`, source: '热度模拟' },
    { title: `知名人士谈${base}：我也没想到`, summary: `某大V评价“${base}”事件，评论区瞬间炸锅。`, source: '热度模拟' },
  ];
}

// 聚合逻辑：关键词优先 > 分类热度源 > 通用热度源 > 备用国际 > 兜底
async function aggregateNews({ topic, kw }) {
  let pool = [];

  // 1. 关键词搜索（用户主动输入）
  if (kw && kw.trim() && kw !== topic) {
    const searchUrl = getSearchUrl(kw.trim());
    const items = await fetchFeed(searchUrl);
    pool.push(...items);
    if (pool.length >= 5) return pool.slice(0, 6);
    // 如果搜索不够，继续往下补充热度源
  }

  // 2. 分类专用热度源（优先）
  const categoryFeeds = CATEGORY_FALLBACK[topic] || [];
  for (const url of categoryFeeds) {
    const items = await fetchFeed(url);
    pool.push(...items);
    if (pool.length >= 8) break;
  }

  // 3. 通用热度源（微博、知乎、抖音等）
  if (pool.length < 6) {
    for (const url of HOT_SOURCES) {
      const items = await fetchFeed(url);
      pool.push(...items);
      if (pool.length >= 10) break;
    }
  }

  // 4. 最后备用国际源（避免完全空白）
  if (pool.length < 3) {
    const backups = [
      'https://feeds.bbci.co.uk/news/rss.xml',
      'https://rss.cnn.com/rss/edition.rss'
    ];
    for (const url of backups) {
      const items = await fetchFeed(url);
      pool.push(...items);
      if (pool.length >= 5) break;
    }
  }

  // 去重
  const unique = [];
  const seen = new Set();
  for (const item of pool) {
    if (!seen.has(item.title)) {
      seen.add(item.title);
      unique.push(item);
    }
  }

  if (unique.length < 3) {
    return hotFallbackNews(topic, kw);
  }
  return unique.slice(0, 6);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const { topic, kw } = req.query;
    const news = await aggregateNews({ topic, kw });
    res.status(200).json({ news });
  } catch (err) {
    console.error('API异常:', err);
    res.status(200).json({ news: hotFallbackNews('热点') });
  }
}