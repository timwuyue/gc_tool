from .nodes import ModelUnload

NODE_CLASS_MAPPINGS = {
    "unload_clear": ModelUnload,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "unload_clear": "unload_clear",
}

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]
