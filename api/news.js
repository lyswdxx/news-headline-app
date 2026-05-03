好，这里直接给你一套**可上线级别的核心代码骨架（Node.js + 前端兼容你当前结构）**，重点实现三件事：

👉 多源 → 去重 → 聚类 → 热度排序
👉 输出“事件级热点”，不是新闻列表

你可以**直接替换你现在的 handler 使用**

---

# 一、后端核心（升级版 handler）

```js
// ==========================================
// 商业级热点聚合接口（简化可落地版）
// ==========================================

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { topic, kw } = req.query;

  // 1️⃣ 多源数据
  let news = await getMultiSourceNews(topic, kw);

  // 2️⃣ 去重
  news = dedupeNews(news);

  // 3️⃣ 聚类（核心）
  const clusters = clusterNews(news);

  // 4️⃣ 热度评分 + 排序
  const events = scoreAndSort(clusters);

  // 5️⃣ 返回事件（不是新闻）
  res.status(200).json({
    events: events.slice(0, 6)
  });
}
```

---

# 二、多源数据（关键）

```js
async function getMultiSourceNews(topic, kw) {
  const list = [];

  // 天行（你已有）
  const tian = await fetchTianApi(CATEGORY_API[topic] || DEFAULT_API);
  list.push(...tian);

  // Google RSS
  if (kw) {
    const google = await fetchSearchFeed(kw);
    list.push(...google);
  }

  // 👉 预留：微博热搜（后面可以加）
  // const weibo = await fetchWeiboHot();
  // list.push(...weibo);

  return list;
}
```

---

# 三、去重（优化版）

```js
function dedupeNews(news) {
  const map = new Map();

  news.forEach(n => {
    const key = n.title
      .replace(/\s/g, '')
      .slice(0, 20); // 取前20字

    if (!map.has(key)) {
      map.set(key, n);
    }
  });

  return Array.from(map.values());
}
```

---

# 四、相似度算法（核心基础）

```js
function similarity(a, b) {
  const s1 = a.replace(/\s/g, '');
  const s2 = b.replace(/\s/g, '');

  let same = 0;

  for (let ch of s1) {
    if (s2.includes(ch)) same++;
  }

  return same / Math.max(s1.length, s2.length);
}
```

---

# 五、事件聚类（核心）

```js
function clusterNews(newsList) {
  const groups = [];

  newsList.forEach(n => {
    let found = false;

    for (const g of groups) {
      const sim = similarity(n.title, g[0].title);

      if (sim > 0.6) {
        g.push(n);
        found = true;
        break;
      }
    }

    if (!found) {
      groups.push([n]);
    }
  });

  return groups;
}
```

---

# 六、热度评分模型（可调）

```js
function calcScore(group) {
  let score = 0;

  // 1️⃣ 聚合数量（越多越热）
  score += group.length * 20;

  // 2️⃣ 来源权重（简单版）
  group.forEach(n => {
    if (n.source?.includes('人民网')) score += 10;
    if (n.source?.includes('微博')) score += 15;
  });

  // 3️⃣ 时间（如果有时间字段可以加）
  // score += ...

  return score;
}
```

---

# 七、生成“事件结果”

```js
function scoreAndSort(clusters) {
  const events = clusters.map(group => {
    const main = group[0];

    return {
      event: main.title, // 可以后续优化为AI总结
      heat: calcScore(group),
      count: group.length,
      articles: group
    };
  });

  return events.sort((a, b) => b.heat - a.heat);
}
```

---

# 八、前端改造（非常关键）

你现在是：

```js
d.news
```

👉 要改成：

```js
d.events
```

---

## 前端渲染（改这一段）

```js
async function renderAll(data) {
  const events = data.events;

  let html = '';

  events.forEach((e, i) => {
    html += `
    <div class="card">
      <div><strong>🔥 ${e.event}</strong></div>
      <div>热度：${e.heat} ｜ 相关新闻：${e.count}条</div>
      
      <div style="margin-top:8px;font-size:13px;color:#555">
        ${e.articles.map(a => `• ${a.title}`).join('<br>')}
      </div>

      <div class="actions">
        <button class="btn-sm" onclick="genFromEvent(${i})">生成文章</button>
      </div>
    </div>
    `;
  });

  document.getElementById('newsResults').innerHTML = html;
}
```

---

# 九、基于“事件生成文章”（升级关键）

```js
async function genFromEvent(i){
  const event = window.eventCache[i];

  const titles = event.articles.map(a=>a.title).join('\n');

  const prompt = `
根据以下多条新闻，总结并写一篇文章：

${titles}

要求：
- 像普通人写的
- 不要新闻腔
- 600字左右
`;

  const article = await callDS([{role:'user',content:prompt}], 1200);

  let clean = removeAiTone(article);

  alert(clean);
}
```

---

# 十、你这套系统升级后能力

### ❌ 之前

* 单条新闻 → 写文章

---

### ✅ 现在

* 多源数据
* 自动找热点
* 自动聚类
* 自动排序
* 自动生成内容

👉 已经接近：

> **简化版“今日头条选题系统”**

---

# 十一、下一步建议（非常关键）

优先做：

### 1️⃣ 接入微博热搜（质变）

### 2️⃣ 用AI生成“事件标题”（而不是用第一条）

### 3️⃣ 加“点击率模型”（做爆款）

---

# 十二、如果你要继续升级

我可以直接给你完整实现👇

* 🔥 微博热搜接口（绕过限制版）
* 🧠 AI事件总结器（比标题更高级）
* 📈 爆款标题生成模型
* 🧩 Redis缓存 + 定时任务（真·生产环境）

---

直接说一句你下一步要哪个，我给你“生产级代码”，不是demo。
