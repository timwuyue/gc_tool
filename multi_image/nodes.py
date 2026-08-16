"""GC_Tool multi-image loader node.

The simplest possible multi-image loader: pick any number of images in a
native multi-select dialog, append/remove cards in the node body, tick the
ones you want to output, and get an IMAGE batch out.

- Node widget `image_paths` (hidden): JSON array of absolute paths of the
  uploaded files (frontend-managed).
- Node widget `selected` (hidden): JSON array of the absolute paths that are
  ticked for output (empty = all images).
- Files are stored under ComfyUI's input/gc_multi/ so the paths survive
  restarts and workflow saves.

No directory scanning, no classification, no secondary picker node — this is
a plain multi-image loader.
"""

import json
import os

import folder_paths


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


class MultiImageLoader:
    RETURN_TYPES = ("IMAGE", "IMAGE")
    RETURN_NAMES = ("images", "all_images")
    FUNCTION = "load"
    CATEGORY = "GC_Tool/图像"

    @classmethod
    def INPUT_TYPES(cls) -> dict:
        return {
            "required": {
                # Hidden widgets, written by the frontend after uploads and
                # selection ticks. `image_paths` = all loaded images;
                # `selected` = which ones to emit (empty => all).
                "image_paths": ("STRING", {"default": "[]", "multiline": True}),
                "selected": ("STRING", {"default": "[]", "multiline": True}),
            },
        }

    def load(self, image_paths: str = "[]", selected: str = "[]"):
        try:
            paths = json.loads(image_paths or "[]")
        except (ValueError, TypeError):
            paths = []
        if not isinstance(paths, list):
            paths = []

        try:
            sel = json.loads(selected or "[]")
        except (ValueError, TypeError):
            sel = []
        if not isinstance(sel, list) or not sel:
            sel = paths  # nothing ticked => all images
        # keep order of paths, only ticked ones
        emit = [p for p in paths if p in sel]

        tensors = []
        for p in emit:
            if not p or not os.path.isfile(p):
                continue
            try:
                tensors.append(_load_image_tensor(p))
            except Exception:
                continue

        if not tensors:
            raise RuntimeError(
                "GC_MultiImageLoader: no valid images — click 选择图片 to load "
                "files, then tick the ones to output (or leave all ticked)."
            )

        import torch
        batch = torch.cat(tensors, dim=0)

        # all_images = everything loaded (useful for previews / side chains)
        all_tensors = []
        for p in paths:
            if p and os.path.isfile(p):
                try:
                    all_tensors.append(_load_image_tensor(p))
                except Exception:
                    continue
        all_batch = torch.cat(all_tensors, dim=0) if all_tensors else batch
        return (batch, all_batch)


NODE_CLASS_MAPPINGS = {
    "GC_MultiImageLoader": MultiImageLoader,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "GC_MultiImageLoader": "多图加载 (Multi Image Loader)",
}
