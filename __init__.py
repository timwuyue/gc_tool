# Package entry — `git clone https://github.com/timwuyue/gc_tool.git` gives a
# directory (`gc_tool/`) that is directly loadable by ComfyUI when placed in
# custom_nodes/.
from .llama_mini.nodes import LlamaMini
from .unload.nodes import ModelUnload
from .multi_image.nodes import MultiImageLoader

NODE_CLASS_MAPPINGS = {
    "llama_mini": LlamaMini,
    "unload_clear": ModelUnload,
    "GC_MultiImageLoader": MultiImageLoader,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "llama_mini": "llama_mini",
    "unload_clear": "unload_clear",
    "GC_MultiImageLoader": "多图加载 (Multi Image Loader)",
}

# Frontend extension directory (settings + dsh.js + multi_image.js), relative
# to this package.
WEB_DIRECTORY = "./llama_mini/web"

# DSH bridge: routes /dsh/* (chat proxy to the DSH agent harness at
# http://127.0.0.1:3080, realtime ws stream, question/approval cards, file
# viewer). Importing this module registers the routes on PromptServer.
from . import dsh_bridge as _dsh_bridge  # noqa: F401

# Multi-image loader: routes /gc_tool/upload_images and the node frontend.
from . import multi_image as _multi_image  # noqa: F401

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
