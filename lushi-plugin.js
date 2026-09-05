// ============ 插件系统 ============
const BG_KEY = "lushi_chat_bg";
const BUBBLE_COLOR_KEY = "lushi_bubble_color";
const BUBBLE_STYLE_KEY = "lushi_bubble_style";

const menuBtn = document.getElementById("menuBtn");
const settingsMenu = document.getElementById("settingsMenu");
const bgInput = document.getElementById("bgInput");
const memoryPanel = document.getElementById("memoryPanel");
const memoryList = document.getElementById("memoryList");
const memoryInput = document.getElementById("memoryInput");
const addMemoryBtn = document.getElementById("addMemoryBtn");
const closeMemoryBtn = document.getElementById("closeMemoryBtn");

// ============ 背景管理 ============
function applyBackground() {
  const bg = localStorage.getItem(BG_KEY);
  if (bg) {
    const messagesEl = document.getElementById("messages");
    messagesEl.style.backgroundImage = 'url("' + bg + '")';
    messagesEl.style.backgroundSize = "cover";
    messagesEl.style.backgroundPosition = "center";
  }
}

// ============ 气泡样式 ============
function applyBubbleStyle() {
  const color = localStorage.getItem(BUBBLE_COLOR_KEY) || "default";
  const style = localStorage.getItem(BUBBLE_STYLE_KEY) || "default";

  document.querySelectorAll(".user .bubble").forEach(el => {
    if (color === "pink") el.style.background = "#c96a8b";
    else if (color === "dark") el.style.background = "#2f3542";
    else if (color === "gradient") {
      el.style.background = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
    }
    else el.style.background = "#4a7ba6";
  });

  document.querySelectorAll(".bubble").forEach(el => {
    if (style === "square") el.style.borderRadius = "6px";
    else if (style === "round") el.style.borderRadius = "24px";
    else if (style === "bubble") {
      el.style.borderRadius = "16px 16px 16px 4px";
    }
    else el.style.borderRadius = "16px";
  });
}

// ============ 记忆库UI ============
function renderMemoryList() {
  const items = window.LushiCore ? window.LushiCore.getMemoryItems() : [];
  memoryList.innerHTML = "";

  if (!items.length) {
    memoryList.innerHTML = "<div style='color:#999; text-align:center; padding:20px;'>还没有记忆<br>和陆时多聊聊吧</div>";
    return;
  }

  const groups = {
    semantic: "📌 基础信息",
    emotional: "💭 情感记忆",
    episodic: "📅 事件记录"
  };

  for (const type of ["semantic", "emotional", "episodic"]) {
    const typeItems = items.filter(item => item.type === type);
    if (!typeItems.length) continue;

    const groupDiv = document.createElement("div");
    groupDiv.style.marginBottom = "15px";
    groupDiv.innerHTML = '<div style="font-weight:600; margin-bottom:8px; color:#4a7ba6;">' + groups[type] + '</div>';

    typeItems.forEach((item) => {
      const div = document.createElement("div");
      div.className = "memory-item";
      const span = document.createElement("span");
      span.textContent = item.content || item.event;
      const del = document.createElement("button");
      del.textContent = "删除";
      del.addEventListener("click", () => {
        const allItems = window.LushiCore.getMemoryItems();
        const globalIndex = allItems.indexOf(item);
        if (globalIndex > -1) {
          allItems.splice(globalIndex, 1);
          window.LushiCore.saveMemoryItems();
          renderMemoryList();
        }
      });
      div.appendChild(span);
      div.appendChild(del);
      groupDiv.appendChild(div);
    });

    memoryList.appendChild(groupDiv);
  }
}

// ============ 菜单事件 ============
menuBtn.addEventListener("click", () => {
  settingsMenu.classList.toggle("show");
  morePanel.classList.remove("show");
});

document.getElementById("bgSetting").addEventListener("click", () => {
  settingsMenu.classList.remove("show");
  bgInput.click();
});

bgInput.addEventListener("change", () => {
  const file = bgInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    localStorage.setItem(BG_KEY, reader.result);
    applyBackground();
  };
  reader.readAsDataURL(file);
});

document.getElementById("bubbleColorSetting").addEventListener("click", () => {
  const current = localStorage.getItem(BUBBLE_COLOR_KEY) || "default";
  const colors = ["default", "pink", "dark", "gradient"];
  const nextIndex = (colors.indexOf(current) + 1) % colors.length;
  localStorage.setItem(BUBBLE_COLOR_KEY, colors[nextIndex]);
  applyBubbleStyle();
  settingsMenu.classList.remove("show");
});

document.getElementById("bubbleStyleSetting").addEventListener("click", () => {
  const current = localStorage.getItem(BUBBLE_STYLE_KEY) || "default";
  const styles = ["default", "square", "round", "bubble"];
  const nextIndex = (styles.indexOf(current) + 1) % styles.length;
  localStorage.setItem(BUBBLE_STYLE_KEY, styles[nextIndex]);
  applyBubbleStyle();
  settingsMenu.classList.remove("show");
});

document.getElementById("memorySetting").addEventListener("click", () => {
  settingsMenu.classList.remove("show");
  memoryPanel.classList.add("show");
  renderMemoryList();
});

closeMemoryBtn.addEventListener("click", () => {
  memoryPanel.classList.remove("show");
});

addMemoryBtn.addEventListener("click", () => {
  const text = memoryInput.value.trim();
  if (!text) return;

  const memorySystem = window.LushiCore.memorySystem;
  memorySystem.addSemantic("manual", text, 2);
  memoryInput.value = "";
  renderMemoryList();
});

// ============ 更多面板 ============
document.getElementById("panelImage").addEventListener("click", () => {
  morePanel.classList.remove("show");
  document.getElementById("chatImageInput").click();
});

document.getElementById("panelFile").addEventListener("click", () => {
  morePanel.classList.remove("show");
  window.LushiCore.addMessage("[文件功能开发中]", "user", window.LushiCore.nowTime());
});

document.getElementById("panelCall").addEventListener("click", () => {
  morePanel.classList.remove("show");
  window.LushiCore.addMessage("想听你的声音了", "ai", window.LushiCore.nowTime());
});

document.getElementById("panelMusic").addEventListener("click", () => {
  morePanel.classList.remove("show");
  window.LushiCore.addMessage("找首歌一起听吧", "ai", window.LushiCore.nowTime());
});

// ============ 初始化 ============
applyBackground();
applyBubbleStyle();