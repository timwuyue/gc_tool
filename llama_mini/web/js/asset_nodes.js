// GC_Tool asset library — frontend extension.
//
// Renders in-node UI for two custom nodes:
//   GC_AssetLibrary — card wall (image + description) after scanning a dir
//   GC_AssetPicker  — multi-select grid; writes picked ids into the hidden
//                     `selection` widget before execution
//
// ComfyUI custom-node JS extension pattern: registerExtension({name, nodeCreated}).

const { app } = window.comfyAPI.app;

const SCAN_URL = "/gc_tool/scan_assets";

// ---------------------------------------------------------------------------
// helpers

function el(tag, cls, text) {
	const e = document.createElement(tag);
	if (cls) e.className = cls;
	if (text != null) e.textContent = text;
	return e;
}

function cssInject() {
	const id = "gc-asset-lib-styles";
	if (document.getElementById(id)) return;
	const st = document.createElement("style");
	st.id = id;
	st.textContent = `
	.gc-al-root { padding: 4px; font-size: 12px; color: #e6edf3; }
	.gc-al-dirrow { display: flex; gap: 4px; margin-bottom: 6px; }
	.gc-al-dirinput { flex: 1; min-width: 0; background: #0d1117; color: #e6edf3;
		border: 1px solid rgba(255,255,255,.15); border-radius: 4px; padding: 3px 6px; font-size: 11px; }
	.gc-al-scan { background: #3b82f6; color: #fff; border: none; border-radius: 4px;
		padding: 3px 10px; cursor: pointer; font-size: 11px; }
	.gc-al-scan:disabled { opacity: .5; }
	.gc-al-status { color: #8b949e; font-size: 11px; margin-bottom: 6px; }
	.gc-al-cats { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 6px; }
	.gc-al-cat { background: #21262d; border: 1px solid rgba(255,255,255,.12); color: #93c5fd;
		border-radius: 10px; padding: 2px 8px; font-size: 10px; cursor: pointer; }
	.gc-al-cat.sel { background: #2563eb; color: #fff; border-color: #2563eb; }
	.gc-al-grid { display: flex; flex-wrap: wrap; gap: 8px; max-height: 320px; overflow-y: auto; }
	.gc-al-card { width: 118px; border: 1px solid rgba(255,255,255,.14); border-radius: 6px;
		background: #161b22; overflow: hidden; cursor: pointer; position: relative; }
	.gc-al-card:hover { border-color: #60a5fa; }
	.gc-al-card.sel { border-color: #22c55e; box-shadow: 0 0 0 2px rgba(34,197,94,.35); }
	.gc-al-thumb { width: 100%; height: 84px; object-fit: cover; display: block; background: #0d1117; }
	.gc-al-name { padding: 3px 5px; font-size: 10px; color: #e6edf3; white-space: nowrap;
		overflow: hidden; text-overflow: ellipsis; }
	.gc-al-cat-tag { position: absolute; top: 3px; left: 3px; background: rgba(0,0,0,.6);
		color: #93c5fd; border-radius: 4px; padding: 1px 5px; font-size: 9px; }
	.gc-al-desc { padding: 0 5px 4px; font-size: 9px; color: #8b949e; line-height: 1.4;
		max-height: 42px; overflow: hidden; }
	.gc-al-empty { color: #8b949e; font-size: 11px; padding: 8px; }
	.gc-al-check { position: absolute; top: 3px; right: 3px; width: 16px; height: 16px;
		border-radius: 4px; background: rgba(0,0,0,.6); color: #fff; display: none;
		align-items: center; justify-content: center; font-size: 11px; }
	.gc-al-card.sel .gc-al-check { display: flex; background: #22c55e; }
	.gc-al-pickcount { color: #4ade80; font-size: 11px; margin-top: 6px; }
	`;
	document.head.appendChild(st);
}

// ---------------------------------------------------------------------------
// shared: build a card grid element

function buildCardGrid(cards, { pickable, selected, onToggle }) {
	const grid = el("div", "gc-al-grid");
	selected = selected || new Set();
	for (const c of cards) {
		const card = el("div", "gc-al-card" + (selected.has(c.id) ? " sel" : ""));
		card.dataset.id = c.id;
		const img = el("img", "gc-al-thumb");
		img.src = c.image_url || "";
		img.loading = "lazy";
		img.onerror = () => { img.style.display = "none"; };
		card.appendChild(img);
		const tag = el("span", "gc-al-cat-tag", c.category);
		card.appendChild(tag);
		if (pickable) {
			const chk = el("span", "gc-al-check", "✓");
			card.appendChild(chk);
		}
		card.appendChild(el("div", "gc-al-name", c.name));
		if (c.description) {
			card.appendChild(el("div", "gc-al-desc", c.description.slice(0, 60)));
		}
		if (onToggle) {
			card.onclick = () => onToggle(c.id, card);
		}
		grid.appendChild(card);
	}
	if (!cards.length) {
		grid.appendChild(el("div", "gc-al-empty", "没有找到卡片（图片 + 可选同名 .md/.txt）"));
	}
	return grid;
}

// ---------------------------------------------------------------------------
// GC_AssetLibrary node

// --- folder picker dialog ------------------------------------------------

let _activeDirPicker = null;

function openDirPicker(node, onPick) {
	closeDirPicker();
	const overlay = el("div");
	overlay.style.cssText =
		"position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.55);" +
		"display:flex;align-items:center;justify-content:center;";
	const box = el("div");
	box.style.cssText =
		"background:#161b22;border:1px solid rgba(255,255,255,.18);border-radius:10px;" +
		"width:520px;max-width:92vw;max-height:80vh;display:flex;flex-direction:column;" +
		"box-shadow:0 8px 40px rgba(0,0,0,.6);overflow:hidden;";
	const head = el("div");
	head.style.cssText =
		"display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.1);";
	head.appendChild(el("span", null, "选择资产库目录"));
	const curPath = el("span");
	curPath.style.cssText = "flex:1;color:#8b949e;font-size:11px;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
	head.appendChild(curPath);
	const closeBtn = el("button", null, "✕");
	closeBtn.style.cssText = "background:none;border:none;color:#8b949e;cursor:pointer;font-size:14px;";
	closeBtn.onclick = closeDirPicker;
	head.appendChild(closeBtn);
	box.appendChild(head);

	// quick locations bar (home path fetched lazily from backend)
	const quickBar = el("div");
	quickBar.style.cssText =
		"display:flex;gap:5px;flex-wrap:wrap;padding:6px 10px;border-bottom:1px solid rgba(255,255,255,.08);";
	let homePath = "";
	fetch("/gc_tool/list_dir", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ path: "" }),
	})
		.then((r) => r.json())
		.then((d) => { if (d.ok && d.home) homePath = d.home; })
		.catch(() => {});
	const QUICK_LOCATIONS = [
		{ name: "E:\\", path: "E:\\" },
		{ name: "D:\\", path: "D:\\" },
		{ name: "C:\\", path: "C:\\" },
		{ name: "用户目录", path: () => homePath },
		{ name: "资产库示例", path: "E:\\Reasonix\\ComfyUI-MCP-CLI\\projects\\dongfang\\assets\\资产库" },
	];
	for (const q of QUICK_LOCATIONS) {
		const chip = el("span", null, q.name);
		chip.style.cssText =
			"background:#21262d;border:1px solid rgba(255,255,255,.12);color:#93c5fd;border-radius:8px;" +
			"padding:2px 9px;font-size:10px;cursor:pointer;";
		chip.onmouseenter = () => { chip.style.borderColor = "#60a5fa"; };
		chip.onmouseleave = () => { chip.style.borderColor = "rgba(255,255,255,.12)"; };
		chip.onclick = () => {
			const p = typeof q.path === "function" ? q.path() : q.path;
			if (p) loadDir(p);
		};
		quickBar.appendChild(chip);
	}
	box.appendChild(quickBar);

	const body = el("div");
	body.style.cssText = "flex:1;overflow-y:auto;padding:8px;min-height:200px;";
	box.appendChild(body);

	const foot = el("div");
	foot.style.cssText = "display:flex;gap:8px;padding:10px 12px;border-top:1px solid rgba(255,255,255,.1);align-items:center;";
	const pathInput = el("input");
	pathInput.type = "text";
	pathInput.style.cssText = "flex:1;background:#0d1117;color:#e6edf3;border:1px solid rgba(255,255,255,.15);border-radius:4px;padding:5px 8px;font-size:11px;";
	pathInput.placeholder = "目录路径（可直接粘贴，如 E:\\assets）";
	foot.appendChild(pathInput);
	// open in system explorer (helper; browsers can't return a picked path)
	const explorerBtn = el("button", null, "打开资源管理器");
	explorerBtn.style.cssText = "background:#2d3748;color:#e6edf3;border:none;border-radius:4px;padding:5px 10px;cursor:pointer;font-size:11px;";
	explorerBtn.title = "在系统资源管理器中打开当前目录（辅助确认路径，然后复制回来粘贴）";
	explorerBtn.onclick = () => {
		const p = (pathInput.value || "").trim();
		fetch("/gc_tool/open_folder", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ path: p || undefined }),
		}).catch(() => {});
	};
	foot.appendChild(explorerBtn);
	const goBtn = el("button", null, "打开");
	goBtn.style.cssText = "background:#3b82f6;color:#fff;border:none;border-radius:4px;padding:5px 14px;cursor:pointer;font-size:11px;";
	goBtn.onclick = () => { pathInput.value = pathInput.value.trim(); loadDir(pathInput.value); };
	foot.appendChild(goBtn);
	const pickBtn = el("button", null, "选择此目录");
	pickBtn.style.cssText = "background:#22c55e;color:#fff;border:none;border-radius:4px;padding:5px 14px;cursor:pointer;font-size:11px;";
	pickBtn.onclick = () => {
		const p = (pathInput.value || "").trim();
		if (!p) return;
		onPick(p);
		closeDirPicker();
	};
	foot.appendChild(pickBtn);
	box.appendChild(foot);

	overlay.appendChild(box);
	document.body.appendChild(overlay);
	_activeDirPicker = { overlay, body, pathInput, curPath };

	overlay.onclick = (e) => { if (e.target === overlay) closeDirPicker(); };

	async function loadDir(p) {
		if (!p) p = "";
		let data;
		try {
			const resp = await fetch("/gc_tool/list_dir", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ path: p }),
			});
			data = await resp.json();
		} catch (e) {
			body.innerHTML = "";
			body.appendChild(el("div", "gc-al-status", "列举失败: " + e));
			return;
		}
		if (!data.ok) {
			body.innerHTML = "";
			body.appendChild(el("div", "gc-al-status", "错误: " + (data.error || "unknown")));
			return;
		}
		pathInput.value = data.path || "";
		curPath.textContent = data.path || "(驱动器)";
		body.innerHTML = "";
		const rows = data.entries || [];
		if (data.parent) {
			rows.unshift({ name: ".. (上级目录)", path: data.parent, has_cards: false, isUp: true });
		}
		if (!rows.length) {
			body.appendChild(el("div", "gc-al-status", "（空目录）"));
		}
		for (const r of rows) {
			const row = el("div");
			row.style.cssText =
				"display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:5px;cursor:pointer;" +
				"font-size:12px;color:#e6edf3;" + (r.has_cards ? "background:rgba(34,197,94,.08);" : "");
			row.onmouseenter = () => { row.style.background = r.has_cards ? "rgba(34,197,94,.16)" : "rgba(255,255,255,.06)"; };
			row.onmouseleave = () => { row.style.background = r.has_cards ? "rgba(34,197,94,.08)" : ""; };
			const ico = el("span", null, r.isUp ? "↰" : (r.has_cards ? "📁✓" : "📁"));
			ico.style.cssText = "flex:0 0 auto;";
			const name = el("span", null, r.name);
			name.style.cssText = "flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
			const badge = r.has_cards ? el("span", null, "有卡片") : null;
			if (badge) badge.style.cssText = "color:#4ade80;font-size:10px;flex:0 0 auto;";
			row.appendChild(ico);
			row.appendChild(name);
			if (badge) row.appendChild(badge);
			row.onclick = () => {
				// single click: enter dir; double-click on a card dir picks it
				if (r.isUp) { loadDir(r.path); return; }
				if (r.has_cards) {
					pathInput.value = r.path;
					curPath.textContent = r.path;
					pickBtn.style.display = "";
					loadDir(r.path); // still let them drill in
				} else {
					loadDir(r.path);
				}
			};
			body.appendChild(row);
		}
	}

	// start at the node's current directory (or drives)
	const cur = (node.widgets.find((w) => w.name === "directory") || {}).value || "";
	loadDir(cur);
}

function closeDirPicker() {
	if (_activeDirPicker) {
		_activeDirPicker.overlay.remove();
		_activeDirPicker = null;
	}
}

function attachLibraryNode(node) {
	node.addWidget("button", "browse", null, () => {
		openDirPicker(node, (p) => {
			const dir = node.widgets.find((w) => w.name === "directory");
			if (dir) { dir.value = p; dir.callback?.(p); }
			scanAndRender(node, p);
		});
	});
	node.addWidget("button", "scan", null, () => {
		const dir = node.widgets.find((w) => w.name === "directory");
		scanAndRender(node, dir ? dir.value : "");
	});
}

async function scanAndRender(node, directory) {
	const container = node.__alContainer;
	if (!container) return;
	if (!directory) {
		container.innerHTML = "";
		container.appendChild(el("div", "gc-al-empty", "请输入目录路径"));
		return;
	}
	container.innerHTML = "";
	const status = el("div", "gc-al-status", "扫描中…");
	container.appendChild(status);
	try {
		const resp = await fetch(SCAN_URL, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ directory }),
		});
		const data = await resp.json();
		container.innerHTML = "";
		if (!data.ok) {
			container.appendChild(el("div", "gc-al-status", "错误: " + (data.error || "unknown")));
			return;
		}
		statusRemove(container);
		const cards = data.cards || [];
		const catRow = el("div", "gc-al-cats");
		const cats = ["role", "scene", "prop", "asset"];
		let activeCat = "all";
		const catMap = {};
		for (const c of cards) { catMap[c.category] = (catMap[c.category] || 0) + 1; }

		function renderGrid() {
			// remove previous count row + grid wrap before re-adding
			container.querySelectorAll(".gc-al-gridwrap, .gc-al-countrow").forEach((x) => x.remove());
			const wrap = el("div", "gc-al-gridwrap");
			const shown = activeCat === "all" ? cards : cards.filter((c) => c.category === activeCat);
			wrap.appendChild(buildCardGrid(shown, { pickable: false }));
			const count = el("div", "gc-al-status gc-al-countrow", `共 ${cards.length} 张卡片 · 当前 ${shown.length} 张`);
			container.appendChild(count);
			container.appendChild(wrap);
		}

		const allBtn = el("span", "gc-al-cat sel", `全部(${cards.length})`);
		allBtn.onclick = () => { activeCat = "all"; selCat(allBtn); renderGrid(); };
		catRow.appendChild(allBtn);
		for (const c of cats) {
			const n = catMap[c] || 0;
			if (!n) continue;
			const b = el("span", "gc-al-cat", `${c}(${n})`);
			b.onclick = () => { activeCat = c; selCat(b); renderGrid(); };
			catRow.appendChild(b);
		}
		function selCat(btn) {
			catRow.querySelectorAll(".gc-al-cat, .gc-al-cat.sel").forEach((x) => x.classList.remove("sel"));
			btn.classList.add("sel");
		}
		container.appendChild(catRow);
		renderGrid();
		// mark dirty so the node resizes
		resizeNodeToContent(node, container);
		// second pass after layout settles (DOM widget may not be mounted yet)
		setTimeout(() => resizeNodeToContent(node, container), 80);
	} catch (e) {
		container.innerHTML = "";
		container.appendChild(el("div", "gc-al-status", "扫描失败: " + e));
		resizeNodeToContent(node, container);
	}
}

function statusRemove(container) {
	const s = container.querySelector(".gc-al-status");
	if (s) s.remove();
}

// Resize the node to fit its DOM widget content. Works in default (legacy)
// node mode where DOM widgets don't auto-expand the node box. We let the
// widget's computeSize report the container height, then ask the node for its
// full computed size (title + all widgets) and apply it.
function resizeNodeToContent(node, container) {
	if (!node || !container) return;
	if (typeof node.computeSize === "function") {
		try {
			const sz = node.computeSize(node.size[0]);
			if (Array.isArray(sz) && sz[0] && sz[1]) {
				node.setSize([Math.max(sz[0], node.size[0]), Math.max(sz[1], 80)]);
			}
		} catch (e) { /* keep current size on failure */ }
	}
	node.onResize?.(node.size);
	node.graph?.setDirtyCanvas?.(true, true);
	if (node.setDirtyCanvas) node.setDirtyCanvas(true, true);
}

// ---------------------------------------------------------------------------
// GC_AssetPicker node

function attachPickerNode(node) {
	// The selection widget is hidden from the panel (multiline STRING).
	// Keep a reference for writes.
	node.__alContainer = null;

	// Scan button reuses the wired library's directory when available.
	node.addWidget("button", "rescan", null, () => {
		const libWidget = node.widgets.find((w) => w.name === "library");
		if (!libWidget) return;
		// library widget value is JSON text; try to extract directory from it
		// — cards don't carry the root, so we ask the user via the linked
		// AssetLibrary node if present.
		const libNode = libWidget.linkedNode;
		if (libNode) {
			const dirWidget = libNode.widgets.find((w) => w.name === "directory");
			if (dirWidget) { renderPickerFromDir(node, dirWidget.value); return; }
		}
		// Fallback: parse library JSON, group by rel_path prefix is lossy;
		// just render from the payload directly.
		renderPickerFromPayload(node, libWidget.value);
	});
}

function renderPickerFromDir(node, directory) {
	if (!directory) return;
	fetch(SCAN_URL, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ directory }),
	})
		.then((r) => r.json())
		.then((data) => {
			if (data.ok) renderPickerCards(node, data.cards || []);
		})
		.catch(() => {});
}

function renderPickerFromPayload(node, libraryJson) {
	let cards = [];
	try { cards = JSON.parse(libraryJson || "[]"); } catch (e) {}
	// ensure image_url present for preview
	for (const c of cards) {
		if (!c.image_url && c.image) {
			c.image_url = "/gc_tool/asset_view?path=" + encodeURIComponent(c.image);
		}
	}
	renderPickerCards(node, cards);
}

function renderPickerCards(node, cards) {
	const container = node.__alContainer;
	if (!container) return;
	container.innerHTML = "";

	let selected = new Set();
	try {
		const w = node.widgets.find((x) => x.name === "selection");
		if (w && Array.isArray(JSON.parse(w.value || "[]"))) {
			selected = new Set(JSON.parse(w.value || "[]"));
		}
	} catch (e) { selected = new Set(); }

	const countLabel = el("div", "gc-al-pickcount", `已选 ${selected.size} 张`);
	const cats = ["role", "scene", "prop", "asset"];
	const catMap = {};
	for (const c of cards) { catMap[c.category] = (catMap[c.category] || 0) + 1; }
	const catRow = el("div", "gc-al-cats");
	let activeCat = "all";

	const gridWrap = el("div", "gc-al-gridwrap");
	renderGrid();

	function persist() {
		const w = node.widgets.find((x) => x.name === "selection");
		if (w) { w.value = JSON.stringify([...selected]); }
		countLabel.textContent = `已选 ${selected.size} 张`;
		node.setDirtyCanvas(true, true);
	}

	function renderGrid() {
		gridWrap.innerHTML = "";
		const shown = activeCat === "all" ? cards : cards.filter((c) => c.category === activeCat);
		gridWrap.appendChild(buildCardGrid(shown, {
			pickable: true,
			selected,
			onToggle: (id, cardEl) => {
				if (selected.has(id)) { selected.delete(id); cardEl.classList.remove("sel"); }
				else { selected.add(id); cardEl.classList.add("sel"); }
				persist();
			},
		}));
	}

	catRow.appendChild(catChip("all", cards.length, true));
	for (const c of cats) {
		const n = catMap[c] || 0;
		if (n) catRow.appendChild(catChip(c, n, false));
	}
	function catChip(cat, n, def) {
		const b = el("span", "gc-al-cat" + (def ? " sel" : ""), `${cat}(${n})`);
		b.onclick = () => {
			catRow.querySelectorAll(".gc-al-cat").forEach((x) => x.classList.remove("sel"));
			b.classList.add("sel");
			activeCat = cat;
			renderGrid();
		};
		return b;
	}

	container.appendChild(countLabel);
	container.appendChild(catRow);
	container.appendChild(gridWrap);
	resizeNodeToContent(node, container);
	setTimeout(() => resizeNodeToContent(node, container), 80);
}

// ---------------------------------------------------------------------------
// extension registration

app.registerExtension({
	name: "GC_Tool.AssetLibrary",
	async beforeRegisterNodeDef(nodeType, nodeData) {
		if (nodeData.name === "GC_AssetLibrary") {
			const onNodeCreated = nodeType.prototype.onNodeCreated;
			nodeType.prototype.onNodeCreated = function () {
				const r = onNodeCreated?.apply(this, arguments);
				cssInject();
				attachLibraryNode(this);
				// body container for the card wall
				const container = el("div", "gc-al-root");
				this.__alContainer = container;
				const domWidget = this.addDOMWidget("asset_library_view", "asset_library_view", container, {
					getMinHeight: () => 60,
					getMaxHeight: () => 640,
					getHeight: () => Math.min(Math.max((container.scrollHeight || 60) + 12, 80), 640),
					hideOnZoom: false,
					computeSize: (width) => {
						const h = container.scrollHeight || 60;
						return [width, Math.min(Math.max(h + 12, 80), 640)];
					},
				});
				domWidget.serialize = false;
				container.style.minHeight = "60px";
				this.__alResize = () => resizeNodeToContent(this, container);
				// scan on creation if a directory is already set
				const dir = this.widgets.find((w) => w.name === "directory");
				if (dir && dir.value) {
					setTimeout(() => scanAndRender(this, dir.value), 150);
				}
				// rescan when the directory widget value changes
				const origCallback = dir?.callback;
				if (dir) dir.callback = (val) => { origCallback?.(val); scanAndRender(this, val); };
				return r;
			};
		}
		if (nodeData.name === "GC_AssetPicker") {
			const onNodeCreated = nodeType.prototype.onNodeCreated;
			nodeType.prototype.onNodeCreated = function () {
				const r = onNodeCreated?.apply(this, arguments);
				cssInject();
				const container = el("div", "gc-al-root");
				this.__alContainer = container;
				const domWidget = this.addDOMWidget("asset_picker_view", "asset_picker_view", container, {
					getMinHeight: () => 60,
					getMaxHeight: () => 640,
					getHeight: () => Math.min(Math.max((container.scrollHeight || 60) + 12, 80), 640),
					hideOnZoom: false,
					computeSize: (width) => {
						const h = container.scrollHeight || 60;
						return [width, Math.min(Math.max(h + 12, 80), 640)];
					},
				});
				domWidget.serialize = false;
				container.style.minHeight = "60px";
				this.__alResize = () => resizeNodeToContent(this, container);
				// try to render from the wired library once available
				const tryRender = () => {
					const lib = this.widgets.find((w) => w.name === "library");
					if (lib && lib.value) { renderPickerFromPayload(this, lib.value); return true; }
					return false;
				};
				setTimeout(() => {
					if (!tryRender()) {
						// maybe a directory-based render via linked node
						const lib = this.widgets.find((w) => w.name === "library");
						if (lib?.linkedNode) {
							const dir = lib.linkedNode.widgets.find((w) => w.name === "directory");
							if (dir && dir.value) renderPickerFromDir(this, dir.value);
						}
					}
				}, 300);
				// refresh when the library input changes value (execution/connect)
				const origOnConnChange = this.onConnectionsChange;
				this.onConnectionsChange = function (type, index, connected, linkInfo) {
					origOnConnChange?.apply(this, arguments);
					const lib = this.widgets.find((w) => w.name === "library");
					if (lib && lib.linkedNode) {
						const dir = lib.linkedNode.widgets.find((w) => w.name === "directory");
						if (dir && dir.value) renderPickerFromDir(this, dir.value);
					}
				};
				return r;
			};
		}
	},
});
