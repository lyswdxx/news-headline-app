async function renderAll(events, kw) {
  let html = '';
  window.eventCache = events; // 缓存供生成文章使用
  
  events.forEach((e, i) => {
    html += `
      <div class="card" id="event-card-${i}">
        <div><strong>🔥 ${escapeHtml(e.event)}</strong></div>
        <div style="margin:8px 0; font-size:12px; color:#888;">
          热度值 ${e.heat} ｜ 相关新闻 ${e.count} 条
        </div>
        <div style="margin-top:8px; font-size:13px; color:#555; background:#f9f9f9; padding:8px; border-radius:8px;">
          ${e.articles.map(a => `• ${escapeHtml(a.title)}`).join('<br>')}
        </div>
        <div class="actions" style="margin-top:12px;">
          <button class="btn-sm" onclick="genFromEvent(${i})">📝 生成本文</button>
          <button class="btn-sm" onclick="genShepingFromEvent(${i})">📢 生成社评</button>
        </div>
        <div id="event-article-${i}" class="hot-article" style="display:none; margin-top:12px;"></div>
        <div id="event-sheping-${i}" class="hot-article" style="display:none; margin-top:12px;"></div>
      </div>
    `;
  });
  
  document.getElementById('newsResults').innerHTML = html;
}

// 基于事件生成文章（去AI味）
async function genFromEvent(index) {
  const event = window.eventCache[index];
  if (!event) return;
  const container = document.getElementById(`event-article-${index}`);
  container.style.display = 'block';
  container.innerHTML = '<div class="loading"><span class="spinner"></span> 基于多源事件撰写中...</div>';
  
  const titles = event.articles.map(a => a.title).join('\n');
  const prompt = `根据以下多条新闻，写一篇通俗易懂、像人写的文章（600字左右），不要新闻腔，不要“首先其次”，不要AI痕迹，可以带一点个人观点但不夸张。\n\n${titles}`;
  
  try {
    const article = await callDS([{ role: 'user', content: prompt }], 1200);
    const cleaned = removeAiTone(article);
    container.innerHTML = `<div style="white-space:pre-wrap">${escapeHtml(cleaned)}</div><button class="btn-sm" onclick="copyText(this, '${escapeHtml(cleaned).replace(/'/g, "\\'")}')">复制全文</button>`;
  } catch (err) {
    container.innerHTML = `<div class="err">生成失败：${err.message}</div>`;
  }
}

// 基于事件生成社评
async function genShepingFromEvent(index) {
  const event = window.eventCache[index];
  if (!event) return;
  const container = document.getElementById(`event-sheping-${index}`);
  container.style.display = 'block';
  container.innerHTML = '<div class="loading"><span class="spinner"></span> 撰写社评中...</div>';
  
  const titles = event.articles.map(a => a.title).join('\n');
  const prompt = `根据以下热点事件，写一篇300字左右的短评，观点积极，符合主流价值观，不要AI腔。\n\n${titles}`;
  
  try {
    const article = await callDS([{ role: 'user', content: prompt }], 800);
    container.innerHTML = `<div style="white-space:pre-wrap">${escapeHtml(article)}</div><button class="btn-sm" onclick="copyText(this, '${escapeHtml(article).replace(/'/g, "\\'")}')">复制社评</button>`;
  } catch (err) {
    container.innerHTML = `<div class="err">生成失败：${err.message}</div>`;
  }
}

// 辅助函数：复制文本
function copyText(btn, text) {
  navigator.clipboard.writeText(text);
  const original = btn.innerText;
  btn.innerText = '已复制 ✓';
  setTimeout(() => btn.innerText = original, 1500);
}

// 去AI味函数（您已有的，如果没有则添加）
function removeAiTone(text) {
  return text.replace(/首先|其次|再者|综上所述|值得注意的是|从某种程度上/g, '')
             .replace(/记者|编辑|业内人士/g, '')
             .replace(/\n{3,}/g, '\n\n')
             .trim();
}