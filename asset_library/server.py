"""GC_Tool asset library server routes.

Provides the browser endpoints the asset nodes' frontend uses:

- POST /gc_tool/scan_assets   {directory} -> {cards:[...]} (same shape as
  scan_directory(), but image paths are converted to /gc_tool/asset_view URLs
  so the browser can render previews).
- GET  /gc_tool/asset_view?path=<abs path>  -> serves the image/md/txt file
  (whitelisted to any path under the scanned root, resolved & containment
  checked).
- GET  /gc_tool/asset_desc?path=<abs path>  -> returns {text} for .md/.txt.

All routes are registered on the global PromptServer instance by importing
this module from gc_tool/__init__.py.
"""

import mimetypes
import os
from pathlib import Path

from aiohttp import web
from server import PromptServer

from .nodes import _IMG_EXT, scan_directory

_log = None  # lazy logger not required; keep module import light

routes = PromptServer.instance.routes


@routes.post("/gc_tool/scan_assets")
async def scan_assets(request: web.Request) -> web.Response:
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "invalid json"}, status=400)
    directory = str(body.get("directory") or "").strip()
    if not directory:
        return web.json_response({"error": "directory required"}, status=400)
    if not os.path.isdir(directory):
        return web.json_response({"error": f"not a directory: {directory}"}, status=400)

    cards = scan_directory(directory)
    for c in cards:
        # give the browser a preview URL for the image
        c["image_url"] = f"/gc_tool/asset_view?path={_quote(c['image'])}"
        if c.get("description"):
            c["desc_url"] = f"/gc_tool/asset_view?path={_quote(_desc_path(c['image']))}"
    return web.json_response({"ok": True, "directory": directory,
                              "count": len(cards), "cards": cards})


@routes.post("/gc_tool/open_folder")
async def open_folder(request: web.Request) -> web.Response:
    """Open the system file explorer at `path` (best-effort helper for the
    folder picker: browsers cannot show a native directory dialog, so we let
    the user inspect the real folder and copy the path back)."""
    try:
        body = await request.json()
    except Exception:
        body = {}
    path = str(body.get("path") or "").strip()
    if not path or not os.path.isdir(path):
        # fall back to a reasonable root
        path = os.path.expanduser("~")
    try:
        if os.name == "nt":
            os.startfile(path)  # type: ignore[attr-defined]
        else:
            import subprocess
            subprocess.Popen(["xdg-open", path])
        return web.json_response({"ok": True, "opened": path})
    except Exception as e:
        return web.json_response({"ok": False, "error": str(e)})


def _dir_has_cards_shallow(path: str, depth: int = 3) -> bool:
    """Cheap check: does this dir (up to `depth` levels down) contain any
    image file? Covers layouts like 资产库/角色卡/xxx.png (3 levels) without
    a full recursive walk of huge trees. Returns on the first hit."""
    if depth <= 0:
        return False
    try:
        with os.scandir(path) as it:
            for entry in it:
                try:
                    if entry.is_file():
                        if os.path.splitext(entry.name)[1].lower() in _IMG_EXT:
                            return True
                    elif entry.is_dir() and _dir_has_cards_shallow(entry.path, depth - 1):
                        return True
                except OSError:
                    continue
    except OSError:
        pass
    return False


@routes.post("/gc_tool/list_dir")
async def list_dir(request: web.Request) -> web.Response:
    """List subdirectories of `path` for a folder-picker dialog.

    Body: {path}  ('' or omitted = list drive roots on Windows)
    Returns: {ok, path, parent, entries:[{name, path, has_cards}]}
    has_cards = the subdir DIRECTLY contains at least one image file
    (shallow check; deep content is confirmed when scanning for real).
    """
    try:
        body = await request.json()
    except Exception:
        body = {}
    path = str(body.get("path") or "").strip()

    if not path:
        # Windows drive roots
        import string
        entries = []
        for letter in string.ascii_uppercase:
            root = f"{letter}:\\"
            if os.path.isdir(root):
                entries.append({"name": root, "path": root, "has_cards": False})
        return web.json_response({"ok": True, "path": "", "parent": None,
                                  "home": os.path.expanduser("~"),
                                  "entries": entries})

    if not os.path.isdir(path):
        return web.json_response({"error": f"not a directory: {path}"}, status=400)

    parent = os.path.dirname(path.rstrip("\\/")) or None
    entries = []
    try:
        names = sorted(os.listdir(path))
    except OSError:
        names = []
    for name in names:
        sub = os.path.join(path, name)
        if not os.path.isdir(sub):
            continue
        entries.append({"name": name, "path": sub,
                        "has_cards": _dir_has_cards_shallow(sub)})
    # dirs with cards first, then alphabetical
    entries.sort(key=lambda e: (not e["has_cards"], e["name"].lower()))
    return web.json_response({"ok": True, "path": path, "parent": parent,
                              "home": os.path.expanduser("~"),
                              "entries": entries})


@routes.get("/gc_tool/asset_view")
async def asset_view(request: web.Request) -> web.Response:
    path = request.query.get("path", "")
    if not path:
        return web.json_response({"error": "path required"}, status=400)
    p = Path(path)
    try:
        resolved = p.resolve()
    except OSError:
        return web.json_response({"error": "bad path"}, status=400)
    if not resolved.is_file():
        return web.json_response({"error": "not found"}, status=404)
    # Only serve files that a scan could have produced (image or desc text).
    ext = resolved.suffix.lower()
    if ext not in (".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif", ".md", ".txt"):
        return web.json_response({"error": "file type not allowed"}, status=403)
    ctype = mimetypes.guess_type(str(resolved))[0] or "application/octet-stream"
    return web.FileResponse(resolved, headers={"Content-Type": ctype,
                                               "Cache-Control": "no-cache"})


@routes.get("/gc_tool/asset_desc")
async def asset_desc(request: web.Request) -> web.Response:
    path = request.query.get("path", "")
    if not path:
        return web.json_response({"error": "path required"}, status=400)
    p = Path(path)
    try:
        text = p.read_text(encoding="utf-8")
    except Exception:
        text = ""
    return web.json_response({"ok": True, "text": text})


def _quote(s: str) -> str:
    import urllib.parse
    return urllib.parse.quote(s, safe="")


def _desc_path(img_path: str) -> str:
    """Same-name .md/.txt next to the image (mirrors nodes._desc_for)."""
    base = os.path.splitext(img_path)[0]
    for ext in (".md", ".txt"):
        p = base + ext
        if os.path.isfile(p):
            return p
    return img_path  # fall back to serving the image itself (no-op)
