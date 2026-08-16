"""GC_Tool asset library nodes.

Two-node system for browsing local asset folders and feeding picked images
into any downstream ComfyUI node:

- GC_AssetLibrary (asset library loader)
    Scans a local directory, auto-classifies cards into role/scene/prop by
    folder or file naming, and exposes an ASSET_LIBRARY JSON payload
    (card metadata: name, category, description, image path). The frontend
    renders a card wall (image + description) on the node body.
- GC_AssetPicker (asset selector)
    Takes an ASSET_LIBRARY payload, lets the user multi-select any number of
    cards in the node body, and outputs the picked images as IMAGE
    (a batched list) plus the picked card metadata as ASSET_SELECTION JSON.

Card file layout on disk (all optional except the image):
    <dir>/角色卡/兔娘.png          + 兔娘.md  (or .txt)  -> role card
    <dir>/scenes/classroom.png     + classroom.txt       -> scene card
    <dir>/道具/酒杯.png                                  -> prop card, no desc
"""

import json
import os

import folder_paths  # noqa: F401  (kept for future input-folder helpers)

# ---------------------------------------------------------------------------
# Card classification

_CATEGORY_KEYWORDS = (
    ("role", ("角色", "角色卡", "character", "char", "人物", "人物卡")),
    ("scene", ("场景", "场景卡", "scene", "背景", "环境", "location")),
    ("prop", ("道具", "道具卡", "prop", "物品", "object", "item")),
)

_IMG_EXT = (".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif")
_DESC_EXT = (".md", ".txt")


def classify_path(rel_path: str) -> str:
    """Classify a card by its relative path (folder + filename), lowest
    keyword wins (specific names beat generic folder names)."""
    folded = rel_path.replace("\\", "/").lower()
    best = "asset"  # default bucket
    best_rank = 10 ** 9
    for cat, kws in _CATEGORY_KEYWORDS:
        for kw in kws:
            idx = folded.rfind(kw.lower())
            if idx >= 0:
                # later match in the path = more specific
                if idx < best_rank:
                    best_rank = idx
                    best = cat
    return best


def _desc_for(img_path: str) -> str:
    """Look for a same-name .md/.txt next to the image; return its text."""
    base = os.path.splitext(img_path)[0]
    for ext in _DESC_EXT:
        p = base + ext
        if os.path.isfile(p):
            try:
                with open(p, "r", encoding="utf-8") as f:
                    return f.read().strip()
            except Exception:
                return ""
    return ""


def scan_directory(directory: str) -> list[dict]:
    """Scan `directory` recursively for image cards. Returns a list of card
    dicts sorted by category then name:
        {id, name, category, image, description, rel_path}
    `image` is the absolute path (used by the backend at execution time);
    the frontend builds a /gc_tool/asset_view?path=... URL for preview.
    """
    if not directory or not os.path.isdir(directory):
        return []
    root = os.path.abspath(directory)
    cards: list[dict] = []
    for dirpath, _dirnames, filenames in os.walk(root):
        for fn in sorted(filenames):
            ext = os.path.splitext(fn)[1].lower()
            if ext not in _IMG_EXT:
                continue
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, root)
            cat = classify_path(rel)
            name = os.path.splitext(fn)[0]
            cards.append({
                "id": f"{cat}:{name}",
                "name": name,
                "category": cat,
                "image": full,
                "description": _desc_for(full),
                "rel_path": rel,
            })
    cards.sort(key=lambda c: (c["category"], c["name"].lower()))
    return cards


def cards_from_files(files: list[str], root: str | None = None) -> list[dict]:
    """Build card dicts from an explicit list of image files (uploaded ones).

    `root` is the directory the files were uploaded to; rel_path is computed
    against it (falls back to the bare filename). Same-name .md/.txt next to
    each image are picked up as descriptions automatically — this lets a user
    multi-select an image + its .md together in the file dialog.
    """
    root = os.path.abspath(root) if root else None
    cards: list[dict] = []
    for full in files:
        ext = os.path.splitext(full)[1].lower()
        if ext not in _IMG_EXT:
            continue
        rel = os.path.relpath(full, root) if root else os.path.basename(full)
        cat = classify_path(rel)
        name = os.path.splitext(os.path.basename(full))[0]
        cards.append({
            "id": f"{cat}:{name}",
            "name": name,
            "category": cat,
            "image": full,
            "description": _desc_for(full),
            "rel_path": rel,
        })
    cards.sort(key=lambda c: (c["category"], c["name"].lower()))
    return cards


def _load_image_tensor(path: str):
    """Load an image file into a ComfyUI IMAGE tensor (1,H,W,3 float32)."""
    from PIL import Image
    import numpy as np
    import torch

    img = Image.open(path)
    if img.mode != "RGB":
        img = img.convert("RGB")
    arr = np.asarray(img, dtype=np.float32) / 255.0
    return torch.from_numpy(arr)[None, ...]


# ---------------------------------------------------------------------------
# Node: GC_AssetLibrary

class AssetLibrary:
    RETURN_TYPES = ("ASSET_LIBRARY", "ASSET_CATALOG")
    RETURN_NAMES = ("library", "catalog")
    FUNCTION = "load"
    CATEGORY = "GC_Tool/资产库"

    @classmethod
    def INPUT_TYPES(cls) -> dict:
        return {
            "required": {
                # Hidden widget written by the frontend after each multi-select
                # upload: JSON array of card dicts (append-only; the frontend
                # manages add/remove). No directory scanning anymore — the
                # asset list is exactly what the user picked.
                "_cards": ("STRING", {"default": "[]", "multiline": True}),
            },
        }

    def load(self, _cards: str = "[]"):
        cards: list[dict] = []
        if _cards and _cards.strip():
            try:
                parsed = json.loads(_cards)
                if isinstance(parsed, list):
                    cards = [c for c in parsed if isinstance(c, dict) and c.get("id")]
            except (ValueError, TypeError):
                cards = []
        # The library payload is what the picker node consumes; it holds the
        # same card metadata (paths are absolute; frontend uses them via
        # /gc_tool/asset_view). Catalog is a compact summary for debugging.
        payload = json.dumps(cards, ensure_ascii=False)
        catalog = json.dumps({
            "count": len(cards),
            "cards": [
                {"id": c["id"], "name": c["name"], "category": c.get("category", "asset"),
                 "description": (c.get("description") or "")[:120]}
                for c in cards
            ],
        }, ensure_ascii=False)
        return (payload, catalog)


# ---------------------------------------------------------------------------
# Node: GC_AssetPicker

class AssetPicker:
    """Multi-select picker over an ASSET_LIBRARY payload.

    The frontend renders a checkbox card grid in the node body; the picked
    card ids are written back into the `selection` widget (JSON array of
    card ids) before execution. At execution time we resolve ids -> image
    tensors and emit IMAGE (batched) + ASSET_SELECTION (metadata JSON).
    """

    RETURN_TYPES = ("IMAGE", "ASSET_SELECTION", "STRING")
    RETURN_NAMES = ("images", "selection", "selection_json")
    FUNCTION = "pick"
    CATEGORY = "GC_Tool/资产库"

    @classmethod
    def INPUT_TYPES(cls) -> dict:
        return {
            "required": {
                "library": ("ASSET_LIBRARY",),
                # Hidden widget: JSON array of picked card ids, written by the
                # frontend picker UI (not editable by hand).
                "selection": ("STRING", {
                    "default": "[]",
                    "multiline": True,
                }),
            },
        }

    def pick(self, library: str, selection: str = "[]"):
        try:
            cards = json.loads(library) if isinstance(library, str) else []
        except (ValueError, TypeError):
            cards = []
        by_id = {c["id"]: c for c in cards if isinstance(c, dict) and c.get("id")}

        try:
            picked_ids = json.loads(selection) if isinstance(selection, str) else []
        except (ValueError, TypeError):
            picked_ids = []
        if not isinstance(picked_ids, list):
            picked_ids = []

        # Deduplicate while preserving selection order; skip unknown ids.
        seen = set()
        ordered: list[str] = []
        for pid in picked_ids:
            pid = str(pid)
            if pid in by_id and pid not in seen:
                seen.add(pid)
                ordered.append(pid)

        tensors = []
        meta = []
        missing = []
        for pid in ordered:
            card = by_id[pid]
            path = card.get("image")
            if not path or not os.path.isfile(path):
                missing.append(pid)
                continue
            try:
                tensors.append(_load_image_tensor(path))
            except Exception as e:
                missing.append(f"{pid} ({e})")
                continue
            meta.append(card)

        if not tensors:
            raise RuntimeError(
                "GC_AssetPicker: no valid images selected — pick cards in the "
                "node body, or the library directory changed. "
                + (f" missing: {missing}" if missing else "")
            )

        import torch
        batch = torch.cat(tensors, dim=0)
        sel_json = json.dumps(meta, ensure_ascii=False)
        return (batch, sel_json, sel_json)


NODE_CLASS_MAPPINGS = {
    "GC_AssetLibrary": AssetLibrary,
    "GC_AssetPicker": AssetPicker,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "GC_AssetLibrary": "资产库 (Asset Library)",
    "GC_AssetPicker": "资产选择器 (Asset Picker)",
}
