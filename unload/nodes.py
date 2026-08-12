"""ComfyUI node: 卸载模型 (ModelUnload).

Mirrors the ComfyUI menu actions "Edit > Unload models" and
"Edit > Unload models and free up memory":
- unload_models:  unload_all_models()  — release loaded model VRAM/RAM
- clear_cache:    soft_empty_cache() + gc.collect() — free PyTorch cache

The input is passed through unchanged so the node can sit anywhere in a
workflow graph.
"""

import gc

try:
    from comfy import model_management as _mm
except ImportError:  # top-level / test environment without ComfyUI
    _mm = None


class AnyType(str):
    def __ne__(self, __value: object) -> bool:
        return False


any_type = AnyType("*")


class ModelUnload:
    @classmethod
    def INPUT_TYPES(cls) -> dict:
        return {
            "required": {
                "unload_models": ("BOOLEAN", {"default": True}),
                "clear_cache": ("BOOLEAN", {"default": True}),
            },
            "optional": {
                "any": (any_type,),
            },
        }

    RETURN_TYPES = (any_type,)
    RETURN_NAMES = ("any",)
    FUNCTION = "unload"
    CATEGORY = "GC_Tool"

    def unload(self, unload_models: bool = True, clear_cache: bool = True, any=None):
        mm = _mm
        if mm is None:
            try:
                from comfy import model_management as mm
            except ImportError:
                print("[GC_Tool] comfy.model_management unavailable, cannot unload")
                return (any,)

        if unload_models:
            mm.unload_all_models()
        if clear_cache:
            mm.soft_empty_cache()
        gc.collect()
        return (any,)
