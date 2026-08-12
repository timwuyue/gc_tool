# llama_mini

基于 `llama-server` 节点精简的单节点包：视觉 + 纯文本合并为**一个节点**，默认配置针对 Qwen3.5-9B-Uncensored 多模态模型。

## 特性

- **一个节点两种模式**：有图 = 视觉（直接多图一请求，指令前置）；无图 = 纯文本
- **多图固定为 combine + multi_turn 模式**（指令前置、每图一条 user 消息、模型直接看原图），无需开关
- 无 `text` 输入端口、无 `combine`/`multi_turn`/`separator`/`stage1_prompt` 参数（精简）

## 输入端口

| 端口 | 类型 | 说明 |
|---|---|---|
| `prompt` *(上)* | STRING（forceInput） | 实际指令；面板无输入框，必须连线 |
| `system` *(下)* | STRING（forceInput） | 系统提示词（可选）；面板无输入框，必须连线 |
| `images` | IMAGE（可选） | 不连 = 纯文本模式 |

> `forceInput` 端口不显示输入框，只能连线（可用 `PrimitiveString` 节点或上游 LLM 输出接入）。

## 面板开关

| 开关 | 默认 | 说明 |
|---|---|---|
| `seed` | -1 | 采样种子；-1 = 随机 |
| `unload_before` | false | 执行前**进程内**卸载本机 ComfyUI 已加载的模型并清缓存（llama_mini 所在进程，任何工作流位置都生效） |
| `unload_before_remote` | false | 执行前额外 `POST /free` 到 `Local Server URL` 指定的**远程** ComfyUI（填了远程地址才用） |

设置面板：**`Local Server URL`**（默认 `http://127.0.0.1:8188`）——`unload_before` 的卸载目标 ComfyUI 地址（本机或远程都行，通过 HTTP `POST /free` 卸载该机器上的模型）。
| `unload_after` | false | 执行后立即卸载 llama server 模型（router 模式支持） |

## 配置（ComfyUI 设置面板）

所有可配置项注册在 **ComfyUI 设置（齿轮图标 → 搜索/展开 `llama_mini` 分类）**，前端持久化到 `user/<用户>/comfy.settings.json`，后端每次执行时读取（改完立即生效，无需重启）：

| 设置项 | 默认 | 说明 |
|---|---|---|
| `server_url` | `http://127.0.0.1:8080` | server 地址 |
| `api_key` | 空 | Bearer 鉴权 |
| `model` | `Qwen3.5-9B-Uncensored-HauhauCS-Aggressive-Q8_0` | 请求体 model 字段（router 路由用） |
| `model_path` | `Qwen3.5-9B-Uncensored-HauhauCS-Aggressive-Q8_0` | 模型名（自动加载/卸载用） |
| `max_tokens` | 32768 | 最大生成 token |
| `temperature` | 0.7 | 采样温度 |
| `top_p` | 1.0 | nucleus 采样 |
| `seed` | -1 | -1 = 随机 |
| `timeout` | 60 | 请求超时秒；0 = 无限 |
| `max_side` | 256 | 图片缩放最长边（0 = 不缩放） |

> 实现方式与 [ComfyUI-KJNodes](https://github.com/kijai/ComfyUI-KJNodes) 相同：`web/js/settings.js` 用 `app.registerExtension({ settings })` 注册到设置面板（`WEB_DIRECTORY = "./web"`），后端读 `comfy.settings.json`。自定义设置统一收在设置面板侧边栏的 **"Other" → `llama_mini`** 分组下（也可直接搜索 "llama_mini"）。文件缺失/损坏或设置未保存时回退默认值；节点面板只显示 `unload_after` 开关，保持最小。

## 安装

把仓库（含 `llama_mini` 子目录）clone 到 ComfyUI 的 `custom_nodes/` 下，重启 ComfyUI。依赖仅 `requests` + `pillow` + `numpy`（ComfyUI 自带）。

## 行为

- **有图**：一次请求带全部图，指令前置（"这里一共有 N 张图片…"+ 你的 `prompt`），每图一条 user 消息，模型直接看原图（`multi_turn` 消息结构）
- **无图**：纯文本请求（`prompt` 直接作为指令）
- **`model_path`** 非空：执行前自动确保模型已加载（未加载则 `POST /models/load`）
- **`unload_after`** 开：执行后 `POST /models/unload` 卸载模型（需 router 模式 server）

## 开发

```bash
cd llama_mini && python -m unittest discover -s tests
```
