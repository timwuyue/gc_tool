from .nodes import LlamaMini

NODE_CLASS_MAPPINGS = {
    "llama_mini": LlamaMini,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "llama_mini": "llama_mini",
}

# Frontend extension directory (web/js/settings.js registers the node's
# settings into the ComfyUI Settings panel).
WEB_DIRECTORY = "./web"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
