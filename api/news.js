// ==========================================
// 热点聚合接口：Google + 天行 + VVHAN 三方合并
// ==========================================

const API_BASE = 'https://apis.tianapi.com';
const apiKey = process.env.TIAN_API_KEY;
const VVHAN_API = 'https://api.vvhan.com/api/hotlist';

// 分类 → 天行接口路径 映射表
const CATEGORY_API = {
  科技: '/it/index',
  财经: '/internet/index',
  人工智能: '/ai/index',
  体育: '/internet/index',
  健康: '/internet/index',
  社会民生: '/guonei/index',
  汽车: '/internet/index',
  教育: '/internet/index',
  娱乐: '/huabian/index',
  旅游: '/travel/index',
};
const DEFAULT_API = '/guonei/index';

// ========== 1. Google 新闻搜索 ==========
function getSearchUrl(keyword) {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`;
}

function cleanText(str) {
  if (!str) return '';
  return str.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

async function fetchGoogleNews(keyword) {
  try {
    const url = getSearchUrl(keyword);
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return [];
    const xml = await res.text();
    const blocks = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
    return blocks.slice(0, 10).map(block => {
      let title = block.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '';
      let summary = block.match(/<description>([\s\S]*?)<\/description>/)?.[1] || '';
      title = cleanText(title);
      summary = cleanText(summary);
      if (!title) return null;
      return {
        title: title.slice(0, 80),
        summary: summary.slice(0, 150),
        source: 'Google新闻',
        hot: 0,  // 无热度值，排后面
      };
    }).filter(Boolean);
  } catch (err) {
    return [];
  }
}

// ========== 2. 天行 API ==========
async function fetchTianApi(apiPath, num = 15) {
  if (!apiKey) return [];
  try {
    const url = `${API_BASE}${apiPath}?key=${apiKey}&num=${num}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return [];
    const data = await res.json();
    if (data.code !== 200) return [];
    return data.newslist.map(item => ({
      title: item.title,
      summary: item.description || item.content || '',
      source: item.source || '天行数据',
      hot: parseInt(item.hot) || 0,
    }));
  } catch (err) {
    return [];
  }
}

// ========== 3. VVHAN 热榜（微博/知乎/36氪） ==========
async function fetchVvhanHot(source = 'weibo') {
  try {
    const res = await fetch(VVHAN_API, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.success) return [];
    
    let hotList = [];
    if (source === 'weibo' && data.data.weibo) hotList = data.data.weibo;
    else if (source === 'zhihu' && data.data.zhihu) hotList = data.data.zhihu;
    else if (source === '36kr' && data.data['36kr']) hotList = data.data['36kr'];
    else hotList = data.data.weibo || [];
    
    return hotList.slice(0, 15).map(item => ({
      title: item.title,
      summary: `热度值 ${item.hot || '飙升中'}，网友热议。`,
      source: source === 'weibo' ? '微博热搜' : (source === 'zhihu' ? '知乎热榜' : '36氪热榜'),
      hot: parseInt(item.hot) || 0,
    }));
  } catch (err) {
    return [];
  }
}

// ========== 4. 主聚合函数 ==========
async function aggregateNews({ topic, kw, limit = 6 }) {
  let allNews = [];
  const limitNum = Math.min(parseInt(limit) || 6, 20);
  
  // 并行抓取所有源
  const promises = [];
  
  // 有关键词时抓 Google
  if (kw && kw.trim()) {
    promises.push(fetchGoogleNews(kw.trim()));
  }
  
  // 天行 API（根据分类）
  const apiPath = CATEGORY_API[topic] || DEFAULT_API;
  promises.push(fetchTianApi(apiPath, 15));
  
  // VVHAN 热榜（根据分类决定源）
  let vvhanSource = 'weibo';
  if (topic === '科技') vvhanSource = '36kr';
  else if (['财经', '人工智能', '体育', '健康', '汽车', '教育', '旅游'].includes(topic)) vvhanSource = 'zhihu';
  else vvhanSource = 'weibo';
  promises.push(fetchVvhanHot(vvhanSource));
  
  // 等待所有请求完成
  const results = await Promise.allSettled(promises);
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.length) {
      allNews.push(...r.value);
    }
  }
  
  // 去重（按标题）
  const unique = [];
  const seen = new Set();
  for (const item of allNews) {
    if (!seen.has(item.title)) {
      seen.add(item.title);
      unique.push(item);
    }
  }
  
  // 按热度排序（热度高的在前）
  unique.sort((a, b) => (b.hot || 0) - (a.hot || 0));
  
  // 返回指定数量
  if (unique.length >= limitNum) return unique.slice(0, limitNum);
  
  // 兜底数据
  const kwText = kw || topic || '热点';
  return [
    { title: `${kwText}最新动态`, summary: `关于“${kwText}”的资讯正在加载，请稍后刷新。`, source: '系统', hot: 0 },
    { title: `${kwText}关注度上升`, summary: `“${kwText}”相关话题讨论量增加，建议持续关注。`, source: '系统', hot: 0 },
  ];
}

// ========== 5. API 入口 ==========
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { topic, kw, limit = 6 } = req.query;
  
  try {
    const news = await aggregateNews({ topic, kw, limit });
    res.status(200).json({ news });
  } catch (err) {
    console.error('聚合失败:', err);
    res.status(200).json({ news: [{ title: '热点加载中', summary: '请稍后刷新', source: '系统' }] });
  }
}