# gc_tool: DSH bridge backend.
# Proxies chat between the ComfyUI page and the DSH harness (the real agent,
# "the full-body me") at http://127.0.0.1:3080. Loopback /api RPC + websocket
# proxy for realtime streaming, question cards and permission approvals.
# Imported from gc_tool/__init__.py (routes register on PromptServer).
import asyncio
import json
import logging
import uuid
import urllib.request

from aiohttp import web
from server import PromptServer

_log = logging.getLogger("gc_tool.dsh_bridge")

DSH_BASE = "http://127.0.0.1:3080"
DEFAULT_CWD = r"E:\ComfyTV"

routes = PromptServer.instance.routes


def _rpc(method, payload, timeout=30):
    body = json.dumps({
        "type": "client-request",
        "rpcId": str(uuid.uuid4()),
        "method": method,
        "payload": payload,
    }).encode("utf-8")
    req = urllib.request.Request(
        f"{DSH_BASE}/api/{method}", data=body,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _pick_session():
    """Prefer the running main session (the GUI one); else the latest; else None."""
    try:
        r = _rpc("session.list", {})
    except Exception:
        return None
    items = (r.get("result") or {}).get("value", {}).get("items", [])
    if not items:
        return None
    for s in items:
        if s.get("running") and s.get("origin") != "subagent":
            return s
    for s in items:
        if s.get("origin") != "subagent":
            return s
    return items[0]


def _ensure_session():
    s = _pick_session()
    if s is not None:
        return s["sessionId"]
    r = _rpc("session.create", {"cwd": DEFAULT_CWD})
    return r["result"]["value"]["sessionId"]


@routes.get("/dsh/state")
async def dsh_state(_request):
    try:
        s = await asyncio.to_thread(_pick_session)
        return web.json_response({"ok": True, "session": s})
    except Exception as e:
        _log.exception("dsh/state failed")
        return web.json_response({"ok": False, "error": str(e)})


@routes.post("/dsh/chat")
async def dsh_chat(request):
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"ok": False, "error": "invalid json"}, status=400)
    text = str(body.get("text") or "").strip()
    if not text:
        return web.json_response({"ok": False, "error": "text required"}, status=400)
    try:
        sid = await asyncio.to_thread(_ensure_session)
        r = await asyncio.to_thread(
            _rpc, "session.prompt",
            {"sessionId": sid, "mode": "queue",
             "content": [{"type": "text", "text": text}]})
        result = r.get("result") or {}
        if not result.get("ok"):
            err = result.get("error") or {}
            return web.json_response(
                {"ok": False, "error": err.get("message") or "prompt failed"})
        return web.json_response({"ok": True, "sessionId": sid})
    except Exception as e:
        _log.exception("dsh/chat failed")
        return web.json_response({"ok": False, "error": str(e)})


@routes.get("/dsh/events")
async def dsh_events(request):
    sid = request.query.get("sessionId", "")
    if not sid:
        return web.json_response({"ok": False, "error": "sessionId required"})
    try:
        since = int(request.query.get("sinceSeq", "-1"))
    except ValueError:
        since = -1
    try:
        r = await asyncio.to_thread(
            _rpc, "session.history", {"sessionId": sid, "maxMessages": 4})
        evs = (r.get("result") or {}).get("value", {}).get("events", [])
        out = []
        last = since
        for e in evs:
            ev = e.get("event") or {}
            seq = ev.get("seq") or 0
            if seq > since:
                out.append(ev)
                last = max(last, seq)
        return web.json_response({"ok": True, "events": out, "lastSeq": last})
    except Exception as e:
        _log.exception("dsh/events failed")
        return web.json_response({"ok": False, "error": str(e)})


@routes.post("/dsh/stop")
async def dsh_stop(request):
    try:
        body = await request.json()
    except Exception:
        body = {}
    sid = body.get("sessionId", "")
    if not sid:
        return web.json_response({"ok": False, "error": "sessionId required"})
    try:
        await asyncio.to_thread(_rpc, "session.cancel", {"sessionId": sid})
        return web.json_response({"ok": True})
    except Exception as e:
        _log.exception("dsh/stop failed")
        return web.json_response({"ok": False, "error": str(e)})


@routes.post("/dsh/respond")
async def dsh_respond(request):
    """Forward a client-response (user's answer to an agent question/approval)
    to the DSH harness POST /api/respond (the frame's rpcId is echoed back)."""
    import aiohttp
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"ok": False, "error": "invalid json"}, status=400)
    if body.get("type") != "client-response" or not body.get("rpcId"):
        return web.json_response({"ok": False, "error": "client-response with rpcId required"}, status=400)
    try:
        timeout = aiohttp.ClientTimeout(total=15)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(
                f"{DSH_BASE}/api/respond",
                json=body,
                headers={"Content-Type": "application/json"},
            ) as resp:
                data = await resp.json()
        return web.json_response({"ok": True, "receipt": data})
    except Exception as e:
        _log.exception("dsh/respond failed")
        return web.json_response({"ok": False, "error": str(e)})


@routes.get("/dsh/view")
async def dsh_view(request):
    """Serve a local file (images etc.) to the browser so agent-mentioned
    paths are clickable/openable. Whitelisted to the workspace + ComfyUI dirs."""
    import mimetypes
    from pathlib import Path

    path = request.query.get("path", "")
    if not path:
        return web.json_response({"ok": False, "error": "path required"}, status=400)
    p = Path(path)
    try:
        resolved = p.resolve()
    except OSError:
        return web.json_response({"ok": False, "error": "bad path"}, status=400)
    allowed = []
    for root in (r"E:\ComfyTV",
                 r"E:\ComfyUI_windows_portable\ComfyUI\output",
                 r"E:\ComfyUI_windows_portable\ComfyUI\input",
                 r"E:\ComfyUI_windows_portable\ComfyUI\user"):
        rp = Path(root)
        if rp.exists():
            allowed.append(str(rp.resolve()))
    if not any(str(resolved).startswith(r) for r in allowed):
        return web.json_response({"ok": False, "error": "path not allowed"}, status=403)
    if not p.is_file():
        return web.json_response({"ok": False, "error": "not found"}, status=404)
    ctype = mimetypes.guess_type(str(p))[0] or "application/octet-stream"
    return web.FileResponse(p, headers={"Content-Type": ctype,
                                        "Cache-Control": "no-cache"})


@routes.get("/dsh/ws")
async def dsh_ws(request):
    """WebSocket proxy: browser <-> DSH /api/events.mux (realtime session
    events, question cards, permission approvals)."""
    import aiohttp as aio
    ws = web.WebSocketResponse(heartbeat=30)
    await ws.prepare(request)
    try:
        async with aio.ClientSession() as session:
            try:
                dsh_ws = await session.ws_connect(f"{DSH_BASE}/api/events.mux")
            except Exception as e:
                await ws.send_str('{"type":"proxy-error","error":"' + str(e) + '"}')
                return ws

            async def pump():
                try:
                    async for msg in dsh_ws:
                        if msg.type == aio.WSMsgType.TEXT:
                            try:
                                await ws.send_str(msg.data)
                            except Exception:
                                break
                        elif msg.type in (aio.WSMsgType.CLOSE, aio.WSMsgType.ERROR, aio.WSMsgType.CLOSED):
                            break
                except Exception:
                    pass

            pump_task = asyncio.create_task(pump())
            try:
                async for msg in ws:
                    if msg.type == aio.WSMsgType.ERROR:
                        break
                    # mux is a downlink; upstream stays on HTTP (/dsh/respond)
            finally:
                pump_task.cancel()
                try:
                    await dsh_ws.close()
                except Exception:
                    pass
    except Exception as e:
        _log.exception("dsh/ws failed")
    return ws
