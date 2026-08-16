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

from .nodes import scan_directory

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
