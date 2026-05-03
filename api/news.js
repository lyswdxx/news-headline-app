// =========================
// 热点新闻接口 - 天行热榜 + Google 搜索
// =========================

const TIAN_API_BASE = 'https://api.tianapi.com/hotnews';

// 获取天行热榜（实时热门事件）
async function getHotNewsFromTian() {
  const apiKey = process.env.TIAN_API_KEY;
  if (!apiKey) {
    console.warn('未配置 TIAN_API_KEY，跳过热榜');
    return [];
  }
  try {
    const url = `${TIAN_API_BASE}/?key=${apiKey}&num=20`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return [];
    const data = await res.json();
    if (data.code !== 200) return [];
    return data.newslist.map(item => ({
      title: item.title,
      summary: item.description || item.content || '热点事件，网友讨论激烈',
      source: item.source || item.author || '天行热榜',
      hot: item.hot || '',
      link: item.url || '',
    }));
  } catch (err) {
    console.error('天行热榜抓取失败:', err);
    return [];
  }
}

// Google 新闻搜索（作为备用）
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

// 兜底模拟热门数据（防止完全空）
function mockHotNews(keyword) {
  const kw = keyword || '热点';
  return [
    { title: `${kw}引发全网热议，网友观点两极分化`, summary: `关于“${kw}”的讨论迅速登上热搜，各方激烈交锋。`, source: '模拟热榜' },
    { title: `${kw}最新进展：官方回应来了`, summary: `刚刚，相关部门就“${kw}”作出回应，网友直呼痛快。`, source: '模拟热榜' },
    { title: `惊！${kw}背后真相曝光`, summary: `深度分析“${kw}”来龙去脉，很多细节首次披露。`, source: '模拟热榜' },
    { title: `${kw}这些内幕你可能不知道`, summary: `业内人士爆料，“${kw}”还有这一面。`, source: '模拟热榜' },
  ];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { topic, kw } = req.query;
  let news = [];

  // 1. 如果用户输入了关键词，优先搜索 Google 新闻
  if (kw && kw !== topic && kw.trim()) {
    news = await fetchSearchFeed(kw.trim());
    if (news.length >= 3) {
      return res.status(200).json({ news: news.slice(0, 6) });
    }
  }

  // 2. 否则（无关键词或搜索失败）返回天行热榜
  const hotNews = await getHotNewsFromTian();
  if (hotNews.length >= 3) {
    return res.status(200).json({ news: hotNews.slice(0, 6) });
  }

  // 3. 如果所有真实源都失败，返回模拟热点数据（保证不空）
  const mockNews = mockHotNews(topic || kw || '热门');
  res.status(200).json({ news: mockNews.slice(0, 6) });
}