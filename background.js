const tabUrls = new Map();

function addUrl(tabId, url) {
  if (tabId < 0) return;
  if (!tabUrls.has(tabId)) tabUrls.set(tabId, new Set());
  tabUrls.get(tabId).add(url);
}

function isM3U8(url) {
  try {
    const u = new URL(url);
    return u.pathname.toLowerCase().includes('.m3u8');
  } catch (e) {
    return url.toLowerCase().includes('.m3u8');
  }
}

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.tabId >= 0 && isM3U8(details.url)) addUrl(details.tabId, details.url);
  },
  { urls: ['<all_urls>'] }
);

chrome.webRequest.onResponseStarted.addListener(
  (details) => {
    if (details.tabId >= 0 && isM3U8(details.url)) addUrl(details.tabId, details.url);
  },
  { urls: ['<all_urls>'] }
);

chrome.tabs.onRemoved.addListener((tabId) => tabUrls.delete(tabId));

chrome.webNavigation && chrome.webNavigation.onCommitted &&
  chrome.webNavigation.onCommitted.addListener((details) => {
    if (details.frameId === 0) tabUrls.delete(details.tabId);
  });

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'video-m3u8',
    title: 'video-m3u8',
    contexts: ['page', 'frame', 'link', 'video', 'audio', 'image', 'selection']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'video-m3u8' || !tab || tab.id < 0) return;
  const urls = Array.from(tabUrls.get(tab.id) || []);
  const iconUrl = chrome.runtime.getURL('icon48.png');
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    args: [urls, iconUrl],
    func: renderOverlay
  }).catch((err) => console.warn('video-m3u8 inject failed:', err));
});

function renderOverlay(urls, iconUrl) {
  const HOST_ID = '__video_m3u8_overlay__';
  document.getElementById(HOST_ID)?.remove();

  function outputName(url) {
    try {
      const u = new URL(url);
      const last = (u.pathname.split('/').pop() || '').toLowerCase();
      const m = last.match(/(.+?)\.m3u8/);
      if (m && m[1]) return m[1];
    } catch (e) {}
    return 'video';
  }
  function ffmpegCommand(url) {
    return `ffmpeg -protocol_whitelist file,http,https,tcp,tls,crypto -i "${url}" -c copy ${outputName(url)}.mp4`;
  }
  function sortUrls(list) {
    const priority = [], rest = [];
    for (const u of list) {
      if (u.toLowerCase().includes('video.m3u8')) priority.push(u);
      else rest.push(u);
    }
    return [...priority, ...rest];
  }

  const sorted = sortUrls(urls);
  const host = document.createElement('div');
  host.id = HOST_ID;
  host.style.cssText = 'all:initial;position:fixed;top:20px;right:20px;z-index:2147483647;';
  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = `
    :host, .panel, .panel * { box-sizing: border-box; }
    .panel {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      width: 480px;
      max-height: 70vh;
      background: #1e1e1e;
      color: #e8e8e8;
      border: 1px solid #3a3a3a;
      border-radius: 8px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.5);
      display: flex;
      flex-direction: column;
      font-size: 13px;
      overflow: hidden;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      background: #252525;
      border-bottom: 1px solid #3a3a3a;
      cursor: move;
      user-select: none;
    }
    .title-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .icon-img {
      width: 20px;
      height: 20px;
      border-radius: 4px;
      display: block;
    }
    h1 {
      font-size: 13px;
      font-weight: 600;
      margin: 0;
      color: #fff;
    }
    .count { color: #6bb86b; }
    .toolbar {
      display: flex;
      gap: 6px;
      padding: 8px 12px;
      border-bottom: 1px solid #3a3a3a;
    }
    button {
      background: #0e639c;
      color: #fff;
      border: none;
      border-radius: 4px;
      padding: 5px 10px;
      cursor: pointer;
      font-size: 12px;
      font-family: inherit;
    }
    button:hover { background: #1177bb; }
    button.secondary { background: #3a3a3a; }
    button.secondary:hover { background: #4a4a4a; }
    button.icon { background: transparent; padding: 4px 8px; font-size: 16px; line-height: 1; }
    button.icon:hover { background: #3a3a3a; }
    .list { overflow: auto; padding: 8px 12px; }
    .item {
      background: #2a2a2a;
      border: 1px solid #3a3a3a;
      border-radius: 6px;
      padding: 8px;
      margin-bottom: 6px;
      display: flex;
      gap: 6px;
      align-items: flex-start;
    }
    .url {
      flex: 1;
      word-break: break-all;
      color: #9cdcfe;
      font-family: ui-monospace, Menlo, Consolas, monospace;
      font-size: 11px;
      line-height: 1.4;
    }
    .empty {
      padding: 20px;
      text-align: center;
      color: #888;
      font-style: italic;
      line-height: 1.5;
    }
  `;
  shadow.appendChild(style);

  const panel = document.createElement('div');
  panel.className = 'panel';

  const header = document.createElement('header');
  const titleWrap = document.createElement('div');
  titleWrap.className = 'title-wrap';
  if (iconUrl) {
    const iconImg = document.createElement('img');
    iconImg.className = 'icon-img';
    iconImg.src = iconUrl;
    iconImg.alt = '';
    titleWrap.appendChild(iconImg);
  }
  const title = document.createElement('h1');
  title.innerHTML = `video-m3u8 — <span class="count">${sorted.length}</span> stream(s)`;
  titleWrap.appendChild(title);
  const closeBtn = document.createElement('button');
  closeBtn.className = 'icon';
  closeBtn.textContent = '×';
  closeBtn.title = 'Close';
  closeBtn.addEventListener('click', () => host.remove());
  header.appendChild(titleWrap);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  if (sorted.length) {
    const list = document.createElement('div');
    list.className = 'list';
    for (const url of sorted) {
      const item = document.createElement('div');
      item.className = 'item';
      const span = document.createElement('span');
      span.className = 'url';
      span.textContent = ffmpegCommand(url);
      const copy = document.createElement('button');
      copy.textContent = 'Copy';
      copy.addEventListener('click', () => {
        navigator.clipboard.writeText(ffmpegCommand(url)).then(() => {
          copy.textContent = 'Copied';
          setTimeout(() => (copy.textContent = 'Copy'), 1000);
        });
      });
      item.appendChild(span);
      item.appendChild(copy);
      list.appendChild(item);
    }
    panel.appendChild(list);
  } else {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.innerHTML = 'No .m3u8 URLs detected for this tab yet.<br>Start playback, then re-open this menu.';
    panel.appendChild(empty);
  }

  let dragging = false, offX = 0, offY = 0;
  header.addEventListener('mousedown', (e) => {
    dragging = true;
    const rect = host.getBoundingClientRect();
    offX = e.clientX - rect.left;
    offY = e.clientY - rect.top;
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    host.style.left = (e.clientX - offX) + 'px';
    host.style.top = (e.clientY - offY) + 'px';
    host.style.right = 'auto';
  });
  window.addEventListener('mouseup', () => (dragging = false));

  shadow.appendChild(panel);
  document.documentElement.appendChild(host);
}
