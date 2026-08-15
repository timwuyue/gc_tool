// DSH Agent launcher for ComfyUI.
// Lightweight chat window talking to the REAL agent through the dsh-launcher
// backend (POST /dsh/chat -> DSH harness session.prompt -> this session).
// Pure DOM, no iframe: dragging is smooth. Minimize keeps the conversation
// (the window DOM is hidden, not destroyed). Assistant messages render
// minimal Markdown.
(function () {
  "use strict";
  var LS_KEY = "dsh-agent-window";
  var POLL_MS = 700;

  // Official DSH favicon path (from http://127.0.0.1:3080/favicon.svg)
  var ICON_PATH =
    "M48.8354 10.0479C48.3232 9.79199 48.1025 10.2798 47.8032 10.5278C47.7007 10.6079 47.6143 10.7119 47.5273 10.8076C46.7793 11.624 45.9048 12.1597 44.7622 12.0957C43.0923 12 41.666 12.5356 40.4058 13.8398C40.1377 12.2319 39.2476 11.272 37.8926 10.6558C37.1836 10.3359 36.4668 10.0156 35.9702 9.31982C35.6235 8.82373 35.5293 8.27197 35.356 7.72754C35.2456 7.3999 35.1353 7.06396 34.7651 7.00781C34.3633 6.94385 34.2056 7.2876 34.0479 7.57568C33.418 8.75195 33.1733 10.0479 33.1973 11.3599C33.2524 14.312 34.4736 16.6641 36.8999 18.3359C37.1758 18.5278 37.2466 18.7197 37.1597 19C36.9946 19.5757 36.7974 20.1357 36.624 20.7119C36.5137 21.0801 36.3486 21.1597 35.9624 21C34.6309 20.4321 33.481 19.5918 32.4644 18.5757C30.7393 16.8721 29.1792 14.9917 27.2334 13.52C26.7764 13.1758 26.3193 12.856 25.8467 12.5518C23.8618 10.584 26.1069 8.96777 26.627 8.77588C27.1704 8.57568 26.8159 7.8877 25.0591 7.896C23.3022 7.90381 21.6953 8.50391 19.647 9.30371C19.3477 9.42383 19.0322 9.51172 18.7095 9.58398C16.8501 9.22363 14.9199 9.14355 12.9033 9.37598C9.10596 9.80762 6.07275 11.6396 3.84326 14.7681C1.16455 18.5278 0.53418 22.7998 1.30664 27.2559C2.11768 31.9521 4.46582 35.8398 8.07373 38.8799C11.8159 42.0322 16.1255 43.5762 21.041 43.2803C24.0269 43.104 27.3516 42.6963 31.1016 39.4561C32.0469 39.936 33.0396 40.1279 34.686 40.272C35.9546 40.3921 37.1758 40.208 38.1211 40.0078C39.6021 39.688 39.4995 38.2881 38.9639 38.0322C34.623 35.9678 35.5762 36.8081 34.71 36.1279C36.9155 33.4639 40.2402 30.6958 41.54 21.728C41.6426 21.0161 41.5557 20.5679 41.54 19.9917C41.5322 19.6396 41.6108 19.5039 42.0049 19.4639C43.0923 19.3359 44.1479 19.0317 45.1167 18.4878C47.9292 16.9199 49.064 14.3438 49.3315 11.2559C49.3711 10.7837 49.3237 10.2959 48.8354 10.0479ZM24.3262 37.8398C20.1196 34.4639 18.0791 33.3521 17.2358 33.3999C16.4482 33.4482 16.5898 34.3682 16.7632 34.9678C16.9443 35.5601 17.1812 35.9683 17.5117 36.4878C17.7402 36.832 17.8979 37.3442 17.2832 37.728C15.9282 38.584 13.5728 37.4399 13.4624 37.3838C10.7207 35.7358 8.42822 33.5601 6.81348 30.584C5.25342 27.7197 4.34766 24.6479 4.19775 21.3677C4.1582 20.5757 4.38672 20.2959 5.15869 20.1519C6.17529 19.96 7.22314 19.9199 8.23926 20.0718C12.5327 20.7119 16.1885 22.6719 19.2529 25.7759C21.002 27.5439 22.3252 29.6558 23.6885 31.7202C25.1377 33.9121 26.6978 36 28.6831 37.7119C29.3843 38.312 29.9434 38.7681 30.479 39.104C28.8643 39.2881 26.1699 39.3281 24.3262 37.8398ZM26.3433 24.6001C26.3433 24.248 26.6191 23.9678 26.9658 23.9678C27.0444 23.9678 27.1152 23.9839 27.1782 24.0078C27.2651 24.04 27.3438 24.0879 27.4067 24.1602C27.5171 24.272 27.5801 24.4321 27.5801 24.6001C27.5801 24.9521 27.3042 25.2319 26.9575 25.2319C26.6108 25.2319 26.3433 24.9521 26.3433 24.6001ZM32.6064 27.8799C32.2046 28.0479 31.8027 28.1919 31.4165 28.208C30.8179 28.2397 30.1641 27.9922 29.8096 27.688C29.2583 27.2158 28.8643 26.9521 28.6987 26.1279C28.6279 25.7759 28.6675 25.2319 28.7305 24.9199C28.8721 24.248 28.7144 23.8159 28.2495 23.4238C27.8716 23.104 27.3911 23.0161 26.8633 23.0161C26.666 23.0161 26.4849 22.9277 26.3511 22.856C26.1304 22.7441 25.9492 22.4639 26.1226 22.1201C26.1777 22.0078 26.4458 21.7358 26.5088 21.688C27.2256 21.272 28.0527 21.4077 28.8169 21.7197C29.5259 22.0161 30.0615 22.5601 30.834 23.3281C31.6216 24.2559 31.7632 24.5117 32.2124 25.208C32.5669 25.752 32.8901 26.312 33.1104 26.9521C33.2446 27.3521 33.0713 27.6802 32.6064 27.8799Z";

  var btn = null;
  var win = null;
  var visible = false;
  var maxed = false;
  var normRect = null;
  var sessionId = null;
  var sessionTitle = "";
  var sinceSeq = -1;
  var pollTimer = null;
  var curAgentEl = null;
  var toolChips = {};
  var busy = false;

  // window title: "\u4e00\u638c\u5288\u5f00\u5929" = "一掌劈开天"
  var WIN_TITLE = "\u4e00\u638c\u5288\u5f00\u5929";

  // ---------- minimal markdown ----------

  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function inline(s) {
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*(?!\*)/g, "$1<em>$2</em>");
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>');
    // /view?... image urls -> clickable inline thumbnails
    s = s.replace(/(\/view\?[^\s"<>\]]+)/g, function (m) {
      return '<img src="' + m + '" style="max-width:100%;max-height:220px;border-radius:6px;display:block;margin:4px 0;cursor:zoom-in;" onclick="window.open(this.src,\'_blank\')">';
    });
    // local file paths -> image thumbnails or links through /dsh/view
    s = s.replace(/([A-Za-z]:\\[^\s"<>\]]+)/g, function (m) {
      var enc = encodeURIComponent(m);
      var parts = m.split(".");
      var ext = (parts.length > 1 ? parts[parts.length - 1] : "").toLowerCase();
      var isImg = ["png", "jpg", "jpeg", "webp", "gif", "bmp"].indexOf(ext) >= 0;
      if (isImg) {
        return '<img src="/dsh/view?path=' + enc + '" style="max-width:100%;max-height:220px;border-radius:6px;display:block;margin:4px 0;cursor:zoom-in;" onclick="window.open(\'/dsh/view?path=' + enc + '\',\'_blank\')">';
      }
      return '<a href="/dsh/view?path=' + enc + '" target="_blank">' + m + "</a>";
    });
    return s;
  }

  function renderMd(src) {
    if (!src) return "";
    var lines = esc(src).split(/\r?\n/);
    var out = [];
    var i = 0;
    var inCode = false;
    var codeBuf = [];
    while (i < lines.length) {
      var line = lines[i];
      if (/^```/.test(line)) {
        if (inCode) {
          out.push("<pre><code>" + codeBuf.join("\n") + "</code></pre>");
          codeBuf = [];
          inCode = false;
        } else {
          inCode = true;
        }
        i++;
        continue;
      }
      if (inCode) { codeBuf.push(line); i++; continue; }
      var h = line.match(/^(#{1,4})\s+(.*)$/);
      if (h) {
        var lv = h[1].length + 1;
        out.push("<h" + lv + ">" + inline(h[2]) + "</h" + lv + ">");
        i++;
        continue;
      }
      if (/^\s*---+\s*$/.test(line)) { out.push("<hr>"); i++; continue; }
      // markdown table: header | separator | rows
      if (/^\s*\|/.test(line) && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1] || "")) {
        var tbl = [];
        var head = lines[i].replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|");
        var body = [];
        i += 2;
        while (i < lines.length && /^\s*\|/.test(lines[i])) {
          body.push(lines[i].replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|"));
          i++;
        }
        var th = head.map(function (c) { return "<th>" + inline(c.trim()) + "</th>"; }).join("");
        tbl.push("<table><thead><tr>" + th + "</tr></thead><tbody>");
        for (var r = 0; r < body.length; r++) {
          var tds = [];
          for (var c2 = 0; c2 < head.length; c2++) {
            var cell = body[r][c2] !== undefined ? body[r][c2].trim() : "";
            tds.push("<td>" + inline(cell) + "</td>");
          }
          tbl.push("<tr>" + tds.join("") + "</tr>");
        }
        tbl.push("</tbody></table>");
        out.push(tbl.join(""));
        continue;
      }
      if (/^\s*[-*]\s+/.test(line)) {
        var items = [];
        while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
          items.push("<li>" + inline(lines[i].replace(/^\s*[-*]\s+/, "")) + "</li>");
          i++;
        }
        out.push("<ul>" + items.join("") + "</ul>");
        continue;
      }
      if (/^\s*\d+\.\s+/.test(line)) {
        var oi = [];
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
          oi.push("<li>" + inline(lines[i].replace(/^\s*\d+\.\s+/, "")) + "</li>");
          i++;
        }
        out.push("<ol>" + oi.join("") + "</ol>");
        continue;
      }
      if (/^>\s?/.test(line)) {
        var q = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) {
          q.push(inline(lines[i].replace(/^>\s?/, "")));
          i++;
        }
        out.push("<blockquote>" + q.join("<br>") + "</blockquote>");
        continue;
      }
      if (/^\s*$/.test(line)) { out.push(""); i++; continue; }
      out.push("<p>" + inline(line) + "</p>");
      i++;
    }
    if (inCode && codeBuf.length) out.push("<pre><code>" + codeBuf.join("\n") + "</code></pre>");
    return out.join("");
  }

  // ---------- window plumbing ----------

  function loadRect() {
    try {
      var s = JSON.parse(localStorage.getItem(LS_KEY) || "null");
      if (s && typeof s === "object" && typeof s.w === "number") return s;
    } catch (e) {}
    return null;
  }

  function saveRect() {
    if (maxed || !win) return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        left: win.style.left || null, top: win.style.top || null,
        right: win.style.right || null, bottom: win.style.bottom || null,
        w: win.offsetWidth, h: win.offsetHeight,
      }));
    } catch (e) {}
  }

  function makeBtn() {
    if (btn) return;
    btn = document.createElement("button");
    btn.id = "dsh-launch-btn";
    btn.title = WIN_TITLE;
    btn.style.cssText =
      "position:fixed;right:16px;top:70px;z-index:999999;width:42px;height:42px;" +
      "border-radius:10px;border:none;cursor:pointer;outline:none;" +
      "background:#1f2937;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.35);" +
      "display:flex;align-items:center;justify-content:center;";
    btn.innerHTML =
      '<svg width="26" height="26" viewBox="0 0 50 50" fill="currentColor" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="' + ICON_PATH + '"/></svg>';
    // draggable button (press and drag to move; click toggles)
    var moved = false;
    var dragging = false;
    btn.addEventListener("mousedown", function (e) {
      if (e.button !== 0) return;
      dragging = true;
      moved = false;
      var sx = e.clientX, sy = e.clientY;
      var rect = btn.getBoundingClientRect();
      var ox = e.clientX - rect.left, oy = e.clientY - rect.top;
      function mv(ev) {
        if (!dragging) return;
        if (!moved && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 4) return;
        moved = true;
        btn.style.left = (ev.clientX - ox) + "px";
        btn.style.top = (ev.clientY - oy) + "px";
        btn.style.right = "auto";
        btn.style.bottom = "auto";
      }
      function up() {
        dragging = false;
        document.removeEventListener("mousemove", mv);
        document.removeEventListener("mouseup", up);
        if (moved) {
          try {
            localStorage.setItem("dsh-agent-btn",
              JSON.stringify({ left: btn.style.left, top: btn.style.top }));
          } catch (err) {}
        }
      }
      document.addEventListener("mousemove", mv);
      document.addEventListener("mouseup", up);
    });
    btn.addEventListener("click", function (e) {
      if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; return; }
      toggle();
    });
    // restore saved position
    try {
      var bs = JSON.parse(localStorage.getItem("dsh-agent-btn") || "null");
      if (bs && bs.left) {
        btn.style.left = bs.left;
        btn.style.top = bs.top;
        btn.style.right = "auto";
        btn.style.bottom = "auto";
      }
    } catch (err) {}
    document.body.appendChild(btn);
  }

  function mkBtn(label, tip, fn) {
    var b = document.createElement("button");
    b.textContent = label;
    b.title = tip;
    b.style.cssText =
      "background:transparent;border:none;color:#8b949e;cursor:pointer;" +
      "font-size:13px;padding:2px 6px;border-radius:4px;line-height:1;";
    b.onmouseenter = function () { b.style.color = "#e6edf3"; };
    b.onmouseleave = function () { b.style.color = "#8b949e"; };
    b.onclick = fn;
    return b;
  }

  function injectStyles() {
    if (document.getElementById("dsh-styles")) return;
    var st = document.createElement("style");
    st.id = "dsh-styles";
    st.textContent =
      "#dsh-msgs p { margin: 4px 0; }" +
      "#dsh-msgs h1, #dsh-msgs h2, #dsh-msgs h3, #dsh-msgs h4 { margin: 8px 0 4px; font-weight: 700; }" +
      "#dsh-msgs h1 { font-size: 16px; } #dsh-msgs h2 { font-size: 15px; }" +
      "#dsh-msgs h3 { font-size: 14px; } #dsh-msgs h4 { font-size: 13px; }" +
      "#dsh-msgs ul, #dsh-msgs ol { margin: 4px 0; padding-left: 20px; }" +
      "#dsh-msgs li { margin: 2px 0; }" +
      "#dsh-msgs blockquote { margin: 4px 0; padding: 2px 10px; border-left: 3px solid #3b82f6; color: #9ca3af; }" +
      "#dsh-msgs code { background: #161b22; border-radius: 4px; padding: 1px 5px; font-size: 12px; font-family: Consolas, monospace; color: #93c5fd; }" +
      "#dsh-msgs pre { background: #161b22; border-radius: 6px; padding: 8px 10px; overflow-x: auto; margin: 6px 0; }" +
      "#dsh-msgs pre code { background: none; padding: 0; color: #e6edf3; }" +
      "#dsh-msgs a { color: #60a5fa; text-decoration: underline; }" +
      "#dsh-msgs hr { border: none; border-top: 1px solid rgba(255,255,255,.15); margin: 6px 0; }" +
      "#dsh-msgs table { border-collapse: collapse; margin: 6px 0; width: 100%; font-size: 12px; }" +
      "#dsh-msgs th, #dsh-msgs td { border: 1px solid rgba(255,255,255,.18); padding: 4px 8px; text-align: left; }" +
      "#dsh-msgs th { background: #161b22; font-weight: 600; }" +
      "#dsh-msgs tr:nth-child(even) td { background: rgba(255,255,255,.03); }" +
      "#dsh-msgs .dsh-card { align-self: flex-start; border-radius: 12px; padding: 12px 14px; max-width: 94%; font-size: 13px; background: linear-gradient(180deg,#1a2029,#161b22); border: 1px solid rgba(255,255,255,.12); box-shadow: 0 4px 16px rgba(0,0,0,.35); animation: dshPop .18s ease; }" +
      "@keyframes dshPop { from { opacity: 0; transform: translateY(6px) scale(.98); } to { opacity: 1; transform: none; } }" +
      "#dsh-msgs .dsh-card-head { display: flex; align-items: center; gap: 7px; font-weight: 700; font-size: 12px; letter-spacing: .4px; padding-bottom: 8px; margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,.08); }" +
      "#dsh-msgs .dsh-card-head .dsh-ico { width: 20px; height: 20px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 12px; flex: 0 0 auto; }" +
      "#dsh-msgs .dsh-q-head .dsh-ico { background: rgba(59,130,246,.18); }" +
      "#dsh-msgs .dsh-q-head { color: #93c5fd; }" +
      "#dsh-msgs .dsh-a-head .dsh-ico { background: rgba(245,158,11,.18); }" +
      "#dsh-msgs .dsh-a-head { color: #fbbf24; }" +
      "#dsh-msgs .dsh-q-header { color: #93c5fd; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; margin: 10px 0 2px; }" +
      "#dsh-msgs .dsh-q-title { color: #e6edf3; margin: 2px 0 6px; line-height: 1.55; }" +
      "#dsh-msgs .dsh-q-detail { color: #8b949e; font-size: 12px; margin-bottom: 8px; line-height: 1.5; }" +
      "#dsh-msgs .dsh-opts { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }" +
      "#dsh-msgs .dsh-opt { background: rgba(147,197,253,.06); color: #93c5fd; border: 1px solid rgba(147,197,253,.4); border-radius: 8px; padding: 5px 12px; font-size: 12px; cursor: pointer; transition: all .12s ease; }" +
      "#dsh-msgs .dsh-opt:hover { border-color: #60a5fa; background: rgba(59,130,246,.15); transform: translateY(-1px); }" +
      "#dsh-msgs .dsh-opt.sel { background: linear-gradient(135deg,#2563eb,#1d4ed8); color: #fff; border-color: #2563eb; box-shadow: 0 2px 8px rgba(37,99,235,.35); }" +
      "#dsh-msgs .dsh-multi-hint { color: #6b7280; font-size: 11px; margin-bottom: 6px; }" +
      "#dsh-msgs .dsh-foot { display: flex; gap: 8px; align-items: center; margin-top: 6px; }" +
      "#dsh-msgs .dsh-input { flex: 1; background: #0d1117; color: #e6edf3; border: 1px solid rgba(255,255,255,.14); border-radius: 8px; padding: 6px 10px; font-size: 12px; outline: none; min-width: 0; }" +
      "#dsh-msgs .dsh-input:focus { border-color: #3b82f6; }" +
      "#dsh-msgs .dsh-btn { border: none; border-radius: 8px; padding: 6px 16px; font-size: 12px; font-weight: 600; cursor: pointer; color: #fff; transition: filter .12s ease, transform .05s ease; }" +
      "#dsh-msgs .dsh-btn:hover { filter: brightness(1.15); }" +
      "#dsh-msgs .dsh-btn:active { transform: scale(.96); }" +
      "#dsh-msgs .dsh-btn:disabled { opacity: .5; cursor: default; filter: none; }" +
      "#dsh-msgs .dsh-btn-primary { background: linear-gradient(135deg,#3b82f6,#2563eb); box-shadow: 0 2px 8px rgba(59,130,246,.35); }" +
      "#dsh-msgs .dsh-btn-allow { background: linear-gradient(135deg,#22c55e,#16a34a); box-shadow: 0 2px 8px rgba(34,197,94,.35); }" +
      "#dsh-msgs .dsh-btn-deny { background: linear-gradient(135deg,#ef4444,#dc2626); box-shadow: 0 2px 8px rgba(239,68,68,.35); }" +
      "#dsh-msgs .dsh-btn-ok { background: linear-gradient(135deg,#22c55e,#16a34a); box-shadow: 0 2px 8px rgba(34,197,94,.35); }" +
      "#dsh-msgs .dsh-tool-badge { display: inline-block; background: #2d3748; color: #93c5fd; font-family: Consolas,monospace; font-size: 11px; padding: 3px 9px; border-radius: 6px; border: 1px solid rgba(147,197,253,.25); }" +
      "#dsh-msgs .dsh-reason { background: rgba(245,158,11,.07); border-left: 3px solid #f59e0b; padding: 7px 11px; border-radius: 0 8px 8px 0; color: #d6d3d1; font-size: 12px; margin: 8px 0 10px; line-height: 1.55; }" +
      "#dsh-msgs .dsh-result { color: #6b7280; font-size: 11px; margin-top: 8px; padding-top: 8px; border-top: 1px dashed rgba(255,255,255,.1); }" +
      "#dsh-msgs .dsh-result.ok { color: #4ade80; }" +
      "#dsh-msgs .dsh-result.no { color: #f87171; }";
    document.head.appendChild(st);
  }

  function makeWin() {
    if (win) return;
    injectStyles();
    win = document.createElement("div");
    win.id = "dsh-window";
    win.style.cssText =
      "position:fixed;z-index:999998;background:#0d1117;border:1px solid rgba(255,255,255,.14);" +
      "border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,.35);overflow:hidden;" +
      "display:flex;flex-direction:column;";
    var r = loadRect();
    if (r && r.left) { win.style.left = r.left; win.style.top = r.top; }
    else { win.style.right = "16px"; win.style.bottom = "16px"; }
    win.style.width = (r && r.w ? r.w : 460) + "px";
    win.style.height = (r && r.h ? r.h : 640) + "px";

    var bar = document.createElement("div");
    bar.style.cssText =
      "display:flex;align-items:center;gap:6px;padding:6px 8px;cursor:move;" +
      "background:#161b22;border-bottom:1px solid rgba(255,255,255,.1);" +
      "flex:0 0 auto;user-select:none;";
    var dot = document.createElement("span");
    dot.id = "dsh-dot";
    dot.style.cssText = "width:8px;height:8px;border-radius:50%;background:#22c55e;flex:0 0 auto;";
    var title = document.createElement("span");
    title.id = "dsh-title";
    title.textContent = WIN_TITLE;
    title.style.cssText = "color:#e6edf3;font-size:13px;font-weight:600;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
    var stopBtn = mkBtn("\u25a0", "Stop", stopTurn);
    stopBtn.style.display = "none";
    stopBtn.id = "dsh-stop-btn";
    var minBtn = mkBtn("\u2013", "Minimize", function () { hide(); });
    var maxBtn = mkBtn("\u25a1", "Maximize / Restore", function () { toggleMax(); });
    var newTabBtn = mkBtn("\u2197", "Open full UI in new tab", function () { window.open("http://127.0.0.1:3080/", "_blank"); });
    var closeBtn = mkBtn("\u2715", "Close", function () { hide(); });
    bar.appendChild(dot);
    bar.appendChild(title);
    bar.appendChild(stopBtn);
    bar.appendChild(minBtn);
    bar.appendChild(maxBtn);
    bar.appendChild(newTabBtn);
    bar.appendChild(closeBtn);
    win.appendChild(bar);

    var msgs = document.createElement("div");
    msgs.id = "dsh-msgs";
    msgs.style.cssText =
      "flex:1;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:8px;" +
      "background:#0d1117;";
    win.appendChild(msgs);

    var inputRow = document.createElement("div");
    inputRow.style.cssText =
      "display:flex;gap:6px;padding:8px;border-top:1px solid rgba(255,255,255,.1);" +
      "background:#161b22;flex:0 0 auto;";
    var ta = document.createElement("textarea");
    ta.id = "dsh-input";
    ta.placeholder = "Message the agent... (Enter to send)";
    ta.style.cssText =
      "flex:1;background:#0d1117;color:#e6edf3;border:1px solid rgba(255,255,255,.15);" +
      "border-radius:6px;padding:8px;font-size:13px;resize:none;height:38px;outline:none;";
    ta.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); }
    });
    var sendBtn = document.createElement("button");
    sendBtn.textContent = "Send";
    sendBtn.style.cssText =
      "background:#3b82f6;color:#fff;border:none;border-radius:6px;padding:0 14px;" +
      "cursor:pointer;font-size:13px;font-weight:600;";
    sendBtn.onclick = sendMsg;
    inputRow.appendChild(ta);
    inputRow.appendChild(sendBtn);
    win.appendChild(inputRow);

    var grip = document.createElement("div");
    grip.style.cssText =
      "position:absolute;right:0;bottom:0;width:14px;height:14px;cursor:nwse-resize;" +
      "background:linear-gradient(135deg,transparent 50%,rgba(255,255,255,.2) 50%);";
    grip.addEventListener("mousedown", function (e) {
      e.preventDefault(); e.stopPropagation();
      var sw = win.offsetWidth, sh = win.offsetHeight, sx = e.clientX, sy = e.clientY;
      function mv(ev) {
        win.style.width = Math.max(360, sw + (ev.clientX - sx)) + "px";
        win.style.height = Math.max(320, sh + (ev.clientY - sy)) + "px";
      }
      function up() {
        document.removeEventListener("mousemove", mv);
        document.removeEventListener("mouseup", up);
        saveRect();
      }
      document.addEventListener("mousemove", mv);
      document.addEventListener("mouseup", up);
    });
    win.appendChild(grip);

    document.body.appendChild(win);

    bar.addEventListener("mousedown", function (e) {
      if (e.target.tagName === "BUTTON") return;
      e.preventDefault();
      var ox = e.clientX - win.getBoundingClientRect().left;
      var oy = e.clientY - win.getBoundingClientRect().top;
      function mv(ev) {
        win.style.left = (ev.clientX - ox) + "px";
        win.style.top = (ev.clientY - oy) + "px";
        win.style.right = "auto";
        win.style.bottom = "auto";
      }
      function up() {
        document.removeEventListener("mousemove", mv);
        document.removeEventListener("mouseup", up);
        saveRect();
      }
      document.addEventListener("mousemove", mv);
      document.addEventListener("mouseup", up);
    });
  }

  function toggleMax() {
    if (!win) return;
    if (!maxed) {
      normRect = {
        left: win.style.left, top: win.style.top,
        right: win.style.right, bottom: win.style.bottom,
        w: win.offsetWidth, h: win.offsetHeight,
      };
      maxed = true;
      win.style.left = "0px"; win.style.top = "0px";
      win.style.right = "auto"; win.style.bottom = "auto";
      win.style.width = "100vw"; win.style.height = "100vh";
      win.style.borderRadius = "0";
    } else {
      maxed = false;
      if (normRect) {
        win.style.left = normRect.left; win.style.top = normRect.top;
        win.style.right = normRect.right; win.style.bottom = normRect.bottom;
        win.style.width = normRect.w + "px"; win.style.height = normRect.h + "px";
      } else {
        win.style.right = "16px"; win.style.bottom = "16px";
        win.style.width = "460px"; win.style.height = "640px";
      }
      win.style.borderRadius = "8px";
      saveRect();
    }
  }

  // ---------- chat logic ----------

  function addMsg(role, text) {
    var msgs = document.getElementById("dsh-msgs");
    var el = document.createElement("div");
    el.style.cssText =
      "max-width:92%;padding:8px 10px;border-radius:8px;font-size:13px;line-height:1.55;" +
      "word-break:break-word;overflow-wrap:anywhere;";
    if (role === "user") {
      el.style.alignSelf = "flex-end";
      el.style.background = "#1d4ed8";
      el.style.color = "#fff";
      el.style.whiteSpace = "pre-wrap";
      el.textContent = text;
      msgs.appendChild(el);
    } else {
      el.style.alignSelf = "flex-start";
      el.style.background = "#21262d";
      el.style.color = "#e6edf3";
      el.__md = text || "";
      // Defer insertion: an empty assistant bubble (created by thinking or
      // tool events) must NOT appear in the DOM until it has real content.
      if (el.__md) {
        el.innerHTML = renderMd(el.__md) || "\u200b";
        msgs.appendChild(el);
      } else {
        el.__deferred = true;
      }
    }
    el.dataset.role = role;
    if (!el.__deferred) {
      msgs.scrollTop = msgs.scrollHeight;
    }
    return el;
  }

  function currentAgentEl() {
    var msgs = document.getElementById("dsh-msgs");
    if (curAgentEl && curAgentEl.isConnected) return curAgentEl;
    curAgentEl = addMsg("assistant", "");
    return curAgentEl;
  }

  function attachAgentEl(el) {
    if (!el || !el.__deferred) return;
    el.__deferred = false;
    var msgs = document.getElementById("dsh-msgs");
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function toolChipEl(index) {
    if (toolChips[index]) return toolChips[index];
    var msgs = document.getElementById("dsh-msgs");
    var chip = document.createElement("div");
    chip.style.cssText =
      "align-self:flex-start;background:#2d3748;color:#93c5fd;font-size:11px;" +
      "padding:2px 8px;border-radius:10px;font-family:monospace;";
    chip.textContent = "tool...";
    // only insert above an existing agent bubble; never force one into being
    if (curAgentEl && curAgentEl.isConnected) {
      msgs.insertBefore(chip, curAgentEl);
    } else {
      msgs.appendChild(chip);
    }
    toolChips[index] = chip;
    return chip;
  }

  var mdTimer = null;
  function appendAgentText(el, delta) {
    el.__md = (el.__md || "") + delta;
    // attach the deferred bubble now that it has content
    attachAgentEl(el);
    // stream as plain text (cheap); re-render markdown on pause or completion
    el.textContent = el.__md;
    if (mdTimer) clearTimeout(mdTimer);
    mdTimer = setTimeout(function () {
      if (el.isConnected) el.innerHTML = renderMd(el.__md) || "\u200b";
    }, 400);
  }

  function handleEvent(ev) {
    var t = ev.type;
    if (t === "assistant/chunk") {
      var c = (ev.data && ev.data.chunk) || {};
      var ct = c.type;
      if (ct === "text-delta" && c.text) {
        appendAgentText(currentAgentEl(), c.text);
      } else if (ct === "tool-call-delta" && c.name) {
        var chip = toolChipEl(c.index || 0);
        if (!chip.dataset.name) {
          chip.dataset.name = c.name;
          chip.textContent = "\u2699 " + c.name;
        }
      } else if (ct === "reasoning-delta") {
        // thinking: just note it on the current bubble if one exists;
        // NEVER create a bubble for reasoning alone
        if (curAgentEl && curAgentEl.isConnected && !curAgentEl.dataset.thinking) {
          curAgentEl.dataset.thinking = "1";
          curAgentEl.style.opacity = "0.7";
        }
      } else if (ct === "block-end" && c.block && c.block.type === "text") {
        if (curAgentEl && curAgentEl.isConnected) {
          curAgentEl.style.opacity = "1";
          delete curAgentEl.dataset.thinking;
        }
      }
    } else if (t === "assistant/message") {
      var msg = ev.data && ev.data.message;
      if (msg && Array.isArray(msg.content)) {
        var texts = [];
        for (var i = 0; i < msg.content.length; i++) {
          var b = msg.content[i];
          if (b.type === "text" && b.text) texts.push(b.text);
        }
        if (texts.length) {
          var el = currentAgentEl();
          el.__md = texts.join("\n");
          attachAgentEl(el);
          el.innerHTML = renderMd(el.__md) || "\u200b";
          el.style.opacity = "1";
          delete el.dataset.thinking;
        } else if (curAgentEl && curAgentEl.isConnected && curAgentEl.__deferred) {
          // empty assistant message: drop the placeholder bubble entirely
          curAgentEl.remove();
          curAgentEl = null;
        }
        for (var j = 0; j < msg.content.length; j++) {
          var tb = msg.content[j];
          if (tb.type === "tool-call" && tb.name) {
            var ch = toolChipEl(j);
            ch.dataset.name = tb.name;
            ch.textContent = "\u2699 " + tb.name;
          }
        }
      }
      curAgentEl = null;
      toolChips = {};
    } else if (t === "step/start") {
      curAgentEl = null;
      toolChips = {};
    } else if (t === "tool/result") {
      for (var k in toolChips) {
        var c2 = toolChips[k];
        if (c2.dataset.name && !c2.dataset.done) {
          c2.dataset.done = "1";
          c2.textContent = "\u2713 " + c2.dataset.name;
          break;
        }
      }
    }
    var msgs = document.getElementById("dsh-msgs");
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
  }

  async function poll() {
    if (!sessionId) return;
    try {
      var resp = await fetch("/dsh/events?sessionId=" + encodeURIComponent(sessionId) +
        "&sinceSeq=" + sinceSeq);
      var data = await resp.json();
      if (data.ok && Array.isArray(data.events)) {
        for (var i = 0; i < data.events.length; i++) handleEvent(data.events[i]);
        sinceSeq = data.lastSeq;
      }
    } catch (e) {}
    // make sure the realtime socket is up (initial connect or reconnect)
    if (!ws || ws.readyState !== WebSocket.OPEN) ensureWs();
  }

  // ---------- question cards (server-request frames over ws) ----------

  var ws = null;

  function ensureWs() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
    try {
      var proto = location.protocol === "https:" ? "wss:" : "ws:";
      ws = new WebSocket(proto + "//" + location.host + "/dsh/ws");
      ws.onmessage = function (ev) {
        var msg;
        try { msg = JSON.parse(ev.data); } catch (e) { return; }
        if (msg.type !== "server-request") return;
        var payload = msg.payload || {};
        // realtime session events -> stream text as they arrive
        if (payload.type === "session/event" && sessionId &&
            payload.sessionId === sessionId) {
          var evt = payload.event || {};
          var seq = evt.seq || 0;
          if (seq > sinceSeq) {
            sinceSeq = Math.max(sinceSeq, seq);
            handleEvent(evt);
          }
          return;
        }
        handleServerRequest(msg);
      };
      ws.onopen = function () { stopPoll(); };
      ws.onclose = function () { ws = null; startPoll(); };
      ws.onerror = function () { try { ws.close(); } catch (e) {} };
    } catch (e) {}
  }

  function handleServerRequest(full) {
    var payload = full.payload || {};
    if (payload.type === "question/requested" && Array.isArray(payload.questions)) {
      renderQuestionCard(full.rpcId, payload.questions);
    } else if (payload.type === "approval/requested") {
      renderApprovalCard(full.rpcId, payload);
    } else if (payload.type === "approval/resolved") {
      markApprovalResolved(payload);
    }
  }

  // ---------- approval cards ----------

  function renderApprovalCard(rpcId, p) {
    var msgs = document.getElementById("dsh-msgs");
    var card = document.createElement("div");
    card.dataset.approval = p.approvalId;
    card.className = "dsh-card";
    // header
    var head = document.createElement("div");
    head.className = "dsh-card-head dsh-a-head";
    var ico = document.createElement("span");
    ico.className = "dsh-ico";
    ico.textContent = "\u26a0";
    var htxt = document.createElement("span");
    htxt.textContent = "Permission Required";
    head.appendChild(ico);
    head.appendChild(htxt);
    card.appendChild(head);
    // tool badge
    var tool = document.createElement("div");
    tool.style.cssText = "margin-bottom:6px;";
    var badge = document.createElement("span");
    badge.className = "dsh-tool-badge";
    badge.textContent = p.toolName || "unknown tool";
    tool.appendChild(badge);
    card.appendChild(tool);
    if (p.reason) {
      var reason = document.createElement("div");
      reason.className = "dsh-reason";
      reason.innerHTML = renderMd(p.reason) || p.reason;
      card.appendChild(reason);
    }
    var row = document.createElement("div");
    row.className = "dsh-foot";
    var allow = document.createElement("button");
    allow.className = "dsh-btn dsh-btn-allow";
    allow.textContent = "\u2713 Allow once";
    allow.onclick = function () { answerApproval(rpcId, p.approvalId, "allowed-once", card); };
    var deny = document.createElement("button");
    deny.className = "dsh-btn dsh-btn-deny";
    deny.textContent = "\u2715 Reject";
    deny.onclick = function () { answerApproval(rpcId, p.approvalId, "rejected", card); };
    row.appendChild(allow);
    row.appendChild(deny);
    card.appendChild(row);
    msgs.appendChild(card);
    msgs.scrollTop = msgs.scrollHeight;
  }

  async function answerApproval(rpcId, approvalId, outcome, card) {
    card.querySelectorAll("button").forEach(function (b) { b.disabled = true; });
    try {
      var resp = await fetch("/dsh/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "client-response",
          rpcId: rpcId,
          result: {
            ok: true,
            value: { sessionId: sessionId, approvalId: approvalId, outcome: outcome },
          },
        }),
      });
      var data = await resp.json();
      if (data.ok) {
        var tag = document.createElement("div");
        tag.className = "dsh-result " + (outcome === "allowed-once" ? "ok" : "no");
        tag.textContent = "\u2713 " + (outcome === "allowed-once" ? "allowed once" : "rejected");
        card.appendChild(tag);
      } else {
        card.querySelectorAll("button").forEach(function (b) { b.disabled = false; });
      }
    } catch (e) {
      card.querySelectorAll("button").forEach(function (b) { b.disabled = false; });
    }
  }

  function markApprovalResolved(p) {
    var cards = document.querySelectorAll('[data-approval="' + p.approvalId + '"]');
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      c.querySelectorAll("button").forEach(function (b) { b.disabled = true; });
      var tag = document.createElement("div");
      tag.className = "dsh-result " + (p.outcome === "allowed-once" ? "ok" : "no");
      tag.textContent = "\u2713 resolved: " + (p.outcome || "unknown");
      c.appendChild(tag);
    }
  }

  function renderQuestionCard(rpcId, questions) {
    var msgs = document.getElementById("dsh-msgs");
    var card = document.createElement("div");
    card.dataset.qcard = rpcId;
    card.className = "dsh-card";
    var head = document.createElement("div");
    head.className = "dsh-card-head dsh-q-head";
    var ico = document.createElement("span");
    ico.className = "dsh-ico";
    ico.textContent = "\u2753";
    var htxt = document.createElement("span");
    htxt.textContent = "Question";
    head.appendChild(ico);
    head.appendChild(htxt);
    card.appendChild(head);

    var state = {};
    questions.forEach(function (q, qi) {
      state[qi] = { id: q.id, selected: [], custom: "" };
      if (q.header) {
        var hd = document.createElement("div");
        hd.className = "dsh-q-header";
        hd.textContent = q.header;
        card.appendChild(hd);
      }
      var qt = document.createElement("div");
      qt.className = "dsh-q-title";
      qt.innerHTML = renderMd(q.question) || q.question;
      card.appendChild(qt);
      if (q.detail) {
        var dt = document.createElement("div");
        dt.className = "dsh-q-detail";
        dt.textContent = q.detail;
        card.appendChild(dt);
      }
      var opts = document.createElement("div");
      opts.className = "dsh-opts";
      (q.options || []).forEach(function (opt) {
        var b = document.createElement("button");
        b.className = "dsh-opt";
        b.textContent = opt.label;
        b.title = opt.description || "";
        b.onclick = function () {
          if (q.multiSelect) {
            var i = state[qi].selected.indexOf(opt.label);
            if (i >= 0) {
              state[qi].selected.splice(i, 1);
              b.classList.remove("sel");
            } else {
              state[qi].selected.push(opt.label);
              b.classList.add("sel");
            }
          } else {
            state[qi].selected = [opt.label];
            Array.prototype.forEach.call(opts.children, function (c) {
              c.classList.remove("sel");
            });
            b.classList.add("sel");
          }
        };
        opts.appendChild(b);
      });
      card.appendChild(opts);
      if (q.multiSelect) {
        var hint = document.createElement("div");
        hint.className = "dsh-multi-hint";
        hint.textContent = "\u2795 multi-select: choose one or more";
        card.appendChild(hint);
      }
    });
    var row = document.createElement("div");
    row.className = "dsh-foot";
    var customInput = document.createElement("input");
    customInput.className = "dsh-input";
    customInput.placeholder = "Other...";
    customInput.oninput = function () { state.__custom = customInput.value; };
    var submit = document.createElement("button");
    submit.className = "dsh-btn dsh-btn-primary";
    submit.textContent = "Submit";
    submit.onclick = function () {
      var answers = questions.map(function (q, qi) {
        var st = state[qi];
        var ans = { id: st.id, selected: st.selected };
        if (state.__custom) ans.custom = state.__custom;
        return ans;
      });
      answerQuestion(rpcId, answers, card, submit);
    };
    row.appendChild(customInput);
    row.appendChild(submit);
    card.appendChild(row);
    msgs.appendChild(card);
    msgs.scrollTop = msgs.scrollHeight;
  }

  async function answerQuestion(rpcId, answers, card, submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending...";
    try {
      var resp = await fetch("/dsh/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "client-response",
          rpcId: rpcId,
          result: {
            ok: true,
            value: {
              sessionId: sessionId,
              answer: { answers: answers },
            },
          },
        }),
      });
      var data = await resp.json();
      if (data.ok) {
        card.querySelectorAll("button,input").forEach(function (el) { el.disabled = true; });
        submitBtn.textContent = "\u2713 answered";
        submitBtn.className = "dsh-btn dsh-btn-ok";
      } else {
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit (retry)";
      }
    } catch (e) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit (retry)";
    }
  }

  function startPoll() {
    stopPoll();
    // serial chain: never overlap requests (avoids burst lag). The chain only
    // continues while the websocket is NOT the active stream — once the ws is
    // open it takes over and the chain stops, so a message never arrives twice
    // (once via poll, once via ws).
    var loop = function () {
      poll().then(function () {
        if (ws && ws.readyState === WebSocket.OPEN) { pollTimer = null; return; }
        pollTimer = setTimeout(loop, POLL_MS);
      });
    };
    loop();
  }

  function stopPoll() {
    if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
  }

  var sending = false;
  async function sendMsg() {
    if (sending) return; // debounce: a send is already in flight
    var ta = document.getElementById("dsh-input");
    var text = (ta.value || "").trim();
    if (!text) return;
    sending = true;
    ta.value = "";
    addMsg("user", text);
    setBusy(true);
    try {
      var resp = await fetch("/dsh/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text }),
      });
      var data = await resp.json();
      if (data.ok) {
        sessionId = data.sessionId;
        startPoll();
      } else {
        addMsg("assistant", "[error] " + (data.error || "send failed"));
        setBusy(false);
      }
    } catch (e) {
      addMsg("assistant", "[error] " + e);
      setBusy(false);
    } finally {
      sending = false;
    }
  }

  async function stopTurn() {
    if (!sessionId) return;
    try {
      await fetch("/dsh/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId }),
      });
      addMsg("assistant", "\u2713 stopped");
    } catch (e) {}
    setBusy(false);
  }

  function setBusy(b) {
    busy = b;
    var btnEl = document.getElementById("dsh-stop-btn");
    if (btnEl) btnEl.style.display = b ? "block" : "none";
  }

  async function refreshState() {
    try {
      var resp = await fetch("/dsh/state");
      var data = await resp.json();
      if (data.ok && data.session) {
        sessionId = data.session.sessionId;
        sessionTitle = data.session.title || "";
        if (data.session.running) setBusy(true);
        var t = document.getElementById("dsh-title");
        if (t) t.textContent = WIN_TITLE + (sessionTitle ? " - " + sessionTitle : "");
      }
    } catch (e) {}
  }

  // ---------- lifecycle ----------

  function show() {
    if (visible) return;
    makeWin();
    win.style.display = "flex";
    visible = true;
    refreshState();
    // initial history load renders recent messages; poll() also boots the ws,
    // after which streaming switches to the realtime socket
    poll();
  }

  function hide() {
    if (!win) return;
    // keep the DOM (conversation survives); just hide
    win.style.display = "none";
    visible = false;
  }

  function toggle() {
    visible ? hide() : show();
  }

  function boot() {
    makeBtn();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
