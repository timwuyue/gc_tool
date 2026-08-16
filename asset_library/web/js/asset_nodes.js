// GC_Tool asset library — frontend extension.
//
// Two custom nodes:
//   GC_AssetLibrary — "选择图片" opens a native multi-select file dialog,
//                     uploads picked images (+ optional same-name .md/.txt)
//                     to the backend session dir, and renders a card wall.
//                     Cards APPEND on each selection (no auto-clear); each
//                     card has an ✕ to remove it individually. The card list
//                     lives in the hidden `_cards` widget (JSON) which the
//                     backend emits as the ASSET_LIBRARY payload.
//   GC_AssetPicker  — multi-select grid over the wired library; writes picked
//                     ids into the hidden `selection` widget; outputs IMAGE
//                     batch + ASSET_SELECTION JSON.
//
// No directory browsing / classification: cards are exactly what the user
// picked, in pick order.

const { app } = window.comfyAPI.app;

const UPLOAD_URL = "/gc_tool/upload_assets";

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
	.gc-al-status { color: #8b949e; font-size: 11px; margin-bottom: 6px; }
	.gc-al-grid { display: flex; flex-wrap: wrap; gap: 8px; max-height: 320px; overflow-y: auto; }
	.gc-al-card { width: 118px; border: 1px solid rgba(255,255,255,.14); border-radius: 6px;
		background: #161b22; overflow: hidden; cursor: pointer; position: relative; }
	.gc-al-card:hover { border-color: #60a5fa; }
	.gc-al-card.sel { border-color: #22c55e; box-shadow: 0 0 0 2px rgba(34,197,94,.35); }
	.gc-al-thumb { width: 100%; height: 84px; object-fit: cover; display: block; background: #0d1117; }
	.gc-al-name { padding: 3px 5px; font-size: 10px; color: #e6edf3; white-space: nowrap;
		overflow: hidden; text-overflow: ellipsis; }
	.gc-al-desc { padding: 0 5px 4px; font-size: 9px; color: #8b949e; line-height: 1.4;
		max-height: 42px; overflow: hidden; }
	.gc-al-empty { color: #8b949e; font-size: 11px; padding: 8px; }
	.gc-al-check { position: absolute; top: 3px; right: 3px; width: 16px; height: 16px;
		border-radius: 4px; background: rgba(0,0,0,.6); color: #fff; display: none;
		align-items: center; justify-content: center; font-size: 11px; }
	.gc-al-card.sel .gc-al-check { display: flex; background: #22c55e; }
	.gc-al-remove { position: absolute; top: 3px; left: 3px; width: 16px; height: 16px;
		border-radius: 4px; background: rgba(239,68,68,.85); color: #fff; display: none;
		align-items: center; justify-content: center; font-size: 11px; cursor: pointer; line-height: 1; }
	.gc-al-card:hover .gc-al-remove { display: flex; }
	.gc-al-pickcount { color: #4ade80; font-size: 11px; margin-top: 6px; }
	`;
	document.head.appendChild(st);
}

// ---------------------------------------------------------------------------
// card grid (shared by library + picker)

function buildCardGrid(cards, { pickable, selected, onToggle, onRemove }) {
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
		if (pickable) {
			const chk = el("span", "gc-al-check", "✓");
			card.appendChild(chk);
		}
		if (onRemove) {
			const rm = el("span", "gc-al-remove", "✕");
			rm.title = "移除这张卡片";
			rm.onclick = (e) => { e.stopPropagation(); onRemove(c.id, card); };
			card.appendChild(rm);
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
		grid.appendChild(el("div", "gc-al-empty", "还没有卡片 — 点击「选择图片」加载"));
	}
	return grid;
}

// ---------------------------------------------------------------------------
// GC_AssetLibrary node

let _fileInput = null;

function ensureFileInput(node) {
	if (_fileInput && _fileInput.__node === node) return _fileInput;
	if (_fileInput) _fileInput.remove();
	const input = document.createElement("input");
	input.type = "file";
	input.multiple = true;
	input.accept = ".png,.jpg,.jpeg,.webp,.bmp,.gif,.md,.txt";
	input.style.display = "none";
	input.__node = node;
	input.addEventListener("change", async () => {
		const files = Array.from(input.files || []);
		input.value = "";
		if (!files.length) return;
		await uploadAppend(node, files);
	});
	document.body.appendChild(input);
	_fileInput = input;
	return input;
}

// current card list lives on the node (state), mirroring the _cards widget
function getCards(node) {
	if (Array.isArray(node.__alCards)) return node.__alCards;
	try {
		const w = node.widgets.find((x) => x.name === "_cards");
		const parsed = JSON.parse(w?.value || "[]");
		node.__alCards = Array.isArray(parsed) ? parsed : [];
	} catch (e) {
		node.__alCards = [];
	}
	return node.__alCards;
}

function saveCards(node) {
	const cards = node.__alCards || [];
	const clean = cards.map((c) => {
		const o = { ...c };
		delete o.image_url;
		delete o.desc_url;
		return o;
	});
	const w = node.widgets.find((x) => x.name === "_cards");
	if (w) w.value = JSON.stringify(clean);
}

async function uploadAppend(node, files) {
	const container = node.__alContainer;
	if (!container) return;
	const status = el("div", "gc-al-status", `上传 ${files.length} 个文件…`);
	container.insertBefore(status, container.firstChild);
	try {
		const fd = new FormData();
		for (const f of files) fd.append("files", f, f.name);
		const resp = await fetch(UPLOAD_URL, { method: "POST", body: fd });
		const data = await resp.json();
		status.remove();
		if (!data.ok) {
			container.insertBefore(el("div", "gc-al-status", "错误: " + (data.error || "unknown")), container.firstChild);
			return;
		}
		// append, de-dup by absolute image path (re-selecting the same file is a no-op)
		const existing = new Set((node.__alCards || []).map((c) => c.image));
		for (const c of data.cards || []) {
			if (!existing.has(c.image)) {
				node.__alCards.push(c);
				existing.add(c.image);
			}
		}
		saveCards(node);
		renderCardWall(node);
	} catch (e) {
		status.remove();
		container.insertBefore(el("div", "gc-al-status", "上传失败: " + e), container.firstChild);
	}
}

function removeCard(node, id) {
	node.__alCards = (node.__alCards || []).filter((c) => c.id !== id);
	saveCards(node);
	renderCardWall(node);
}

function renderCardWall(node) {
	const container = node.__alContainer;
	if (!container) return;
	const cards = getCards(node);
	container.innerHTML = "";
	container.appendChild(el("div", "gc-al-status", `共 ${cards.length} 张卡片`));
	const wrap = el("div", "gc-al-gridwrap");
	wrap.appendChild(buildCardGrid(cards, {
		pickable: false,
		onRemove: (id) => removeCard(node, id),
	}));
	container.appendChild(wrap);
	resizeNodeToContent(node, container);
	setTimeout(() => resizeNodeToContent(node, container), 80);
}

function attachLibraryNode(node) {
	node.addWidget("button", "选择图片", null, () => {
		ensureFileInput(node).click();
	});
}

// ---------------------------------------------------------------------------
// GC_AssetPicker node

function renderPickerFromPayload(node, libraryJson) {
	let cards = [];
	try { cards = JSON.parse(libraryJson || "[]"); } catch (e) {}
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
		gridWrap.appendChild(buildCardGrid(cards, {
			pickable: true,
			selected,
			onToggle: (id, cardEl) => {
				if (selected.has(id)) { selected.delete(id); cardEl.classList.remove("sel"); }
				else { selected.add(id); cardEl.classList.add("sel"); }
				persist();
			},
		}));
	}

	container.appendChild(countLabel);
	container.appendChild(gridWrap);
	resizeNodeToContent(node, container);
	setTimeout(() => resizeNodeToContent(node, container), 80);
}

// ---------------------------------------------------------------------------
// resize helper (default / legacy node mode)

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
				// hide the _cards widget (state carrier only)
				const cardsW = this.widgets.find((x) => x.name === "_cards");
				if (cardsW) cardsW.hidden = true;
				const container = el("div", "gc-al-root");
				this.__alContainer = container;
				this.addDOMWidget("asset_library_view", "asset_library_view", container, {
					getMinHeight: () => 60,
					getMaxHeight: () => 640,
					getHeight: () => Math.min(Math.max((container.scrollHeight || 60) + 12, 80), 640),
					hideOnZoom: false,
					computeSize: (width) => {
						const h = container.scrollHeight || 60;
						return [width, Math.min(Math.max(h + 12, 80), 640)];
					},
				});
				container.style.minHeight = "60px";
				this.__alResize = () => resizeNodeToContent(this, container);
				// restore previous cards on load
				setTimeout(() => { renderCardWall(this); }, 120);
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
				this.addDOMWidget("asset_picker_view", "asset_picker_view", container, {
					getMinHeight: () => 60,
					getMaxHeight: () => 640,
					getHeight: () => Math.min(Math.max((container.scrollHeight || 60) + 12, 80), 640),
					hideOnZoom: false,
					computeSize: (width) => {
						const h = container.scrollHeight || 60;
						return [width, Math.min(Math.max(h + 12, 80), 640)];
					},
				});
				container.style.minHeight = "60px";
				this.__alResize = () => resizeNodeToContent(this, container);
				const tryRender = () => {
					const lib = this.widgets.find((w) => w.name === "library");
					if (lib && lib.value) { renderPickerFromPayload(this, lib.value); return true; }
					return false;
				};
				setTimeout(() => {
					if (!tryRender()) {
						const lib = this.widgets.find((w) => w.name === "library");
						if (lib?.linkedNode) {
							const cardsW = lib.linkedNode.widgets.find((w) => w.name === "_cards");
							if (cardsW && cardsW.value) renderPickerFromPayload(this, cardsW.value);
						}
					}
				}, 300);
				const origOnConnChange = this.onConnectionsChange;
				this.onConnectionsChange = function (type, index, connected, linkInfo) {
					origOnConnChange?.apply(this, arguments);
					const lib = this.widgets.find((w) => w.name === "library");
					if (lib?.linkedNode) {
						const cardsW = lib.linkedNode.widgets.find((w) => w.name === "_cards");
						if (cardsW && cardsW.value) renderPickerFromPayload(this, cardsW.value);
					}
				};
				return r;
			};
		}
	},
});
