"""GC_Tool multi-image loader package.

Exports the GC_MultiImageLoader node and registers the /gc_tool/upload_images
route on PromptServer (importing this package).
"""

from . import nodes  # noqa: F401
from . import server as _server  # noqa: F401  (registers /gc_tool/upload_images)

NODE_CLASS_MAPPINGS = nodes.NODE_CLASS_MAPPINGS
NODE_DISPLAY_NAME_MAPPINGS = nodes.NODE_DISPLAY_NAME_MAPPINGS

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]
