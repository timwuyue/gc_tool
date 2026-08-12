"""ComfyUI node: LlamaMini.

Single node that merges vision and text modes:
- With images: one multi-image request (combine + multi-turn, instruction
  front-loaded) — the model sees all images natively.
- Without images: plain text LLM call.

Fixed defaults for the user's setup: Qwen3.5-9B-Uncensored model name/path,
max_tokens 32768, max_side 256. server_url/api_key/model/model_path are
marked advanced; unload_after sits at the bottom.
"""

import concurrent.futures
import gc
import json
import os
import time

import requests

try:
    # Normal path: loaded as a package inside ComfyUI's custom_nodes/.
    from .llama_client import (
        DEFAULT_MAX_TOKENS,
        DEFAULT_SERVER_URL,
        DEFAULT_TEMPERATURE,
        DEFAULT_TIMEOUT,
        DEFAULT_TOP_P,
        _model_present,
        _wait_for_model,
        chat_completion,
        load_model,
        pil_to_data_uri,
        resize_to_max_side,
        tensor_to_pil,
        unload_model,
    )
except ImportError:  # Top-level module path (unit tests, direct execution).
    from llama_client import (
        DEFAULT_MAX_TOKENS,
        DEFAULT_SERVER_URL,
        DEFAULT_TEMPERATURE,
        DEFAULT_TIMEOUT,
        DEFAULT_TOP_P,
        _model_present,
        _wait_for_model,
        chat_completion,
        load_model,
        pil_to_data_uri,
        resize_to_max_side,
        tensor_to_pil,
        unload_model,
    )

# Fixed configuration for this user's setup (no widgets to keep the panel
# minimal and free of the frontend's collapsed-widget blank space).
# These are DEFAULTS; live values come from the ComfyUI Settings panel:
# web/js/settings.js registers them (KJNodes-style), the frontend persists
# them to user/<user>/comfy.settings.json, and _read_config loads them.
API_KEY = ""
MODEL_NAME = "Qwen3.5-9B-Uncensored-HauhauCS-Aggressive-Q8_0"
MAX_TOKENS = 32768
TEMPERATURE = DEFAULT_TEMPERATURE
TOP_P = DEFAULT_TOP_P
TIMEOUT = DEFAULT_TIMEOUT
MAX_SIDE = 256

CONFIG_KEYS = {
    "server_url": "llama_mini.server_url",
    "api_key": "llama_mini.api_key",
    "model": "llama_mini.model",
    "model_path": "llama_mini.model_path",
    "max_tokens": "llama_mini.max_tokens",
    "temperature": "llama_mini.temperature",
    "top_p": "llama_mini.top_p",
    "timeout": "llama_mini.timeout",
    "max_side": "llama_mini.max_side",
    "debug_log": "llama_mini.debug_log",
    "local_server_url": "llama_mini.local_server_url",
}

# name -> default (fallback when a setting is missing)
_CONFIG_DEFAULTS = {
    "server_url": DEFAULT_SERVER_URL,
    "api_key": API_KEY,
    "model": MODEL_NAME,
    "model_path": MODEL_NAME,
    "max_tokens": MAX_TOKENS,
    "temperature": TEMPERATURE,
    "top_p": TOP_P,
    "timeout": TIMEOUT,
    "max_side": MAX_SIDE,
    "debug_log": False,
    "local_server_url": "http://127.0.0.1:8188",
}


def _user_settings_candidates() -> list[str]:
    """Possible paths to the user's comfy.settings.json (frontend persists
    the registered settings there). Uses folder_paths.get_user_directory()
    (the official ComfyUI API); `args.user_directory` is None by default,
    so it cannot be used to build the path."""
    candidates = []
    try:
        import folder_paths

        user_dir = folder_paths.get_user_directory()
        candidates.append(os.path.join(user_dir, "default", "comfy.settings.json"))
        # Fallback: any user subdirectory holding a settings file.
        try:
            for name in sorted(os.listdir(user_dir)):
                p = os.path.join(user_dir, name, "comfy.settings.json")
                if os.path.isfile(p) and p not in candidates:
                    candidates.append(p)
        except Exception:
            pass
    except Exception:
        pass
    return candidates


def _read_config(settings_path: str | None = None) -> dict:
    """Read the node's settings from the user's comfy.settings.json.

    The values are registered by web/js/settings.js and persisted by the
    ComfyUI frontend. Falls back to defaults when the file is missing /
    corrupt or a key is absent. `settings_path` is injectable for testing.
    """
    if settings_path is None:
        settings_path = next((p for p in _user_settings_candidates() if os.path.isfile(p)), None)
    file_cfg = {}
    if settings_path:
        try:
            with open(settings_path, encoding="utf-8") as f:
                file_cfg = json.load(f) or {}
        except Exception:
            file_cfg = {}
    out = {}
    for name, default in _CONFIG_DEFAULTS.items():
        key = CONFIG_KEYS[name]
        out[name] = file_cfg.get(key, default)
    return out


def _run_in_thread(fn):
    """Run fn in a background thread, polling in the foreground.

    ComfyUI executes node functions synchronously; blocking directly on
    requests would stall the queue. Polling every 50ms keeps the UI alive.
    """
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(fn)
        while not future.done():
            time.sleep(0.05)
        return future.result()


def _log(*args):
    """Print a runtime log line to the ComfyUI console."""
    print("[llama_mini]", *args, flush=True)


def _unload_local_models():
    """In-process unload of this ComfyUI's loaded models + PyTorch cache.

    llama_mini runs inside this ComfyUI, so this always frees the local
    VRAM regardless of where the node sits in the workflow.
    """
    try:
        from comfy import model_management as _mm

        _mm.unload_all_models()
        _mm.soft_empty_cache()
    except Exception as _exc:
        _log(f"本地卸载失败（comfy.model_management 不可用）: {_exc}")
    gc.collect()


def _free_remote(comfy_url: str):
    """POST /free to a remote ComfyUI instance (same endpoint as Edit >
    "Unload models and free up memory"). No-op when the URL is empty."""
    if not comfy_url or not comfy_url.strip():
        return
    url = comfy_url.rstrip("/") + "/free"
    try:
        resp = requests.post(
            url,
            json={"unload_models": True, "free_memory": True},
            timeout=30,
            # Direct connection; a system proxy can stall or time out.
            proxies={"http": None, "https": None},
        )
        if resp.status_code != 200:
            _log(f"POST /free failed: HTTP {resp.status_code} ({url})")
        else:
            _log(f"freed memory via {url}")
    except Exception as _exc:
        _log(f"POST /free failed: {_exc} ({url})")


def _ensure_model_loaded(server_url, api_key, model_path, timeout):
    """Auto-reload after an unload: if model_path is set and the named model
    is not loaded, hot-load it via POST /models/load and wait until it is
    actually ready (loading is async). No-op when model_path is empty.
    """
    if not model_path or not model_path.strip():
        return
    model_name = model_path.strip()
    if _model_present(server_url, api_key, model_name, timeout):
        return
    load_model(server_url, api_key, model_name)
    _wait_for_model(server_url, api_key, want_loaded=True, model_name=model_name)


def _encode_image(img, max_side: int) -> str:
    """Optionally shrink to max_side, then encode as a JPEG data URI."""
    if max_side > 0:
        img = resize_to_max_side(img, max_side)
    return pil_to_data_uri(img)


class LlamaMini:
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "generate"
    CATEGORY = "GC_Tool/llama_mini"

    @classmethod
    def INPUT_TYPES(cls) -> dict:
        return {
            "required": {
                "seed": ("INT", {"default": -1, "min": -1, "max": 2147483647}),
                # Unload THIS ComfyUI's models + free cache (in-process,
                # always works) BEFORE the llama request.
                "unload_before": ("BOOLEAN", {"default": False}),
                # Additionally POST /free to the remote ComfyUI at
                # Local Server URL.
                "unload_before_remote": ("BOOLEAN", {"default": False}),
                # Unload the model right after this node finishes (frees VRAM/RAM).
                "unload_after": ("BOOLEAN", {"default": False}),
            },
            "optional": {
                # Image port on top; no image input = text mode.
                "images": ("IMAGE",),
                # forceInput ports: no widget on the panel, must be wired.
                "prompt": ("STRING", {"forceInput": True}),
                "system": ("STRING", {"forceInput": True}),
            },
        }

    def generate(
        self,
        seed: int = -1,
        unload_before: bool = False,
        unload_before_remote: bool = False,
        unload_after: bool = False,
        prompt: str | None = None,
        system: str | None = None,
        images=None,
    ):
        # Optional ports may be unwired; treat as empty strings.
        prompt = prompt or ""
        system = system or ""

        # Live values from the ComfyUI Settings panel (seed is a widget).
        cfg = _read_config()
        server_url = cfg["server_url"]
        api_key = cfg["api_key"]
        model = cfg["model"]
        model_path = cfg["model_path"]
        max_tokens = cfg["max_tokens"]
        temperature = cfg["temperature"]
        top_p = cfg["top_p"]
        timeout = cfg["timeout"]
        max_side = cfg["max_side"]
        debug_log = bool(cfg.get("debug_log", False))
        local_server_url = cfg.get("local_server_url", "http://127.0.0.1:8188")

        # Free VRAM before the llama request (avoid OOM/slowness when a
        # previous workflow stage left SD models loaded).
        if unload_before:
            _unload_local_models()
        if unload_before_remote:
            _free_remote(local_server_url)

        image_list = list(images) if images is not None else []
        if images is not None and hasattr(images, "dim") and images.dim() == 3:
            image_list = [images]

        mode = "vision" if image_list else "text"
        if debug_log:
            _log(
                f"mode={mode}, images={len(image_list)}, server_url={server_url}, "
                f"model={model}, model_path={model_path}, max_tokens={max_tokens}, "
                f"temperature={temperature}, top_p={top_p}, seed={seed}, "
                f"timeout={timeout}, max_side={max_side}, unload_after={unload_after}"
            )

        # Auto-reload after a previous unload.
        _run_in_thread(
            lambda: _ensure_model_loaded(server_url, api_key, model_path, timeout)
        )

        if not image_list:
            # Text mode: no images.
            result = _run_in_thread(
                lambda: chat_completion(
                    server_url=server_url,
                    api_key=api_key,
                    system_prompt=system,
                    prompt=prompt,
                    image_data_uris=[],
                    model=model,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    top_p=top_p,
                    seed=seed,
                    timeout=timeout,
                    multi_turn=False,
                )
            )
        else:
            # Vision mode: one multi-image request, instruction front-loaded
            # (combine + multi_turn, fixed).
            uris = [_encode_image(tensor_to_pil(img), max_side) for img in image_list]
            result = _run_in_thread(
                lambda: chat_completion(
                    server_url=server_url,
                    api_key=api_key,
                    system_prompt=system,
                    prompt=prompt,
                    image_data_uris=uris,
                    model=model,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    top_p=top_p,
                    seed=seed,
                    timeout=timeout,
                    multi_turn=True,
                )
            )

        # Unload right after this node finishes (frees VRAM/RAM for other tasks).
        if unload_after:
            _run_in_thread(lambda: unload_model(server_url, api_key, model_name=model_path))

        if debug_log:
            _log(f"result ({len(result)} chars): {result[:120]!r}")

        return (result,)
