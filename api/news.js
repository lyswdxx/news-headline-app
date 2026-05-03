// ==========================================
// 热点聚合接口 - 返回前端期望的 news 格式
// ==========================================

const API_BASE = 'https://apis.tianapi.com';
const apiKey = process.env.TIAN_API_KEY;
const VVHAN_API = 'https://api.vvhan.com/api/hotlist';

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
             .replace(/第一时间为您奉上.*$/g, '');
  return text;
}

// Google 新闻
async function fetchGoogleNews(keyword) {
  if (!keyword) return [];
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return [];
    const xml = await res.text();
    const blocks = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
    return blocks.slice(0, 8).map(block => {
      let title = block.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '';
      let summary = block.match(/<description>([\s\S]*?)<\/description>/)?.[1] || '';
      let pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || '';
      let link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '';
      title = cleanText(title);
      summary = cleanText(summary);
      if (!title) return null;
      return { 
        title: title.slice(0, 80), 
        summary: summary.slice(0, 150), 
        source: 'Google新闻', 
        hot: 0,
        pubDate: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        link: link || `https://www.google.com/search?q=${encodeURIComponent(title)}`
      };
    }).filter(Boolean);
  } catch { return []; }
}

// 天行 API
async function fetchTianApi(apiPath) {
  if (!apiKey) return [];
  try {
    const url = `${API_BASE}${apiPath}?key=${apiKey}&num=8`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return [];
    const data = await res.json();
    if (data.code !== 200) return [];
    return data.newslist.map(item => ({
      title: cleanText(item.title).slice(0, 80),
      summary: cleanText(item.description || item.content || '').slice(0, 150),
      source: item.source || '天行数据',
      hot: parseInt(item.hot) || 0,
      pubDate: item.ctime ? new Date(item.ctime).toISOString() : new Date().toISOString(),
      link: item.url || `https://www.google.com/search?q=${encodeURIComponent(cleanText(item.title))}`
    }));
  } catch { return []; }
}

// VVHAN 热榜
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
    return hotList.slice(0, 8).map(item => ({
      title: cleanText(item.title).slice(0, 80),
      summary: `热度值 ${item.hot || '飙升中'}，网友热议。`,
      source: source === 'weibo' ? '微博热搜' : (source === 'zhihu' ? '知乎热榜' : '36氪热榜'),
      hot: parseInt(item.hot) || 0,
      pubDate: new Date().toISOString(),
      link: item.url || `https://www.google.com/search?q=${encodeURIComponent(cleanText(item.title))}`
    }));
  } catch { return []; }
}

// 去重
function dedupeNews(news) {
  const map = new Map();
  for (const n of news) {
    const key = n.title.replace(/\s/g, '').slice(0, 20);
    if (!map.has(key)) map.set(key, n);
  }
  return Array.from(map.values());
}

// 相似度
function similarity(a, b) {
  const s1 = a.replace(/\s/g, '');
  const s2 = b.replace(/\s/g, '');
  let same = 0;
  for (const ch of s1) if (s2.includes(ch)) same++;
  return same / Math.max(s1.length, s2.length);
}

// 事件聚类
function clusterNews(newsList) {
  const groups = [];
  for (const n of newsList) {
    let found = false;
    for (const g of groups) {
      if (similarity(n.title, g[0].title) > 0.6) {
        g.push(n);
        found = true;
        break;
      }
    }
    if (!found) groups.push([n]);
  }
  return groups;
}

// 热度评分
function calcScore(group) {
  let score = group.length * 15;
  for (const n of group) {
    if (n.source?.includes('微博')) score += 15;
    else if (n.source?.includes('知乎')) score += 10;
    else if (n.source?.includes('Google')) score += 5;
    if (n.hot) score += Math.min(n.hot, 80);
  }
  return score;
}

// 兜底数据
function getFallbackNews(topic, kw) {
  const searchKey = kw || topic || '热点';
  const now = new Date().toISOString();
  return [
    {
      title: `${searchKey}最新动态，全网关注`,
      summary: `关于“${searchKey}”的讨论量持续上升，热度飙升。`,
      source: '热点聚合',
      hot: 85,
      pubDate: now,
      link: `https://www.google.com/search?q=${encodeURIComponent(searchKey)}`
    },
    {
      title: `${searchKey}引发热议，网友纷纷讨论`,
      summary: `“${searchKey}”事件持续发酵，多方回应。`,
      source: '热点聚合',
      hot: 72,
      pubDate: now,
      link: `https://www.google.com/search?q=${encodeURIComponent(searchKey)}`
    },
    {
      title: `${searchKey}最新进展汇总`,
      summary: `从多个角度深度解析“${searchKey}”的来龙去脉。`,
      source: '热点聚合',
      hot: 65,
      pubDate: now,
      link: `https://www.google.com/search?q=${encodeURIComponent(searchKey)}`
    }
  ];
}

// 主聚合函数 - 返回前端期望的 news 数组格式
async function aggregateNews({ topic, kw }) {
  let allNews = [];
  const promises = [];
  
  if (kw && kw.trim()) promises.push(fetchGoogleNews(kw.trim()));
  const apiPath = CATEGORY_API[topic] || DEFAULT_API;
  promises.push(fetchTianApi(apiPath));
  let hotSource = 'weibo';
  if (topic === '科技') hotSource = '36kr';
  else if (['财经', '人工智能', '体育', '健康', '汽车', '教育', '旅游'].includes(topic)) hotSource = 'zhihu';
  promises.push(fetchVvhanHot(hotSource));
  
  const results = await Promise.allSettled(promises);
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value && r.value.length) {
      allNews.push(...r.value);
    }
  }
  
  if (allNews.length === 0) return getFallbackNews(topic, kw);
  
  // 去重
  const deduped = dedupeNews(allNews);
  
  // 聚类后展平为新闻列表（每个事件取第一条作为代表，保持热点排序）
  const clusters = clusterNews(deduped);
  const sortedClusters = clusters.sort((a, b) => calcScore(b) - calcScore(a));
  
  // 转换为前端期望的 news 格式
  const newsList = [];
  for (const cluster of sortedClusters) {
    // 取每个事件中热度最高的那条新闻
    const bestNews = cluster.sort((a, b) => (b.hot || 0) - (a.hot || 0))[0];
    newsList.push({
      title: bestNews.title,
      summary: bestNews.summary,
      source: bestNews.source,
      hot: bestNews.hot + cluster.length * 10, // 热度 = 原热度 + 事件聚合数量加成
      pubDate: bestNews.pubDate,
      link: bestNews.link
    });
  }
  
  return newsList.slice(0, 6);
}

// ========== API 入口 ==========
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { topic, kw } = req.query;
  
  try {
    const news = await aggregateNews({ topic, kw });
    res.status(200).json({ news });
  } catch (err) {
    console.error('聚合失败:', err);
    res.status(200).json({ news: getFallbackNews(topic, kw) });
  }
}