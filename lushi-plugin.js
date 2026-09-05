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

function applyBackground() {
  const bg = localStorage.getItem(BG_KEY);
  if (bg) {
    document.getElementById("messages").style.backgroundImage = 'url("' + bg + '")';
  }
}

function applyBubbleStyle() {
  const color = localStorage.getItem(BUBBLE_COLOR_KEY) || "default";
  const style = localStorage.getItem(BUBBLE_STYLE_KEY) || "default";

  document.querySelectorAll(".user .bubble").forEach(el => {
    if (color === "pink") el.style.background = "#c96a8b";
    else if (color === "dark") el.style.background = "#2f3542";
    else el.style.background = "#4a7ba6";
  });

  document.querySelectorAll(".bubble").forEach(el => {
    if (style === "square") el.style.borderRadius = "6px";
    else if (style === "round") el.style.borderRadius = "24px";
    else el.style.borderRadius = "16px";
  });
}

function renderMemoryList() {
  const items = getMemoryItems();
  memoryList.innerHTML = "";
  if (!items.length) {
    memoryList.innerHTML = "<div style='color:#999'>还没有记忆</div>";
    return;
  }
  items.forEach((item, index) => {
    const div = document.createElement("div");
    div.className = "memory-item";
    const span = document.createElement("span");
    span.textContent = item.content;
    const del = document.createElement("button");
    del.textContent = "删除";
    del.addEventListener("click", () => {
      items.splice(index, 1);
      saveMemoryItems(items);
      renderMemoryList();
    });
    div.appendChild(span);
    div.appendChild(del);
    memoryList.appendChild(div);
  });
}

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
  const next = current === "default" ? "pink" : current === "pink" ? "dark" : "default";
  localStorage.setItem(BUBBLE_COLOR_KEY, next);
  applyBubbleStyle();
  settingsMenu.classList.remove("show");
});

document.getElementById("bubbleStyleSetting").addEventListener("click", () => {
  const current = localStorage.getItem(BUBBLE_STYLE_KEY) || "default";
  const next = current === "default" ? "square" : current === "square" ? "round" : "default";
  localStorage.setItem(BUBBLE_STYLE_KEY, next);
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
  const items = getMemoryItems();
  items.push({ keyword: "手动", content: text });
  saveMemoryItems(items);
  memoryInput.value = "";
  renderMemoryList();
});

document.getElementById("panelImage").addEventListener("click", () => {
  morePanel.classList.remove("show");
  document.getElementById("chatImageInput").click();
});

document.getElementById("panelFile").addEventListener("click", () => {
  morePanel.classList.remove("show");
  addMessage("[文件功能待开启]", "user", nowTime());
});

document.getElementById("panelCall").addEventListener("click", () => {
  morePanel.classList.remove("show");
  addMessage("[语音/视频通话待开启]", "user", nowTime());
});

document.getElementById("panelMusic").addEventListener("click", () => {
  morePanel.classList.remove("show");
  addMessage("[一起听歌待开启]", "user", nowTime());
});

applyBackground();
applyBubbleStyle();