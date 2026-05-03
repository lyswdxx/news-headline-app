// 免费 RSS 抓取新闻，作为 /api/news 接口
const FEEDS = {
  科技: [
    'https://feeds.feedburner.com/36kr/newsall',  // 36氪
    'https://www.ifanr.com/feed',                 // 爱范儿
    'https://rsshub.app/36kr/news/latest'         // RSSHub 36氪
  ],
  财经: [
    'https://rsshub.app/wallstreetcn/latest',     // 华尔街见闻（通过 RSSHub）
    'https://rsshub.app/finance/qq/latest'        // 腾讯财经
  ],
  人工智能: [
    'https://www.jiqizhixin.com/rss',             // 机器之心
    'https://rsshub.app/36kr/newsflashes/ai'      // 36氪 AI
  ],
  体育: [
    'https://rsshub.app/qq/sports/news',          // 腾讯体育
  ],
  健康: [
    'https://rsshub.app/health/163/news',         // 网易健康
  ],
  社会民生: [
    'https://rsshub.app/society/163/news',        // 网易社会
  ],
  汽车: [
    'https://rsshub.app/autohome/news',           // 汽车之家
  ],
  教育: [
    'https://rsshub.app/edu/sina/news',           // 新浪教育（通过 RSSHub）
  ],
};

// 稳定的国际备用源（不会404）
const FALLBACK_FEEDS = [
  'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',      // 纽约时报
  'https://feeds.bbci.co.uk/news/world/rss.xml',                 // BBC
  'https://rss.cnn.com/rss/cnn_world.rss',                       // CNN
  'https://feeds.npr.org/1001/rss.xml',                          // NPR
  'https://www.reddit.com/r/worldnews/.rss',                     // Reddit世界新闻
  'https://news.ycombinator.com/rss',                            // Hacker News
];

function stripHtml(str) {
  if (!str) return '';
  return str.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

async function fetchWithTimeout(url, timeout = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { 
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

function parseRSS(xml, sourceName) {
  const items = [];
  
  // 尝试多种解析方式
  let blocks = xml.match(/<item>([\s\S]*?)<\/item>/g);
  
  // 如果没找到 item，尝试 entry (Atom格式)
  if (!blocks || blocks.length === 0) {
    blocks = xml.match(/<entry>([\s\S]*?)<\/entry>/g);
  }
  
  if (!blocks || blocks.length === 0) {
    return items;
  }
  
  for (const block of blocks.slice(0, 8)) {
    // 多种方式提取标题
    let title = '';
    const titleCDATA = block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/);
    const titleDirect = block.match(/<title>([\s\S]*?)<\/title>/);
    if (titleCDATA) title = titleCDATA[1];
    else if (titleDirect) title = titleDirect[1];
    
    if (!title) continue;
    
    // 提取描述/摘要
    let summary = '';
    const descCDATA = block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/);
    const descDirect = block.match(/<description>([\s\S]*?)<\/description>/);
    const summaryCDATA = block.match(/<summary><!\[CDATA\[([\s\S]*?)\]\]><\/summary>/);
    const summaryDirect = block.match(/<summary>([\s\S]*?)<\/summary>/);
    
    if (descCDATA) summary = descCDATA[1];
    else if (descDirect) summary = descDirect[1];
    else if (summaryCDATA) summary = summaryCDATA[1];
    else if (summaryDirect) summary = summaryDirect[1];
    
    items.push({ 
      title: stripHtml(title).slice(0, 80), 
      summary: stripHtml(summary).slice(0, 200), 
      source: sourceName || '综合'
    });
  }
  
  return items;
}

async function tryFetchFeed(feedUrl, sourceName) {
  try {
    console.log(`尝试抓取: ${feedUrl}`);
    const response = await fetchWithTimeout(feedUrl);
    if (!response.ok) {
      console.log(`HTTP ${response.status}: ${feedUrl}`);
      return null;
    }
    const xml = await response.text();
    const items = parseRSS(xml, sourceName);
    if (items.length > 0) {
      console.log(`成功从 ${feedUrl} 抓取 ${items.length} 条新闻`);
      return items;
    }
    return null;
  } catch (error) {
    console.log(`抓取失败 ${feedUrl}: ${error.message}`);
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { topic, kw } = req.query;
  
  // 获取该分类的feed列表
  let feedsToTry = [];
  if (topic && FEEDS[topic]) {
    feedsToTry = [...FEEDS[topic]];
  }
  // 添加备用源
  feedsToTry.push(...FALLBACK_FEEDS);
  // 去重
  feedsToTry = [...new Set(feedsToTry)];
  
  console.log(`开始抓取分类: ${topic}, 关键词: ${kw || '无'}`);
  
  try {
    let allItems = [];
    
    // 依次尝试各个feed源
    for (const feedUrl of feedsToTry) {
      const sourceName = topic || '综合';
      const items = await tryFetchFeed(feedUrl, sourceName);
      if (items && items.length > 0) {
        allItems.push(...items);
        // 如果已经有足够多的新闻，就停止尝试
        if (allItems.length >= 10) break;
      }
    }
    
    // 如果还是没有新闻，返回模拟数据用于测试
    if (allItems.length === 0) {
      console.log('所有feed源都失败，返回模拟数据');
      return res.status(200).json({ 
        news: [
          { title: 'RSS源正在配置中', summary: '请稍后再试，或检查网络连接', source: '系统提示' },
          { title: '可用的新闻源示例', summary: 'BBC、CNN、纽约时报等国际媒体源可用', source: '系统提示' }
        ],
        warning: 'RSS抓取失败，显示模拟数据'
      });
    }
    
    // 关键词过滤
    let items = allItems;
    if (kw && kw !== topic && kw !== 'undefined' && kw !== 'null' && kw.trim() !== '') {
      const kwLower = kw.toLowerCase().trim();
      const filtered = items.filter(i =>
        i.title.toLowerCase().includes(kwLower) ||
        i.summary.toLowerCase().includes(kwLower)
      );
      if (filtered.length > 0) {
        items = filtered;
        console.log(`关键词过滤后剩余 ${items.length} 条`);
      }
    }
    
    // 去重（基于标题）
    const seen = new Set();
    const uniqueItems = items.filter(item => {
      const key = item.title;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    res.status(200).json({ news: uniqueItems.slice(0, 6) });
    
  } catch (err) {
    console.error('News fetch error:', err);
    res.status(200).json({ 
      news: [
        { title: '抓取失败：' + err.message, summary: '请检查服务器网络和RSS源', source: '错误信息' }
      ],
      error: err.message 
    });
  }
}