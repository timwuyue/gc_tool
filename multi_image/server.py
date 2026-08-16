"""GC_Tool multi-image loader server routes.

POST /gc_tool/upload_images — multipart upload of picked image files (and
optional same-name .md/.txt), stored under ComfyUI input/gc_multi/. Returns
the saved files with standard /view URLs for preview.

Browsers cannot hand over absolute paths, so the multi-select dialog uploads
the file contents instead; the loader node keeps the absolute paths in its
hidden widget and reads them back at execution time.
"""

import os
import uuid

from aiohttp import web
from server import PromptServer

import folder_paths

routes = PromptServer.instance.routes

_IMG_EXT = (".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif")
_SUBDIR = "gc_multi"


@routes.post("/gc_tool/upload_images")
async def upload_images(request: web.Request) -> web.Response:
    """Accept multipart field `files` (repeated). Returns
    {ok, files: [{filename, path, url, name}]}."""
    try:
        input_dir = folder_paths.get_input_directory()
    except Exception:
        input_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "input")
    dest_dir = os.path.join(input_dir, _SUBDIR)
    os.makedirs(dest_dir, exist_ok=True)

    saved: list[dict] = []
    try:
        reader = await request.multipart()
        while True:
            part = await reader.next()
            if part is None:
                break
            if part.name != "files":
                continue
            fname = os.path.basename(str(part.filename or "file"))
            ext = os.path.splitext(fname)[1].lower()
            if ext not in _IMG_EXT and ext not in (".md", ".txt"):
                continue
            # de-dup: keep the first occurrence of a filename
            dest = os.path.join(dest_dir, fname)
            i = 1
            base, e = os.path.splitext(fname)
            while os.path.exists(dest):
                dest = os.path.join(dest_dir, f"{base}_{i}{e}")
                i += 1
            with open(dest, "wb") as f:
                while True:
                    chunk = await part.read_chunk(1024 * 512)
                    if not chunk:
                        break
                    f.write(chunk)
            rel = os.path.relpath(dest, input_dir)
            saved.append({
                "filename": os.path.basename(dest),
                "path": dest,
                "name": os.path.splitext(os.path.basename(dest))[0],
                "url": f"/view?filename={os.path.basename(dest)}"
                       f"&subfolder={_SUBDIR}&type=input",
            })
    except Exception as e:
        return web.json_response({"error": f"upload failed: {e}"}, status=400)

    if not saved:
        return web.json_response(
            {"error": "no valid image files uploaded"}, status=400)
    return web.json_response({"ok": True, "count": len(saved), "files": saved})
