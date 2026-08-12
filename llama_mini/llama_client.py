"""Shared HTTP client and image encoding for llama.cpp server interactions.

This module is the single place that talks to the llama.cpp OpenAI-compatible
endpoint. Both nodes (LlamaVisionCaption, LlamaTextLLM) use it, so request
construction, error classification, and image encoding live here only.
"""

import base64
import io
import random
import time

import numpy as np
import requests

# Requests must NOT go through any system proxy: the llama server
# (local or LAN) is normally reachable directly, and a proxy (e.g.
# 127.0.0.1:7890) can stall or time out those connections.
_NO_PROXY = {"http": None, "https": None}
from PIL import Image

DEFAULT_SERVER_URL = "http://127.0.0.1:8080"
DEFAULT_MAX_TOKENS = 512
DEFAULT_TEMPERATURE = 0.7
DEFAULT_TOP_P = 1.0
DEFAULT_TIMEOUT = 60

_ERR_CONNECTION = (
    "无法连接 llama.cpp server（{url}）：请确认 llama-server 已启动、"
    "端口正确，且未启用防火墙拦截。"
)
_ERR_TIMEOUT = (
    "请求超时（>{timeout}s）。可增大 timeout 参数，"
    "或检查模型是否仍在加载（首次加载可能较慢）。"
)
_ERR_HTTP = "llama.cpp server 返回 HTTP {status}：{body}"
_ERR_PARSE = "无法解析 server 响应：{detail}"
_ERR_EMPTY = "server 响应中没有文本内容（choices 为空）。"
_ERR_NO_MODEL = (
    "模型未加载（no_model_loaded）：若开启了“完成后卸载”（unload_after），"
    "请填写 model_path 以便下次自动重新加载，或重启 llama-server 后重试。"
)
_ERR_UNLOAD = "模型卸载失败：{detail}"
_ERR_LOAD = "模型加载失败：{detail}"
_ERR_UNLOAD_NO_MODEL = (
    "卸载模型需要模型名：请在 model_path 中填写模型名"
    "（router 模式下为 GGUF 文件名、HF repo 名或 --alias）。"
    "注意：单模型模式（-m 启动）没有卸载端点，请改用 --sleep-idle-seconds。"
)
_ERR_UNLOAD_UNSUPPORTED = (
    "模型卸载失败：server 没有模型卸载端点（POST /models/unload，HTTP 404）。"
    "说明你的 llama-server 不是 router 模式或版本过旧。可选方案："
    "① 单模型模式（-m 启动）无法通过 API 卸载，请改用启动参数"
    " --sleep-idle-seconds N 实现空闲自动卸载；"
    "② 切换到 router 模式（不带 -m 启动，用 --models-dir 或 -hf 加载模型）"
    "后即可用本节点卸载；"
    "③ 关闭本节点的 unload_after 开关。"
)
_ERR_LOAD_UNSUPPORTED = (
    "模型加载失败：server 没有模型加载端点（POST /models/load，HTTP 404）。"
    "请切换到 router 模式（不带 -m 启动，用 --models-dir 或 -hf 加载模型），"
    "或清空 model_path 关闭自动加载。"
)
_ERR_MODEL_API_UNSUPPORTED = (
    "server 不支持模型管理端点（{method} {url} 返回 HTTP {status}）。"
    "请升级 llama-server 到支持模型热加载/卸载的版本。"
)
_ERR_LOAD_TIMEOUT = (
    "模型加载超时（>{timeout}s）：模型较大或磁盘较慢，请稍后重试或检查 server 日志。"
)
_ERR_UNLOAD_TIMEOUT = (
    "模型卸载超时（>{timeout}s）：请检查 server 日志确认显存是否已释放。"
)

# Model (de)loading is a rare, heavy operation; give it a generous timeout.
_LOAD_TIMEOUT = 600
# Per-poll GET timeout while waiting for an async (un)load to finish.
_POLL_GET_TIMEOUT = 10


def tensor_to_pil(image) -> Image.Image:
    """Convert a single ComfyUI IMAGE tensor (H,W,C float32 0-1) to a PIL Image.

    The tensor is detached/moved to CPU first so GPU-resident or
    requires_grad tensors work too.
    """
    arr = image.detach().cpu().numpy()
    arr = (arr * 255.0).clip(0, 255).astype(np.uint8)
    return Image.fromarray(arr)


def resize_to_max_side(img: Image.Image, max_side: int) -> Image.Image:
    """Resize keeping aspect ratio so the longest side <= max_side.

    No-op when max_side <= 0 or the image is already smaller. Shrinking
    multi-image inputs keeps visual tokens low, which stabilises how the
    model perceives several images at once.
    """
    if max_side <= 0:
        return img
    w, h = img.size
    scale = min(max_side / max(w, h), 1.0)
    if scale >= 1.0:
        return img
    new_w, new_h = max(1, round(w * scale)), max(1, round(h * scale))
    return img.resize((new_w, new_h), Image.Resampling.LANCZOS)


def pil_to_data_uri(img: Image.Image, fmt: str = "JPEG", quality: int = 85) -> str:
    """Encode a PIL Image as a base64 data URI, in memory only (no disk IO).

    JPEG is the default: ~10x smaller payloads than PNG with negligible
    quality loss for captioning.
    """
    buf = io.BytesIO()
    img.save(buf, format=fmt, quality=quality)
    mime = "image/png" if fmt.upper() == "PNG" else "image/jpeg"
    return f"data:{mime};base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def build_messages(system_prompt: str, prompt: str, image_data_uris: list[str]) -> list[dict]:
    """Build the chat messages list.

    - With images: OpenAI-style array content ({"type": "image_url", ...}).
    - Text-only: plain string content (degenerate case).
    """
    messages = []
    if system_prompt and system_prompt.strip():
        messages.append({"role": "system", "content": system_prompt.strip()})
    if image_data_uris:
        content: list[dict] = [{"type": "text", "text": prompt}]
        content.extend(
            {"type": "image_url", "image_url": {"url": uri}} for uri in image_data_uris
        )
        messages.append({"role": "user", "content": content})
    else:
        messages.append({"role": "user", "content": prompt})
    return messages


def build_messages_multi_turn(
    system_prompt: str, prompt: str, image_data_uris: list[str]
) -> list[dict]:
    """One image per user turn, instruction front-loaded (experimental).

    The instruction goes in the FIRST user message (before any image) and
    there is no trailing plain-text user message. Empirical finding: a
    trailing text-only user message after the image turns distracts some
    models (they echo the "这是第 N 张图" marker instead of answering);
    leaving it out lets the model caption every image reliably.
    """
    messages = []
    if system_prompt and system_prompt.strip():
        messages.append({"role": "system", "content": system_prompt.strip()})
    if prompt and prompt.strip():
        intro = (
            f"这里一共有 {len(image_data_uris)} 张图片，我会逐张发送。"
            f"请查看全部图片后，{prompt.strip()}"
        )
        messages.append({"role": "user", "content": intro})
    for i, uri in enumerate(image_data_uris, start=1):
        messages.append({
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": uri}},
                {"type": "text", "text": f"这是第 {i} 张图。"},
            ],
        })
    return messages


def build_payload(
    system_prompt: str,
    prompt: str,
    image_data_uris: list[str],
    model: str = "",
    max_tokens: int = DEFAULT_MAX_TOKENS,
    temperature: float = DEFAULT_TEMPERATURE,
    top_p: float = DEFAULT_TOP_P,
    seed: int = -1,
    multi_turn: bool = False,
) -> dict:
    """Build the /v1/chat/completions request body.

    - `model` is omitted when empty (single-model server does not care).
    - `seed` is omitted when < 0 (server-side randomness).
    - `multi_turn` uses one user message per image (instruction first)
      instead of packing all images into one message.
    """
    if multi_turn:
        messages = build_messages_multi_turn(system_prompt, prompt, image_data_uris)
    else:
        messages = build_messages(system_prompt, prompt, image_data_uris)
    payload = {
        "messages": messages,
        "max_tokens": int(max_tokens),
        "temperature": float(temperature),
        "top_p": float(top_p),
        "stream": False,
    }
    if model and model.strip():
        payload["model"] = model.strip()
    if seed is not None and int(seed) >= 0:
        payload["seed"] = int(seed)
    else:
        # llama.cpp uses a fixed default seed when none is given, so -1
        # (random) must send an explicit random seed to vary the output.
        payload["seed"] = random.randint(0, 2**31 - 1)
    return payload


def chat_completion(
    server_url: str,
    api_key: str,
    system_prompt: str,
    prompt: str,
    image_data_uris: list[str],
    model: str = "",
    max_tokens: int = DEFAULT_MAX_TOKENS,
    temperature: float = DEFAULT_TEMPERATURE,
    top_p: float = DEFAULT_TOP_P,
    seed: int = -1,
    timeout: int = DEFAULT_TIMEOUT,
    multi_turn: bool = False,
) -> str:
    """Send one non-streaming chat completion request and return the text.

    Raises RuntimeError with an actionable, classified Chinese message on any
    failure (connection / timeout / HTTP error / parse error / empty result).
    """
    url = server_url.rstrip("/") + "/v1/chat/completions"
    headers = {"Content-Type": "application/json"}
    if api_key and api_key.strip():
        headers["Authorization"] = "Bearer " + api_key.strip()

    payload = build_payload(
        system_prompt=system_prompt,
        prompt=prompt,
        image_data_uris=image_data_uris,
        model=model,
        max_tokens=max_tokens,
        temperature=temperature,
        top_p=top_p,
        seed=seed,
        multi_turn=multi_turn,
    )
    # timeout <= 0 means "wait forever"; requests needs None for that.
    request_timeout = _resolve_timeout(timeout)

    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=request_timeout, proxies=_NO_PROXY)
    except requests.exceptions.ConnectionError as exc:
        raise RuntimeError(_ERR_CONNECTION.format(url=url)) from exc
    except requests.exceptions.Timeout as exc:
        raise RuntimeError(_ERR_TIMEOUT.format(timeout=timeout)) from exc
    except requests.exceptions.RequestException as exc:
        raise RuntimeError(f"请求失败：{exc}") from exc

    if resp.status_code != 200:
        try:
            err_type = resp.json().get("error", {}).get("type", "")
        except ValueError:
            err_type = ""
        if err_type == "no_model_loaded":
            raise RuntimeError(_ERR_NO_MODEL)
        raise RuntimeError(_ERR_HTTP.format(status=resp.status_code, body=resp.text[:500]))

    try:
        data = resp.json()
        choices = data["choices"]
    except (ValueError, KeyError, TypeError) as exc:
        raise RuntimeError(_ERR_PARSE.format(detail=exc)) from exc

    if not choices:
        raise RuntimeError(_ERR_EMPTY)

    try:
        content = choices[0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError(_ERR_PARSE.format(detail=exc)) from exc

    if content is None:
        raise RuntimeError(_ERR_EMPTY)
    return content


def _models_url(server_url: str) -> str:
    """GET /v1/models (OpenAI-compatible model list, both modes)."""
    return server_url.rstrip("/") + "/v1/models"


def _models_mgmt_url(server_url: str, action: str) -> str:
    """POST /models/load and /models/unload (router mode only)."""
    return server_url.rstrip("/") + "/models/" + action


def _auth_headers(api_key: str) -> dict:
    headers = {"Content-Type": "application/json"}
    if api_key and api_key.strip():
        headers["Authorization"] = "Bearer " + api_key.strip()
    return headers


def _models_list(server_url: str, api_key: str, timeout: int) -> list:
    """GET /v1/models and return the `data` list (loaded models, both modes)."""
    try:
        resp = requests.get(
            _models_url(server_url), headers=_auth_headers(api_key), timeout=_resolve_timeout(timeout),
            proxies=_NO_PROXY,
        )
    except requests.exceptions.Timeout as exc:
        raise RuntimeError(_ERR_TIMEOUT.format(timeout=timeout)) from exc
    except requests.exceptions.RequestException as exc:
        raise RuntimeError(_ERR_CONNECTION.format(url=_models_url(server_url))) from exc
    if resp.status_code == 404:
        raise RuntimeError(_ERR_MODEL_API_UNSUPPORTED.format(
            method="GET", url=_models_url(server_url), status=resp.status_code))
    if resp.status_code != 200:
        raise RuntimeError(_ERR_HTTP.format(status=resp.status_code, body=resp.text[:500]))
    try:
        return resp.json().get("data") or []
    except ValueError as exc:
        raise RuntimeError(_ERR_PARSE.format(detail=exc)) from exc


def model_loaded(server_url: str, api_key: str, timeout: int = DEFAULT_TIMEOUT) -> bool:
    """Return True if the server currently has at least one model loaded."""
    return bool(_models_list(server_url, api_key, timeout))


def _model_present(server_url: str, api_key: str, model_name: str, timeout: int) -> bool:
    """Return True if a model matching model_name is loaded and ready.

    Matches by `id` or any `aliases` entry. In router mode the model stays
    in the list after unload with `status.value` = "unloaded"; "loaded" and
    "sleeping" count as present, while "unloaded"/"loading"/"downloading"
    do not. Single-model mode has no status field: presence means loaded.
    """
    for item in _models_list(server_url, api_key, timeout):
        if str(item.get("id", "")) != model_name and model_name not in (item.get("aliases") or []):
            continue
        status = (item.get("status") or {}).get("value", "")
        if not status:
            return True  # single-model mode: presence == loaded
        return status in ("loaded", "sleeping")
    return False


def _wait_for_model(
    server_url: str,
    api_key: str,
    want_loaded: bool,
    model_name: str = "",
    timeout: int = _LOAD_TIMEOUT,
    poll_interval: float = 1.0,
) -> None:
    """Poll GET /v1/models until the named model reaches the wanted state.

    POST /models/load and /models/unload are async: the server returns
    before the (un)load actually finishes. This waits until the named
    model is present (load) or absent (unload), or raises a classified
    timeout error. Checking by name matters in router mode, where other
    models may stay loaded while this one unloads.
    """
    deadline = time.monotonic() + float(timeout)
    present = None
    while time.monotonic() < deadline:
        present = _model_present(server_url, api_key, model_name, _POLL_GET_TIMEOUT)
        if present == want_loaded:
            return
        time.sleep(poll_interval)
    if want_loaded:
        raise RuntimeError(_ERR_LOAD_TIMEOUT.format(timeout=timeout))
    raise RuntimeError(_ERR_UNLOAD_TIMEOUT.format(timeout=timeout))


def load_model(
    server_url: str,
    api_key: str,
    model_name: str,
    timeout: int = _LOAD_TIMEOUT,
) -> None:
    """Hot-load a model via POST /models/load (router mode).

    `model_name` is the router's model id: GGUF file name, HF repo name,
    or --alias. Generous timeout (loading is slow).
    """
    url = _models_mgmt_url(server_url, "load")
    try:
        resp = requests.post(
            url,
            json={"model": model_name},
            headers=_auth_headers(api_key),
            timeout=_resolve_timeout(timeout),
            proxies=_NO_PROXY,
        )
    except requests.exceptions.Timeout as exc:
        raise RuntimeError(_ERR_LOAD_TIMEOUT.format(timeout=timeout)) from exc
    except requests.exceptions.RequestException as exc:
        raise RuntimeError(_ERR_CONNECTION.format(url=url)) from exc
    if resp.status_code == 404:
        raise RuntimeError(_ERR_LOAD_UNSUPPORTED)
    if resp.status_code != 200:
        raise RuntimeError(_ERR_LOAD.format(
            detail=f"HTTP {resp.status_code}: {resp.text[:500]}"))


def unload_model(
    server_url: str,
    api_key: str,
    model_name: str = "",
    timeout: int = _LOAD_TIMEOUT,
) -> None:
    """Unload a model via POST /models/unload (router mode; frees VRAM/RAM).

    `model_name` is the router's model id (same as used to load it). The
    call is async, so after it succeeds we poll until GET /v1/models
    reports the named model is no longer loaded — only then is the VRAM
    actually released.
    """
    if not model_name or not model_name.strip():
        raise RuntimeError(_ERR_UNLOAD_NO_MODEL)
    url = _models_mgmt_url(server_url, "unload")
    try:
        resp = requests.post(
            url,
            json={"model": model_name.strip()},
            headers=_auth_headers(api_key),
            timeout=_resolve_timeout(timeout),
            proxies=_NO_PROXY,
        )
    except requests.exceptions.Timeout as exc:
        raise RuntimeError(_ERR_UNLOAD_TIMEOUT.format(timeout=timeout)) from exc
    except requests.exceptions.RequestException as exc:
        raise RuntimeError(_ERR_CONNECTION.format(url=url)) from exc
    if resp.status_code == 404:
        raise RuntimeError(_ERR_UNLOAD_UNSUPPORTED)
    if resp.status_code not in (200, 204):
        raise RuntimeError(_ERR_UNLOAD.format(
            detail=f"HTTP {resp.status_code}: {resp.text[:500]}"))
    _wait_for_model(
        server_url, api_key, want_loaded=False,
        model_name=model_name.strip(), timeout=timeout)


def _resolve_timeout(timeout: int) -> float | None:
    """timeout <= 0 means wait forever; requests needs None for that."""
    return None if int(timeout) <= 0 else float(timeout)
