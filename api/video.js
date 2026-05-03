// ==========================================
// 视频热点接口 - 支持关键词搜索 + 真实链接
// ==========================================

const INVIDIOUS_INSTANCES = [
  'https://inv.riverside.rocks',
  'https://y.com.cm',
  'https://invidious.snopyta.org'
];

function cleanText(str) {
  if (!str) return '';
  return str.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

// 搜索 YouTube 视频
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
          link: `https://www.youtube.com/watch?v=${v.videoId}`,
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

// 获取热门视频
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
          link: `https://www.youtube.com/watch?v=${v.videoId}`,
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

// 生成兜底数据（带真实搜索链接）
function getFallbackVideos(keyword, region) {
  const kw = keyword || region || '热点';
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(kw)}`;
  
  return [
    { title: `${kw} 最新热门视频合集`, link: searchUrl, channel: 'YouTube精选', published: new Date().toISOString(), description: `关于“${kw}”的最新热门视频，点击观看。`, thumbnail: '' },
    { title: `${kw} 深度解析`, link: searchUrl, channel: '知识科普', published: new Date().toISOString(), description: `专家解读“${kw}”背后的真相。`, thumbnail: '' },
    { title: `${kw} 现场实拍`, link: searchUrl, channel: '现场直击', published: new Date().toISOString(), description: `第一视角记录“${kw}”真实场景。`, thumbnail: '' },
    { title: `${kw} 干货分享`, link: searchUrl, channel: '实用教程', published: new Date().toISOString(), description: `关于“${kw}”的实用技巧，建议收藏。`, thumbnail: '' },
    { title: `${kw} 最新进展`, link: searchUrl, channel: '新闻速递', published: new Date().toISOString(), description: `“${kw}”最新动态，第一时间了解。`, thumbnail: '' }
  ];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { region = 'US', kw } = req.query;
  
  try {
    let videos = [];
    
    // 1. 关键词搜索
    if (kw && kw.trim() && kw !== 'undefined') {
      videos = await searchYouTube(kw.trim());
      if (videos.length > 0) {
        return res.status(200).json({ videos: videos.slice(0, 8) });
      }
    }
    
    // 2. 地区热门
    videos = await fetchTrending(region);
    if (videos.length > 0) {
      return res.status(200).json({ videos: videos.slice(0, 8) });
    }
    
    // 3. 兜底（带搜索链接）
    const searchKw = kw || region;
    const fallback = getFallbackVideos(searchKw, region);
    res.status(200).json({ videos: fallback });
    
  } catch (err) {
    console.error('视频抓取失败:', err);
    const fallback = getFallbackVideos('热点', region);
    res.status(200).json({ videos: fallback });
  }
}