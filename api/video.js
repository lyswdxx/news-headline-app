// ==========================================
// 国内热门视频接口（B站 + 抖音 + 备用）
// ==========================================

// B站 API（无需 Key）
const BILI_API = 'https://api.bilibili.com/x/web-interface/popular';

// 抖音热榜 API（通过第三方）
const DOUYIN_API = 'https://www.iesdouyin.com/web/api/v2/hotsearch/billboard/words/';

// 兜底数据（预置国内热门视频）
const FALLBACK_VIDEOS = [
  { title: '【全网爆款】五一旅游特种兵，三天玩转五省', bvid: 'BV1xx4y1Q7xX', channel: '旅游博主', desc: '年轻人旅行新方式' },
  { title: '特斯拉失控事件最新回应', bvid: 'BV1T84y1Q7xX', channel: '科技新闻', desc: '官方发布说明' },
  { title: 'iPhone 15 Pro 深度评测，值得买吗？', bvid: 'BV1Nh4y1P7xX', channel: '数码评测', desc: '真实使用体验' },
  { title: '周杰伦演唱会现场，全场大合唱', bvid: 'BV1Tx4y1Q7xX', channel: '娱乐现场', desc: '七里香前奏一响就哭了' },
  { title: 'AI 实时生成视频，太震撼了', bvid: 'BV1yo4y1Q7xX', channel: '科技观察', desc: 'Sora 级模型体验' }
];

function cleanText(str) {
  if (!str) return '';
  return str.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

// 获取 B 站热门视频
async function fetchBiliHot(keyword = '') {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let url = `${BILI_API}?ps=20&pn=1`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://www.bilibili.com/'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const data = await res.json();
    if (data.code !== 0) return [];
    
    let videos = data.data.list || [];
    
    // 如果有关键词，过滤标题
    if (keyword && keyword.trim()) {
      const kw = keyword.toLowerCase();
      videos = videos.filter(v => 
        v.title.toLowerCase().includes(kw) || 
        (v.desc && v.desc.toLowerCase().includes(kw))
      );
    }
    
    return videos.slice(0, 8).map(v => ({
      title: cleanText(v.title).slice(0, 80),
      bvid: v.bvid,
      link: `https://www.bilibili.com/video/${v.bvid}`,
      channel: cleanText(v.owner?.name || 'B站UP主').slice(0, 50),
      published: v.pubdate ? new Date(v.pubdate * 1000).toISOString() : new Date().toISOString(),
      description: cleanText(v.desc || '').slice(0, 200),
      thumbnail: v.pic || `https://i0.hdslb.com/bfs/archive/${v.bvid}.jpg`,
      stat: v.stat?.view || 0
    }));
  } catch (err) {
    console.error('B站热门抓取失败:', err.message);
    return [];
  }
}

// 获取抖音热点（需要代理，备用）
async function fetchDouyinHot(keyword = '') {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(DOUYIN_API, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.word_list) return [];
    
    let hotList = data.word_list || [];
    if (keyword && keyword.trim()) {
      const kw = keyword.toLowerCase();
      hotList = hotList.filter(v => v.word.toLowerCase().includes(kw));
    }
    
    return hotList.slice(0, 8).map((v, i) => ({
      title: cleanText(v.word).slice(0, 80),
      link: `https://www.douyin.com/search/${encodeURIComponent(v.word)}`,
      channel: '抖音热点',
      published: new Date().toISOString(),
      description: `热度值 ${v.hot_value || '飙升中'}，抖音用户正在热议`,
      thumbnail: '',
      stat: v.hot_value || 0
    }));
  } catch (err) {
    console.error('抖音热点抓取失败:', err.message);
    return [];
  }
}

// 根据关键词生成兜底视频
function getFallbackVideos(keyword) {
  const kw = (keyword || '热点').toLowerCase();
  let videos = [...FALLBACK_VIDEOS];
  
  // 根据关键词生成相关视频
  if (kw.includes('旅游')) {
    videos = [
      { title: '五一旅游爆火目的地，你去了吗？', bvid: 'BV1xx4y1Q7xX', channel: '旅游博主', desc: '全国热门景区实况' },
      { title: '小众旅游地推荐，人少景美', bvid: 'BV1T84y1Q7xX', channel: '旅行日记', desc: '高铁直达' },
      { title: '旅游避坑指南，这些地方千万别去', bvid: 'BV1Nh4y1P7xX', channel: '旅行攻略', desc: '真实踩坑经历' }
    ];
  } else if (kw.includes('科技') || kw.includes('手机')) {
    videos = [
      { title: '华为 Mate 60 Pro 深度评测', bvid: 'BV1Tx4y1Q7xX', channel: '数码博主', desc: '麒麟芯片回归' },
      { title: '小米汽车最新消息', bvid: 'BV1yo4y1Q7xX', channel: '科技新闻', desc: 'SU7 交付在即' }
    ];
  } else if (kw.includes('娱乐') || kw.includes('明星')) {
    videos = [
      { title: '周杰伦新歌 MV 首发', bvid: 'BV1xx4y1Q7xY', channel: '音乐现场', desc: '全网播放破亿' },
      { title: '热播剧大结局，网友泪崩', bvid: 'BV1T84y1Q7xY', channel: '影视解说', desc: '导演回应争议' }
    ];
  }
  
  return videos.slice(0, 6).map(v => ({
    title: v.title,
    link: `https://www.bilibili.com/video/${v.bvid}`,
    channel: v.channel,
    published: new Date().toISOString(),
    description: v.desc,
    thumbnail: `https://i0.hdslb.com/bfs/archive/${v.bvid}.jpg`,
    stat: 10000
  }));
}

// 获取视频介绍文（用于 AI 生成）
async function getVideoDescription(title, channel, desc) {
  // 这里可以调用 AI 生成详细介绍
  return `${title} - ${channel}出品。${desc}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { kw, topic } = req.query;
  
  // 确定搜索关键词
  let searchKeyword = kw || topic || '';
  if (searchKeyword === 'US' || searchKeyword === 'JP' || searchKeyword === 'KR' || searchKeyword === 'GB') {
    searchKeyword = '';
  }
  
  try {
    let videos = [];
    
    // 1. 优先使用 B 站热门
    videos = await fetchBiliHot(searchKeyword);
    if (videos.length > 0) {
      return res.status(200).json({ videos: videos.slice(0, 8), source: 'bilibili' });
    }
    
    // 2. 尝试抖音热榜
    videos = await fetchDouyinHot(searchKeyword);
    if (videos.length > 0) {
      return res.status(200).json({ videos: videos.slice(0, 8), source: 'douyin' });
    }
    
    // 3. 兜底数据
    const fallbackKw = searchKeyword || '热门';
    const fallbackVideos = getFallbackVideos(fallbackKw);
    res.status(200).json({ videos: fallbackVideos, source: 'fallback' });
    
  } catch (err) {
    console.error('视频抓取失败:', err);
    const fallbackVideos = getFallbackVideos('热门');
    res.status(200).json({ videos: fallbackVideos, source: 'fallback' });
  }
}