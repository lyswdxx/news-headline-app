// ==========================================
// 热点新闻接口 - 动态模拟版（不再依赖外部源）
// ==========================================

// 根据关键词和日期生成热门话题库
function getHotTopics(keyword, topic) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const isMayDay = month === 5 && day <= 7; // 五一前后
  
  const keywordLower = (keyword || topic || '').toLowerCase();
  
  // 通用热门事件库（按分类、节假日动态变化）
  const hotPools = {
    travel: [
      { title: "五一国内旅游人次破纪录，这些景区紧急限流", summary: "文旅部最新数据：假期前两日全国接待游客超2亿，多地启动应急预案。" },
      { title: "本地人推荐！五一避开人潮的5个冷门古镇", summary: "不想看人头？这5个小众目的地高铁直达，住宿价格没涨。" },
      { title: "高速充电排长队，新能源车主直呼不敢开空调", summary: "五一出行高峰，服务区充电桩供不应求，等待时间超2小时。" },
      { title: "特种兵旅游后遗症：年轻人累进医院", summary: "日行三万步、凌晨赶火车，医生提醒：量力而行。" },
    ],
    tech: [
      { title: "苹果折叠屏设备推迟至2026年，原因曝光", summary: "因屏幕良品率问题，苹果首款折叠产品再跳票。" },
      { title: "抖音上线AI换脸新功能，网友玩疯了", summary: "一键变成经典影视角色，服务器一度挤爆。" },
    ],
    finance: [
      { title: "黄金价格大跌，年轻人开始抄底", summary: "金价回落至550元/克，五一期间金店排长队。" },
    ],
    ai: [
      { title: "GPT-5发布时间泄露？OpenAI CEO最新暗示", summary: "Sam Altman发推文暗指新一代模型即将到来。" },
    ],
    default: [
      { title: `${keyword || topic || '今日'}热搜第一！网友集体破防`, summary: "相关话题阅读量破5亿，评论区已吵翻。" },
      { title: `刚刚确认！${keyword || topic || '这个事件'}迎来最新进展`, summary: "多方回应后，舆论仍在持续发酵。" },
    ]
  };
  
  // 根据关键词或季节选择话题池
  let pool = [];
  if (isMayDay || keywordLower.includes('旅游') || keywordLower.includes('五一') || topic === '社会民生') {
    pool = hotPools.travel;
  } else if (keywordLower.includes('科技') || topic === '科技') {
    pool = hotPools.tech;
  } else if (keywordLower.includes('财经') || topic === '财经') {
    pool = hotPools.finance;
  } else if (keywordLower.includes('ai') || topic === '人工智能') {
    pool = hotPools.ai;
  } else {
    pool = hotPools.default;
  }
  
  // 随机打乱顺序，让每次请求结果不同
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  
  return pool.slice(0, 6).map(item => ({
    title: item.title,
    summary: item.summary,
    source: '今日热榜·动态模拟'
  }));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const { topic, kw } = req.query;
  const keyword = kw || topic || '热点';
  
  // 直接返回动态生成的热门话题（模拟真实热榜变化）
  const news = getHotTopics(keyword, topic);
  
  // 模拟网络延迟（让前端有加载感，可选）
  await new Promise(resolve => setTimeout(resolve, 300));
  
  res.status(200).json({ news });
}