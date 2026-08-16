"""GC_Tool asset library package.

Exports the two asset nodes and their frontend extension directory.
Importing this package also registers the /gc_tool/* server routes
(scan_assets / asset_view / asset_desc) on PromptServer.
"""

from . import nodes  # noqa: F401
from . import server as _server  # noqa: F401  (registers /gc_tool/* routes)

NODE_CLASS_MAPPINGS = nodes.NODE_CLASS_MAPPINGS
NODE_DISPLAY_NAME_MAPPINGS = nodes.NODE_DISPLAY_NAME_MAPPINGS

WEB_DIRECTORY = "./web"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
