# GC_Tool package entry — ComfyUI loads custom_nodes/GC_Tool/ as a node
# package and registers the nodes exported here.
from .llama_mini.nodes import LlamaMini
from .unload.nodes import ModelUnload

NODE_CLASS_MAPPINGS = {
    "llama_mini": LlamaMini,
    "GC_unload": ModelUnload,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "llama_mini": "llama_mini",
    "GC_unload": "卸载模型",
}

# Frontend extension directory (settings registration), relative to this package.
WEB_DIRECTORY = "./llama_mini/web"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
