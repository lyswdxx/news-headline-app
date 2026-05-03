// =========================
// 永不空数据新闻接口（Vercel版）- 增强清洗
// =========================

// 多源配置
const SOURCES = {
  search: (kw) => [
    `https://news.google.com/rss/search?q=${encodeURIComponent(kw)}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`
  ],
  category: {
    科技: [
      'https://feeds.feedburner.com/TechCrunch',
      'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml'
    ],
    财经: [
      'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml'
    ],
    人工智能: [
      'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml'
    ],
    体育: [
      'https://www.espn.com/espn/rss/news'
    ],
    健康: [
      'https://rss.nytimes.com/services/xml/rss/nyt/Health.xml'
    ],
    社会民生: [
      'https://feeds.bbci.co.uk/news/world/rss.xml'
    ],
    汽车: [
      'https://www.autoblog.com/rss.xml'
    ],
    教育: [
      'https://www.chronicle.com/rss/news'
    ],
    娱乐: [
      'https://rss.cnn.com/services/rss/edition_entertainment.rss'
    ]
  },
  backup: [
    'https://feeds.bbci.co.uk/news/rss.xml',
    'https://rss.cnn.com/rss/edition.rss'
  ]
};

// ========== 强化清洗函数 ==========
function cleanText(str) {
  if (!str) return '';
  let text = str;

  // 1. 解码 HTML 实体（关键！解决 &lt;a&gt; 显示为标签文本的问题）
  text = text.replace(/&lt;/g, '<')
             .replace(/&gt;/g, '>')
             .replace(/&amp;/g, '&')
             .replace(/&quot;/g, '"')
             .replace(/&#39;/g, "'")
             .replace(/&nbsp;/g, ' ')
             .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));

  // 2. 移除所有 HTML 标签（包括刚解码出来的 <a>、<img> 等）
  text = text.replace(/<[^>]*>/g, ' ');

  // 3. 移除 CDATA 标记
  text = text.replace(/<!\[CDATA\[|\]\]>/g, '');

  // 4. 压缩空白字符
  text = text.replace(/\s+/g, ' ').trim();

  // 5. 过滤常见推广语（可选）
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
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/rss+xml, application/xml'
      },
      signal: controller.signal
    });

    clearTimeout(timeout);
    if (!res.ok) return [];

    const xml = await res.text();

    const blocks =
      xml.match(/<item>([\s\S]*?)<\/item>/g) ||
      xml.match(/<entry>([\s\S]*?)<\/entry>/g) ||
      [];

    return blocks.slice(0, 8).map(block => {
      const get = (tag) =>
        block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))?.[1] || '';

      let title = get('title');
      let summary = get('description') || get('summary') || get('content');

      // 强力清洗
      title = cleanText(title);
      summary = cleanText(summary);

      if (!title) return null;

      return {
        title: title.slice(0, 80),
        summary: summary.slice(0, 200),
        source: new URL(url).hostname.replace(/^www\./, '')
      };
    }).filter(Boolean);

  } catch (err) {
    console.error(`抓取失败 ${url}:`, err.message);
    return [];
  }
}

// 兜底数据（保证永不空）
function fallbackNews(topic, kw) {
  const base = kw || topic || '热点';

  return [
    {
      title: `${base}最新动态持续更新`,
      summary: `当前${base}相关资讯正在整理中，建议稍后刷新获取更完整信息。`,
      source: '系统'
    },
    {
      title: `${base}关注度持续上升`,
      summary: `业内对${base}的关注正在增加，更多信息正在陆续发布。`,
      source: '系统'
    },
    {
      title: `${base}领域迎来新变化`,
      summary: `围绕${base}的相关动态持续更新中，建议保持关注。`,
      source: '系统'
    }
  ];
}

// 聚合逻辑（核心）
async function aggregateNews({ topic, kw }) {
  let pool = [];

  // 1️⃣ 关键词优先
  if (kw && kw.trim()) {
    for (const url of SOURCES.search(kw.trim())) {
      const data = await fetchFeed(url);
      pool.push(...data);
      if (pool.length >= 5) break;
    }
  }

  // 2️⃣ 分类补充
  if (pool.length < 5) {
    const feeds = SOURCES.category[topic] || [];
    for (const url of feeds) {
      const data = await fetchFeed(url);
      pool.push(...data);
      if (pool.length >= 8) break;
    }
  }

  // 3️⃣ 备用兜底
  if (pool.length < 5) {
    for (const url of SOURCES.backup) {
      const data = await fetchFeed(url);
      pool.push(...data);
      if (pool.length >= 6) break;
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

  // 最终兜底（关键）
  if (unique.length < 3) {
    return fallbackNews(topic, kw);
  }

  return unique.slice(0, 6);
}

// =========================
// API入口
// =========================
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { topic, kw } = req.query;
    const news = await aggregateNews({ topic, kw });
    res.status(200).json({ news });
  } catch (err) {
    // 极端兜底（永不报错）
    console.error('聚合异常:', err);
    res.status(200).json({
      news: fallbackNews('热点')
    });
  }
}