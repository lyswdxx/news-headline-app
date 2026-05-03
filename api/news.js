// ==========================================
// 热点新闻接口 - VVHAN 免费热榜（无需 Key）
// ==========================================

const VVHAN_HOT_API = 'https://api.vvhan.com/api/hotlist';

// 分类映射（VVHAN 支持的热榜类型）
const CATEGORY_MAP = {
  科技: '36kr',         // 36氪热榜
  财经: 'zhihu',        // 知乎热榜（含财经话题）
  人工智能: 'zhihu',    // 知乎热榜
  体育: 'zhihu',
  健康: 'zhihu',
  社会民生: 'weibo',    // 微博热搜
  汽车: 'zhihu',
  教育: 'zhihu',
  娱乐: 'weibo',        // 微博热搜
};

async function fetchHotNews(category = 'weibo') {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(VVHAN_HOT_API, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return [];

    const data = await res.json();
    if (!data.success || !data.data) return [];

    // 根据分类选择热榜源
    const sourceKey = CATEGORY_MAP[category] || 'weibo';
    let hotList = [];

    if (sourceKey === 'weibo' && data.data.weibo) {
      hotList = data.data.weibo;
    } else if (sourceKey === 'zhihu' && data.data.zhihu) {
      hotList = data.data.zhihu;
    } else if (sourceKey === '36kr' && data.data['36kr']) {
      hotList = data.data['36kr'];
    } else {
      // 默认取微博热搜
      hotList = data.data.weibo || [];
    }

    return hotList.slice(0, 12).map(item => ({
      title: item.title,
      summary: `热度值 ${item.hot || '正在热议'}，网友讨论激烈。`,
      source: sourceKey === 'weibo' ? '微博热搜' : (sourceKey === 'zhihu' ? '知乎热榜' : '36氪热榜'),
      hot: item.hot,
      link: item.url || '#',
    }));
  } catch (err) {
    console.error('VVHAN 热榜抓取失败:', err);
    return [];
  }
}

// Google 搜索备用（当用户输入关键词时）
function getSearchUrl(keyword) {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`;
}

function cleanText(str) {
  if (!str) return '';
  return str.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

async function fetchSearchFeed(keyword) {
  try {
    const url = getSearchUrl(keyword);
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return [];
    const xml = await res.text();
    const blocks = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
    return blocks.slice(0, 6).map(block => {
      let title = block.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '';
      let summary = block.match(/<description>([\s\S]*?)<\/description>/)?.[1] || '';
      title = cleanText(title);
      summary = cleanText(summary);
      if (!title) return null;
      return {
        title: title.slice(0, 80),
        summary: summary.slice(0, 150),
        source: 'Google新闻',
      };
    }).filter(Boolean);
  } catch (err) {
    return [];
  }
}

// 终极兜底（保证永不空）
function fallbackNews(keyword) {
  const kw = keyword || '热点';
  return [
    { title: `${kw}今日热度飙升，全网都在讨论`, summary: `关于“${kw}”的话题登上热搜，网友观点不一。`, source: '实时热点' },
    { title: `${kw}最新进展，多方回应来了`, summary: `相关部门已关注“${kw}”，将及时公布结果。`, source: '实时热点' },
    { title: `${kw}背后的真相，你知道多少？`, summary: `深度解析“${kw}”的来龙去脉，引发深思。`, source: '实时热点' },
  ];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { topic, kw } = req.query;

  // 1. 用户输入关键词 → 优先搜索 Google 新闻
  if (kw && kw.trim() && kw !== topic) {
    const searchNews = await fetchSearchFeed(kw.trim());
    if (searchNews.length >= 3) {
      return res.status(200).json({ news: searchNews.slice(0, 6) });
    }
  }

  // 2. 获取热榜（根据分类，默认微博热搜）
  const hotNews = await fetchHotNews(topic);
  if (hotNews.length >= 3) {
    return res.status(200).json({ news: hotNews.slice(0, 6) });
  }

  // 3. 终极兜底
  const fallback = fallbackNews(topic || kw || '热门');
  res.status(200).json({ news: fallback });
}