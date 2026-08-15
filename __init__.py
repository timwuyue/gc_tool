# Package entry — `git clone https://github.com/timwuyue/gc_tool.git` gives a
# directory (`gc_tool/`) that is directly loadable by ComfyUI when placed in
# custom_nodes/.
from .llama_mini.nodes import LlamaMini
from .unload.nodes import ModelUnload

NODE_CLASS_MAPPINGS = {
    "llama_mini": LlamaMini,
    "unload_clear": ModelUnload,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "llama_mini": "llama_mini",
    "unload_clear": "unload_clear",
}

# Frontend extension directory (settings + dsh.js), relative to this package.
WEB_DIRECTORY = "./llama_mini/web"

# DSH bridge: routes /dsh/* (chat proxy to the DSH agent harness at
# http://127.0.0.1:3080, realtime ws stream, question/approval cards, file
# viewer). Importing this module registers the routes on PromptServer.
from . import dsh_bridge as _dsh_bridge  # noqa: F401

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
