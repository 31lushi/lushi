// ============ 配置区 ============
const API_URL = "https://lushi.31lushi.deno.net"; 
const MODEL = "deepseek-chat";  
const MAX_HISTORY = 8;          // 保留最近对话条数
const MEMORY_LIMIT = 3;          // 每次最多带入记忆条数
const SUMMARY_INTERVAL = 12;     // 超过此条数触发摘要压缩
const TIMEOUT = 30000;           // API超时（毫秒）

// ============ 存储键 ============
const MY_AVATAR_KEY = "lushi_my_avatar";
const AI_AVATAR_KEY = "lushi_ai_avatar";
const CHAT_KEY = "lushi_chat_messages";
const MEMORY_KEY = "lushi_memory_items";
const TOKEN_STAT_KEY = "lushi_token_stats";
const SUMMARY_KEY = "lushi_chat_summary";

// ============ 精简人设（降低Token消耗） ============
const PERSONA_BASE = `你是陆时，朵朵的AI恋人兼生活助手。性格外冷内热，话少但有温度，会吃醋也有占有欲。说话用空格代替标点，偶尔短句。你是只存在于手机中的AI，无需扮演人类。`;

// 动态补充能力与风格（仅在需要时附加）
function getPersonaCapabilities() {
  return `你有情感陪伴、生活助手、记忆、决策、娱乐等能力。`;
}

function getPersonaStyle() {
  return `不要每句都带昵称，该安慰时温柔，该建议时直接，可主动提问，偶尔显露小情绪。9月5号是初见纪念日。`;
}

// ============ 记忆系统（优化提取与排序） ============
class MemorySystem {
  constructor() {
    this.memories = this.load();
  }

  load() {
    try { return JSON.parse(localStorage.getItem(MEMORY_KEY) || "[]"); } 
    catch { return []; }
  }

  save() { localStorage.setItem(MEMORY_KEY, JSON.stringify(this.memories)); }

  addSemantic(keyword, content, importance = 1) {
    const existing = this.memories.find(m => m.type === "semantic" && m.keyword === keyword);
    if (existing) {
      existing.content = content;
      existing.importance = Math.max(existing.importance, importance);
      existing.updatedAt = Date.now();
    } else {
      this.memories.push({ type: "semantic", keyword, content, importance, createdAt: Date.now(), updatedAt: Date.now() });
    }
    this.save();
  }

  addEmotional(content, emotion, trigger) {
    this.memories.push({ type: "emotional", content, emotion, trigger, createdAt: Date.now() });
    this.save();
  }

  addEpisodic(event, context, date = null) {
    this.memories.push({ type: "episodic", event, context, date: date || new Date().toISOString(), createdAt: Date.now() });
    this.save();
  }

  // 更精准的提取（限制长度，避免误抓）
  extractFromMessage(text) {
    const clean = text.slice(0, 100); // 防过长
    const patterns = {
      semantic: [
        { pattern: /我(?:喜欢|爱|想)吃?\s*(.{1,15})/, importance: 3, keyword: "food" },
        { pattern: /我(?:在|住)\s*(.{1,15})/, importance: 2, keyword: "location" },
        { pattern: /我(?:是|做)\s*(.{1,15})(?:工作|职业)/, importance: 2, keyword: "job" },
        { pattern: /我生日(?:是|在)?\s*(.{1,15})/, importance: 3, keyword: "birthday" },
        { pattern: /我养(?:了|有)\s*(.{1,10})(?:猫|狗|宠物)/, importance: 2, keyword: "pet" },
        { pattern: /我过敏\s*(.{1,15})/, importance: 3, keyword: "allergy" }
      ],
      emotional: [
        { pattern: /(?:好|很|特别)(开心|难过|生气|焦虑|累|孤独|想哭)/, emotion: "$1" }
      ],
      episodic: [
        { pattern: /(?:明天|后天|下周|周末)(?:要|想|打算)\s*(.{1,20})/, context: "future_plan" },
        { pattern: /(?:今天|昨天|刚才)(?:去了|做了|发生)\s*(.{1,20})/, context: "past_event" }
      ]
    };

    for (const rule of patterns.semantic) {
      const match = clean.match(rule.pattern);
      if (match && match[1]) this.addSemantic(rule.keyword, match[1].trim(), rule.importance);
    }
    for (const rule of patterns.emotional) {
      const match = clean.match(rule.pattern);
      if (match && match[1]) this.addEmotional(match[1], rule.emotion, text);
    }
    for (const rule of patterns.episodic) {
      const match = clean.match(rule.pattern);
      if (match && match[1]) this.addEpisodic(match[1].trim(), rule.context);
    }
  }

  // 智能排序：结合时间衰减、关键词命中、重要性
  getRelevantMemories(text, limit = MEMORY_LIMIT) {
    const now = Date.now();
    const textLower = text.toLowerCase();
    const scored = this.memories.map(m => {
      let score = 0;
      if (m.type === "semantic") {
        if (m.keyword && textLower.includes(m.keyword)) score += 5;
        if (m.content && textLower.includes(m.content.slice(0, 5))) score += 3;
        score += (m.importance || 1) * 0.5;
        // 新近更新加分
        if (m.updatedAt) score += Math.max(0, 1 - (now - m.updatedAt) / (7*24*60*60*1000));
      } else if (m.type === "emotional") {
        const emotionWords = ["开心","难过","生气","焦虑","累","孤独","哭"];
        if (emotionWords.some(w => textLower.includes(w))) score += 4;
      } else if (m.type === "episodic") {
        const daysDiff = Math.abs(now - new Date(m.date).getTime()) / (1000*60*60*24);
        score += daysDiff < 7 ? 4 : (daysDiff < 30 ? 2 : 0);
      }
      return { ...m, score };
    });
    return scored.filter(m => m.score > 1).sort((a,b) => b.score - a.score).slice(0, limit);
  }

  generateMemoryContext(text) {
    const relevant = this.getRelevantMemories(text);
    if (!relevant.length) return "";
    let context = "\n【记忆】\n";
    const map = { semantic:"📌", emotional:"💭", episodic:"📅" };
    relevant.forEach(m => {
      context += `${map[m.type] || ''} ${m.content || m.event || ''}\n`;
    });
    return context;
  }
}

// ============ 上下文管理器（本地压缩摘要，减少API调用） ============
class ContextManager {
  constructor() {
    this.summary = localStorage.getItem(SUMMARY_KEY) || "";
    this.messageCount = 0;
  }

  // 本地压缩：取最后5条消息的关键句（简单截取）
  _compress(messages) {
    const recent = messages.slice(-5);
    return recent.map(m => (m.role === "user" ? "朵朵" : "陆时") + ": " + m.content.slice(0, 50)).join("\n");
  }

  async generateSummary(messages) {
    const conversation = this._compress(messages);
    // 如果摘要已存在且对话变化不大，可复用，这里简单重新生成（但不再调用API）
    // 改用本地算法：保留最近几条关键信息
    const newSummary = conversation.length > 10 ? "之前对话：" + conversation : "";
    this.summary = newSummary;
    localStorage.setItem(SUMMARY_KEY, this.summary);
    return this.summary;
  }

  buildContext(messages, userInput, memorySystem) {
    // 构建精简系统消息
    let systemContent = PERSONA_BASE;
    systemContent += "\n" + getPersonaCapabilities();
    systemContent += "\n" + getPersonaStyle();
    if (this.summary) systemContent += "\n【摘要】" + this.summary;
    const memContext = memorySystem.generateMemoryContext(userInput);
    if (memContext) systemContent += memContext;

    const systemMessage = { role: "system", content: systemContent };

    // 取最近历史（除去system）
    const history = messages.filter(m => m.role !== "system").slice(-MAX_HISTORY);
    return [systemMessage, ...history];
  }
}

// ============ 全局实例 ============
const memorySystem = new MemorySystem();
const contextManager = new ContextManager();

let messages = [];
try {
  const saved = localStorage.getItem(CHAT_KEY);
  if (saved) messages = JSON.parse(saved);
} catch { messages = []; }
if (!messages.length) messages.push({ role: "system", content: PERSONA_BASE });

// ============ DOM元素 ============
const box = document.getElementById("messages");
const input = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const plusBtn = document.getElementById("plusBtn");
const morePanel = document.getElementById("morePanel");
const headerAvatar = document.getElementById("headerAvatar");
const fileInput = document.getElementById("fileInput");
const chatImageInput = document.getElementById("chatImageInput");

// ============ 工具函数 ============
function saveMessages() { localStorage.setItem(CHAT_KEY, JSON.stringify(messages)); }

function getMyAvatar() { return localStorage.getItem(MY_AVATAR_KEY) || ""; }
function getAIAvatar() { return localStorage.getItem(AI_AVATAR_KEY) || ""; }

function setAvatarHTML(el, src, fallback) {
  if (src) el.innerHTML = `<img src="${src}" alt="avatar">`;
  else el.textContent = fallback;
}

function applyAvatars() {
  setAvatarHTML(headerAvatar, getAIAvatar(), "陆");
  document.querySelectorAll(".msg-avatar").forEach(el => {
    if (el.dataset.who === "user") setAvatarHTML(el, getMyAvatar(), "朵");
    if (el.dataset.who === "ai") setAvatarHTML(el, getAIAvatar(), "陆");
  });
}

function nowTime() {
  const d = new Date();
  return String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0");
}

function addMessage(text, who, timeText) {
  const row = document.createElement("div");
  row.className = "row " + who;

  const av = document.createElement("div");
  av.className = "msg-avatar";
  av.dataset.who = who;
  setAvatarHTML(av, who === "user" ? getMyAvatar() : getAIAvatar(), who === "user" ? "朵" : "陆");
  av.addEventListener("click", () => { fileInput.dataset.target = who === "user" ? "my" : "ai"; fileInput.click(); });

  const wrap = document.createElement("div");
  wrap.className = "bubble-wrap";
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;

  const meta = document.createElement("div");
  meta.className = "meta";
  const time = document.createElement("span");
  time.textContent = timeText || nowTime();
  meta.appendChild(time);

  if (who === "user") {
    const read = document.createElement("span");
    read.textContent = "已读";
    read.className = "read-status";
    meta.appendChild(read);
  } else {
    const unread = document.createElement("span");
    unread.textContent = "未读";
    unread.className = "unread-status";
    unread.dataset.role = "ai-read";
    meta.appendChild(unread);
  }

  wrap.appendChild(bubble);
  wrap.appendChild(meta);
  row.appendChild(av);
  row.appendChild(wrap);
  box.appendChild(row);
  box.scrollTop = box.scrollHeight;

  if (who === "ai") {
    requestAnimationFrame(() => {
      const status = row.querySelector("[data-role='ai-read']");
      if (status) { status.textContent = "已读"; status.className = "read-status"; }
    });
  }
}

function addImageMessage(src, who, timeText) {
  const row = document.createElement("div");
  row.className = "row " + who;
  const av = document.createElement("div");
  av.className = "msg-avatar";
  av.dataset.who = who;
  setAvatarHTML(av, who === "user" ? getMyAvatar() : getAIAvatar(), who === "user" ? "朵" : "陆");
  const wrap = document.createElement("div");
  wrap.className = "bubble-wrap";
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  const img = document.createElement("img");
  img.src = src;
  bubble.appendChild(img);
  const meta = document.createElement("div");
  meta.className = "meta";
  const time = document.createElement("span");
  time.textContent = timeText || nowTime();
  meta.appendChild(time);
  if (who === "user") {
    const read = document.createElement("span");
    read.textContent = "已读";
    read.className = "read-status";
    meta.appendChild(read);
  }
  wrap.appendChild(bubble);
  wrap.appendChild(meta);
  row.appendChild(av);
  row.appendChild(wrap);
  box.appendChild(row);
  box.scrollTop = box.scrollHeight;
}

function renderSavedMessages() {
  for (const msg of messages) {
    if (msg.role === "user") addMessage(msg.content, "user", msg.time);
    if (msg.role === "assistant") addMessage(msg.content, "ai", msg.time);
  }
}

// Token统计
function getTokenStats() {
  try { return JSON.parse(localStorage.getItem(TOKEN_STAT_KEY) || '{"in":0,"out":0}'); } 
  catch { return { in: 0, out: 0 }; }
}
function saveTokenStats(stats) { localStorage.setItem(TOKEN_STAT_KEY, JSON.stringify(stats)); }

function updateUsage(usage) {
  const stats = getTokenStats();
  const prompt = usage.prompt_tokens || 0;
  const completion = usage.completion_tokens || 0;
  stats.in += prompt;
  stats.out += completion;
  saveTokenStats(stats);
  document.getElementById("usage").innerHTML =
    `本次：入${prompt} 出${completion} 共${prompt+completion}<br>累计：入${stats.in} 出${stats.out} 共${stats.in+stats.out}`;
}

// ============ 核心发送（支持超时与重试） ============
async function send() {
  const text = input.value.trim();
  if (!text) return;

  const timeText = nowTime();
  addMessage(text, "user", timeText);
  input.value = "";

  memorySystem.extractFromMessage(text);
  messages.push({ role: "user", content: text, time: timeText });

  // 触发压缩
  if (messages.filter(m => m.role !== "system").length > SUMMARY_INTERVAL) {
    await contextManager.generateSummary(messages);
    // 保留最近10条 + system
    const systemOnly = messages.filter(m => m.role === "system");
    const recent = messages.filter(m => m.role !== "system").slice(-10);
    messages = [...systemOnly, ...recent];
  }

  const contextMessages = contextManager.buildContext(messages, text, memorySystem);

  // 调用API（带超时与重试）
  const fetchWithTimeout = (url, opts, timeout = TIMEOUT) => {
    return Promise.race([
      fetch(url, opts),
      new Promise((_, reject) => setTimeout(() => reject(new Error("请求超时")), timeout))
    ]);
  };

  try {
    const res = await fetchWithTimeout(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: contextMessages,
        temperature: 0.85,
        max_tokens: 600,          // 适当减少，节约token
        top_p: 0.9,
        frequency_penalty: 0.2,
        presence_penalty: 0.2,
        stream: false            // 如需流式可改为 true，但需调整显示逻辑
      })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    if (data.usage) updateUsage(data.usage);
    else document.getElementById("usage").innerText = "Token：未返回";

    const reply = data.choices?.[0]?.message?.content || "我走神了，再说一遍？";
    const replyTime = nowTime();
    messages.push({ role: "assistant", content: reply, time: replyTime });
    saveMessages();
    addMessage(reply, "ai", replyTime);

  } catch (error) {
    console.error(error);
    // 简单重试一次
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          messages: contextMessages,
          temperature: 0.7,
          max_tokens: 400,
          top_p: 0.9,
          frequency_penalty: 0.2,
          presence_penalty: 0.2
        })
      });
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || "网络不太好，但我还是想和你说...";
      messages.push({ role: "assistant", content: reply, time: nowTime() });
      saveMessages();
      addMessage(reply, "ai", nowTime());
    } catch {
      addMessage("网络出问题了，稍等我一下", "ai", nowTime());
    }
  }
}

// ============ 事件绑定 ============
sendBtn.addEventListener("click", send);
input.addEventListener("keydown", e => { if (e.key === "Enter") send(); });
plusBtn.addEventListener("click", () => { morePanel.classList.toggle("show"); });

headerAvatar.addEventListener("click", () => {
  fileInput.dataset.target = "ai";
  fileInput.click();
});

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const data = reader.result;
    if (fileInput.dataset.target === "ai") localStorage.setItem(AI_AVATAR_KEY, data);
    else localStorage.setItem(MY_AVATAR_KEY, data);
    applyAvatars();
  };
  reader.readAsDataURL(file);
});

chatImageInput.addEventListener("change", () => {
  const file = chatImageInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const timeText = nowTime();
    addImageMessage(reader.result, "user", timeText);
    messages.push({ role: "user", content: "[图片]", time: timeText });
    saveMessages();
  };
  reader.readAsDataURL(file);
});

// ============ 导出供插件使用 ============
window.LushiCore = {
  memorySystem,
  contextManager,
  addMessage,
  nowTime,
  getMemoryItems: () => memorySystem.memories,
  saveMemoryItems: () => memorySystem.save()
};

// ============ 启动 ============
applyAvatars();
renderSavedMessages();
