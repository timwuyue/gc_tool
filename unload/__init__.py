from .nodes import ModelUnload

NODE_CLASS_MAPPINGS = {
    "GC_unload": ModelUnload,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "GC_unload": "卸载模型",
}

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]
