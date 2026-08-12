# Package entry — `git clone https://github.com/timwuyue/gc_tool.git` gives a
# directory (`gc_tool/`) that is directly loadable by ComfyUI when placed in
# custom_nodes/. The actual node code lives under GC_Tool/.
from .GC_Tool.llama_mini.nodes import LlamaMini
from .GC_Tool.unload.nodes import ModelUnload

NODE_CLASS_MAPPINGS = {
    "llama_mini": LlamaMini,
    "GC_unload": ModelUnload,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "llama_mini": "llama_mini",
    "GC_unload": "卸载模型",
}

# Frontend extension directory (settings registration), relative to this package.
WEB_DIRECTORY = "./GC_Tool/llama_mini/web"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
