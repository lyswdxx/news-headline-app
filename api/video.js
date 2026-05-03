// ==========================================
// 视频热点接口 - 支持关键词搜索
// ==========================================

const INVIDIOUS_INSTANCES = [
  'https://inv.riverside.rocks',
  'https://y.com.cm',
  'https://invidious.snopyta.org'
];

// 兴趣词映射（根据分类推荐相关视频）
const CATEGORY_KEYWORDS = {
  '科技': 'technology',
  '财经': 'finance',
  '人工智能': 'artificial intelligence',
  '体育': 'sports',
  '健康': 'health',
  '社会民生': 'news',
  '汽车': 'car',
  '教育': 'education',
  '娱乐': 'entertainment',
  '旅游': 'travel'
};

function cleanText(str) {
  if (!str) return '';
  return str.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

// 搜索 YouTube 视频（通过 Invidious）
async function searchYouTube(query, limit = 10) {
  if (!query) return [];
  
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const url = `${instance}/api/v1/search?q=${encodeURIComponent(query)}&sort=relevance`;
      const res = await fetch(url, { 
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: controller.signal 
      });
      clearTimeout(timeout);
      
      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.filter(v => v.type === 'video').slice(0, limit).map(v => ({
          title: cleanText(v.title).slice(0, 80),
          link: `https://youtube.com/watch?v=${v.videoId}`,
          channel: cleanText(v.author).slice(0, 50) || 'YouTube频道',
          published: v.publishedText || new Date().toISOString(),
          description: cleanText(v.description || '').slice(0, 200),
          thumbnail: v.videoThumbnails?.[0]?.url || `https://img.youtube.com/vi/${v.videoId}/hqdefault.jpg`
        }));
      }
    } catch (e) {
      console.warn(`搜索失败 ${instance}:`, e.message);
    }
  }
  return [];
}

// 获取热门视频（无关键词时）
async function fetchTrending(region) {
  const regionMap = { US: 'US', JP: 'JP', KR: 'KR', GB: 'GB' };
  const code = regionMap[region] || 'US';
  
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const url = `${instance}/api/v1/trending?region=${code}`;
      const res = await fetch(url, { 
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: controller.signal 
      });
      clearTimeout(timeout);
      
      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.slice(0, 12).map(v => ({
          title: cleanText(v.title).slice(0, 80),
          link: `https://youtube.com/watch?v=${v.videoId}`,
          channel: cleanText(v.author).slice(0, 50) || 'YouTube频道',
          published: v.publishedText || new Date().toISOString(),
          description: cleanText(v.description || '').slice(0, 200),
          thumbnail: v.videoThumbnails?.[0]?.url || `https://img.youtube.com/vi/${v.videoId}/hqdefault.jpg`
        }));
      }
    } catch (e) {
      console.warn(`热门失败 ${instance}:`, e.message);
    }
  }
  return [];
}

// 兜底数据（根据关键词生成）
function getFallbackVideos(keyword, region) {
  const kw = keyword || region || '热点';
  const videos = [];
  
  // 根据关键词生成相关视频标题
  const titles = [
    `${kw}最新动态，全网都在看`,
    `${kw}深度解析，专家这样说`,
    `${kw}背后的真相，太震撼了`,
    `${kw}现场实拍，太真实了`,
    `${kw}干货分享，建议收藏`
  ];
  
  for (let i = 0; i < Math.min(5, titles.length); i++) {
    videos.push({
      title: titles[i],
      link: '#',
      channel: `${kw}频道`,
      published: new Date().toISOString(),
      description: `关于“${kw}”的最新视频，点击观看完整内容。`,
      thumbnail: ''
    });
  }
  return videos;
}

// API 入口
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { region = 'US', kw, topic } = req.query;
  
  try {
    let videos = [];
    
    // 优先级1：用户输入的关键词
    if (kw && kw.trim()) {
      videos = await searchYouTube(kw.trim());
      if (videos.length > 0) {
        return res.status(200).json({ videos: videos.slice(0, 8) });
      }
    }
    
    // 优先级2：分类关键词（没有用户输入时）
    if (topic && CATEGORY_KEYWORDS[topic]) {
      videos = await searchYouTube(CATEGORY_KEYWORDS[topic]);
      if (videos.length > 0) {
        return res.status(200).json({ videos: videos.slice(0, 8) });
      }
    }
    
    // 优先级3：地区热门视频
    videos = await fetchTrending(region);
    if (videos.length > 0) {
      return res.status(200).json({ videos: videos.slice(0, 8) });
    }
    
    // 优先级4：兜底数据
    const searchKw = kw || topic || region;
    const fallback = getFallbackVideos(searchKw, region);
    res.status(200).json({ videos: fallback });
    
  } catch (err) {
    console.error('视频抓取失败:', err);
    const fallback = getFallbackVideos('热点', region);
    res.status(200).json({ videos: fallback });
  }
}