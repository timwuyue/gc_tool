// GC_Tool multi-image loader — frontend extension.
//
// GC_MultiImageLoader: "选择图片" opens the native multi-select dialog,
// uploads picked images to input/gc_multi/, and renders a card wall.
//  - each upload APPENDS (no auto-clear); re-picking the same file is a no-op
//  - hover a card -> red ✕ removes it individually
//  - click a card to TICK it for output (default: all ticked)
//  - state lives in hidden widgets `image_paths` + `selected` (JSON arrays of
//    absolute paths), which the backend reads at execution time.

const { app } = window.comfyAPI.app;

const UPLOAD_URL = "/gc_tool/upload_images";

// ---------------------------------------------------------------------------
// helpers

function el(tag, cls, text) {
	const e = document.createElement(tag);
	if (cls) e.className = cls;
	if (text != null) e.textContent = text;
	return e;
}

function cssInject() {
	const id = "gc-multi-image-styles";
	if (document.getElementById(id)) return;
	const st = document.createElement("style");
	st.id = id;
	st.textContent = `
	.gc-mi-root { padding: 4px; font-size: 12px; color: #e6edf3; }
	.gc-mi-status { color: #8b949e; font-size: 11px; margin-bottom: 6px; }
	.gc-mi-grid { display: flex; flex-wrap: wrap; gap: 8px; max-height: 320px; overflow-y: auto; }
	.gc-mi-card { width: 118px; border: 1px solid rgba(255,255,255,.14); border-radius: 6px;
		background: #161b22; overflow: hidden; cursor: pointer; position: relative; }
	.gc-mi-card:hover { border-color: #60a5fa; }
	.gc-mi-card.sel { border-color: #22c55e; box-shadow: 0 0 0 2px rgba(34,197,94,.35); }
	.gc-mi-thumb { width: 100%; height: 84px; object-fit: cover; display: block; background: #0d1117; }
	.gc-mi-name { padding: 3px 5px; font-size: 10px; color: #e6edf3; white-space: nowrap;
		overflow: hidden; text-overflow: ellipsis; }
	.gc-mi-empty { color: #8b949e; font-size: 11px; padding: 8px; }
	.gc-mi-check { position: absolute; top: 3px; right: 3px; width: 16px; height: 16px;
		border-radius: 4px; background: rgba(0,0,0,.6); color: #fff; display: none;
		align-items: center; justify-content: center; font-size: 11px; }
	.gc-mi-card.sel .gc-mi-check { display: flex; background: #22c55e; }
	.gc-mi-remove { position: absolute; top: 3px; left: 3px; width: 16px; height: 16px;
		border-radius: 4px; background: rgba(239,68,68,.85); color: #fff; display: none;
		align-items: center; justify-content: center; font-size: 11px; cursor: pointer; line-height: 1; }
	.gc-mi-card:hover .gc-mi-remove { display: flex; }
	.gc-mi-count { color: #4ade80; font-size: 11px; margin-top: 6px; }
	`;
	document.head.appendChild(st);
}

// ---------------------------------------------------------------------------
// state helpers (mirror hidden widgets)

function getPaths(node) {
	try {
		const w = node.widgets.find((x) => x.name === "image_paths");
		const v = JSON.parse(w?.value || "[]");
		return Array.isArray(v) ? v : [];
	} catch (e) { return []; }
}

function savePaths(node, paths) {
	const w = node.widgets.find((x) => x.name === "image_paths");
	if (w) w.value = JSON.stringify(paths);
}

function getSelected(node) {
	try {
		const w = node.widgets.find((x) => x.name === "selected");
		const v = JSON.parse(w?.value || "[]");
		return new Set(Array.isArray(v) ? v : []);
	} catch (e) { return new Set(); }
}

function saveSelected(node, selected) {
	const w = node.widgets.find((x) => x.name === "selected");
	if (w) w.value = JSON.stringify([...selected]);
}

// ---------------------------------------------------------------------------
// upload + render

let _fileInput = null;

function ensureFileInput(node) {
	if (_fileInput && _fileInput.__node === node) return _fileInput;
	if (_fileInput) _fileInput.remove();
	const input = document.createElement("input");
	input.type = "file";
	input.multiple = true;
	input.accept = ".png,.jpg,.jpeg,.webp,.bmp,.gif";
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

async function uploadAppend(node, files) {
	const container = node.__alContainer;
	if (!container) return;
	const status = el("div", "gc-mi-status", `上传 ${files.length} 个文件…`);
	container.insertBefore(status, container.firstChild);
	try {
		const fd = new FormData();
		for (const f of files) fd.append("files", f, f.name);
		const resp = await fetch(UPLOAD_URL, { method: "POST", body: fd });
		const data = await resp.json();
		status.remove();
		if (!data.ok) {
			container.insertBefore(el("div", "gc-mi-status", "错误: " + (data.error || "unknown")), container.firstChild);
			return;
		}
		const paths = getPaths(node);
		const existing = new Set(paths);
		for (const f of data.files || []) {
			if (!existing.has(f.path)) {
				paths.push(f.path);
				existing.add(f.path);
			}
		}
		savePaths(node, paths);
		render(node);
	} catch (e) {
		status.remove();
		container.insertBefore(el("div", "gc-mi-status", "上传失败: " + e), container.firstChild);
	}
}

function removeImage(node, path) {
	const paths = getPaths(node).filter((p) => p !== path);
	savePaths(node, paths);
	const sel = getSelected(node);
	sel.delete(path);
	saveSelected(node, sel);
	render(node);
}

function toggleSelected(node, path) {
	const sel = getSelected(node);
	if (sel.has(path)) sel.delete(path);
	else sel.add(path);
	saveSelected(node, sel);
	render(node);
}

function render(node) {
	const container = node.__alContainer;
	if (!container) return;
	const paths = getPaths(node);
	const selected = getSelected(node);
	const tickAll = selected.size === 0;

	container.innerHTML = "";
	const meta = el("div", "gc-mi-status", `已加载 ${paths.length} 张 · 将输出 ${tickAll ? paths.length : selected.size} 张（点击卡片切换输出）`);
	container.appendChild(meta);
	const grid = el("div", "gc-mi-grid");
	for (const p of paths) {
		const fname = p.split(/[\\/]/).pop();
		const url = "/view?filename=" + encodeURIComponent(fname) +
			"&subfolder=gc_multi&type=input";
		const isSel = selected.has(p);
		const card = el("div", "gc-mi-card" + ((tickAll || isSel) ? " sel" : ""));
		card.title = p;
		const img = el("img", "gc-mi-thumb");
		img.src = url;
		img.loading = "lazy";
		img.onerror = () => { img.style.display = "none"; };
		card.appendChild(img);
		card.appendChild(el("span", "gc-mi-check", "✓"));
		const rm = el("span", "gc-mi-remove", "✕");
		rm.title = "移除";
		rm.onclick = (e) => { e.stopPropagation(); removeImage(node, p); };
		card.appendChild(rm);
		card.appendChild(el("div", "gc-mi-name", fname));
		card.onclick = () => toggleSelected(node, p);
		grid.appendChild(card);
	}
	if (!paths.length) {
		grid.appendChild(el("div", "gc-mi-empty", "还没有图片 — 点击「选择图片」加载"));
	}
	container.appendChild(grid);
	resizeNodeToContent(node, container);
	setTimeout(() => resizeNodeToContent(node, container), 80);
}

// ---------------------------------------------------------------------------
// resize helper

function resizeNodeToContent(node, container) {
	if (!node || !container) return;
	if (typeof node.computeSize === "function") {
		try {
			const sz = node.computeSize(node.size[0]);
			if (Array.isArray(sz) && sz[0] && sz[1]) {
				node.setSize([Math.max(sz[0], node.size[0]), Math.max(sz[1], 80)]);
			}
		} catch (e) { /* keep current size */ }
	}
	node.onResize?.(node.size);
	node.graph?.setDirtyCanvas?.(true, true);
	if (node.setDirtyCanvas) node.setDirtyCanvas(true, true);
}

// ---------------------------------------------------------------------------
// extension registration

app.registerExtension({
	name: "GC_Tool.MultiImageLoader",
	async beforeRegisterNodeDef(nodeType, nodeData) {
		if (nodeData.name !== "GC_MultiImageLoader") return;
		const onNodeCreated = nodeType.prototype.onNodeCreated;
		nodeType.prototype.onNodeCreated = function () {
			const r = onNodeCreated?.apply(this, arguments);
			cssInject();
			this.addWidget("button", "选择图片", null, () => {
				ensureFileInput(this).click();
			});
			// hide the two state widgets
			for (const name of ["image_paths", "selected"]) {
				const w = this.widgets.find((x) => x.name === name);
				if (w) w.hidden = true;
			}
			const container = el("div", "gc-mi-root");
			this.__alContainer = container;
			this.addDOMWidget("multi_image_view", "multi_image_view", container, {
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
			this.__miResize = () => resizeNodeToContent(this, container);
			// restore previous state
			setTimeout(() => render(this), 120);
			return r;
		};
	},
});
