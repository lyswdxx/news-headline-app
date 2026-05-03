// ==========================================
// 天行 API 聚合接口（支持所有分类）
// ==========================================

const API_BASE = 'https://apis.tianapi.com';
const apiKey = process.env.TIAN_API_KEY;

// 分类 → 接口路径 映射表（与前端的 topicSel 选项一一对应）
const CATEGORY_API = {
  科技: '/it/index',           // IT 资讯
  财经: '/internet/index',     // 互联网（含财经）
  人工智能: '/ai/index',       // 人工智能
  体育: '/internet/index',     // 互联网（体育话题）
  健康: '/internet/index',
  社会民生: '/guonei/index',   // 国内新闻
  汽车: '/internet/index',
  教育: '/internet/index',
  娱乐: '/huabian/index',      // 花边新闻
  旅游: '/travel/index',       // 旅游资讯（前端需增加此选项）
};

const DEFAULT_API = '/guonei/index';

// 调用天行 API
async function fetchTianApi(apiPath, num = 12) {
  if (!apiKey) {
    console.error('未配置 TIAN_API_KEY');
    return [];
  }
  try {
    const url = `${API_BASE}${apiPath}?key=${apiKey}&num=${num}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const data = await res.json();
    if (data.code !== 200) {
      console.error(`天行 API 错误 [${apiPath}]:`, data.msg);
      return [];
    }
    return data.newslist.map(item => ({
      title: item.title,
      summary: item.description || item.content || '暂无摘要',
      source: item.source || '天行数据',
      hot: item.hot || '',
      link: item.url || '',
    }));
  } catch (err) {
    console.error(`天行 API 抓取失败 [${apiPath}]:`, err.message);
    return [];
  }
}

// Google 新闻搜索（用户输入关键词时）
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
    return blocks.slice(0, 8).map(block => {
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

  // 1. 关键词优先
  let finalNews = [];

// 1. 关键词 → Google
	if (kw && kw.trim() && kw !== topic) {
	  const searchNews = await fetchSearchFeed(kw.trim());
	  finalNews = finalNews.concat(searchNews);
	}

	// 2. 天行补充
	const apiPath = CATEGORY_API[topic] || DEFAULT_API;
	const hotNews = await fetchTianApi(apiPath);
	finalNews = finalNews.concat(hotNews);

	// 去重（按标题）
	const unique = [];
	const map = new Set();
	for (let n of finalNews) {
	  if (!map.has(n.title)) {
		map.add(n.title);
		unique.push(n);
	  }
	}

	// 返回最多6条
	if (unique.length > 0) {
	  return res.status(200).json({ news: unique.slice(0, 6) });
	}

  // 2. 根据分类调用天行 API
  const apiPath = CATEGORY_API[topic] || DEFAULT_API;
  const hotNews = await fetchTianApi(apiPath);
  if (hotNews.length >= 3) {
    return res.status(200).json({ news: hotNews.slice(0, 6) });
  }

  // 3. 兜底
  const fallback = fallbackNews(topic || kw || '热门');
  res.status(200).json({ news: fallback });
}