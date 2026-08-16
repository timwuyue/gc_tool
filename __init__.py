# Package entry — `git clone https://github.com/timwuyue/gc_tool.git` gives a
# directory (`gc_tool/`) that is directly loadable by ComfyUI when placed in
# custom_nodes/.
from .llama_mini.nodes import LlamaMini
from .unload.nodes import ModelUnload
from .asset_library.nodes import AssetLibrary, AssetPicker

NODE_CLASS_MAPPINGS = {
    "llama_mini": LlamaMini,
    "unload_clear": ModelUnload,
    "GC_AssetLibrary": AssetLibrary,
    "GC_AssetPicker": AssetPicker,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "llama_mini": "llama_mini",
    "unload_clear": "unload_clear",
    "GC_AssetLibrary": "资产库 (Asset Library)",
    "GC_AssetPicker": "资产选择器 (Asset Picker)",
}

# Frontend extension directory (settings + dsh.js), relative to this package.
WEB_DIRECTORY = "./llama_mini/web"

# DSH bridge: routes /dsh/* (chat proxy to the DSH agent harness at
# http://127.0.0.1:3080, realtime ws stream, question/approval cards, file
# viewer). Importing this module registers the routes on PromptServer.
from . import dsh_bridge as _dsh_bridge  # noqa: F401

# Asset library: routes /gc_tool/* (scan_assets / asset_view / asset_desc)
# and the asset node frontend extension. Importing the subpackage registers
# both the nodes (already mapped above) and the routes.
from . import asset_library as _asset_library  # noqa: F401

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
