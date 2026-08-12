# GC_Tool

ComfyUI 自定义节点包，包含两个节点：

| 节点 | 分类 | 功能 |
|---|---|---|
| **llama_mini** | `GC_Tool/llama_mini` | 视觉/文本多模态 LLM 节点：接入 llama.cpp server，多图综合反推、纯文本生成 |
| **unload_clear** | `GC_Tool` | 通过 ComfyUI 的 `POST /free` 卸载指定机器（本机/远程）的模型并清缓存 |

## 安装

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/timwuyue/gc_tool.git
```

重启 ComfyUI 即可（clone 后的 `gc_tool` 目录本身就是节点包）。依赖仅 `requests` + `pillow` + `numpy`（ComfyUI 自带，无需额外安装）。

## llama_mini 节点

连接自建的 [llama.cpp](https://github.com/ggml-org/llama.cpp) server（OpenAI 兼容 API）：

- **有图** = 多图直接一请求（指令前置、每图一条消息，模型直接看原图）；**无图** = 纯文本
- **配置**：ComfyUI 设置面板（齿轮）→ `Other → llama_mini`：server 地址、模型名、token 上限、采样参数、缩放、日志开关等
- **面板开关**：`seed`（采样种子）、`unload_before`（执行前通过 `POST /free` 卸载指定 ComfyUI 的模型，防爆显存）、`unload_after`（执行后卸载 llama server 模型，需 router 模式）
- **建议**：llama.cpp server 用 router 模式启动（不带 `-m`，`--models-dir` 加载），支持模型热加载/卸载

## llama.cpp server 启动命令参考

### 单模型模式（最简单，视觉/文本均可用）

```bash
llama-server -m /path/to/Qwen3.5-9B-Uncensored-HauhauCS-Aggressive-Q8_0.gguf \
             --mmproj /path/to/mmproj-Qwen3.5-9B-Uncensored-HauhauCS-Aggressive-BF16.gguf \
             -c 128000 -ngl -1 --host 0.0.0.0 --port 8080
```

### Router 模式（推荐，支持热加载/卸载）

不带 `-m` 启动，用 `--models-dir` 指向模型目录。**多模态模型的主模型 + mmproj 必须放在同一子目录**（子目录名即模型名），router 才会自动配对视觉能力：

```bash
llama-server --models-dir ./models -c 128000 -ngl -1 --host 0.0.0.0 --port 8080
```

模型目录结构：

```
models/
└── Qwen3.5-9B-Uncensored-HauhauCS-Aggressive-Q8_0/
    ├── Qwen3.5-9B-Uncensored-HauhauCS-Aggressive-Q8_0.gguf
    └── mmproj-Qwen3.5-9B-Uncensored-HauhauCS-Aggressive-BF16.gguf
```

Router 模式下模型按需自动加载；llama_mini 的 `unload_after`（`POST /models/unload` 卸载）和 `model_path`（自动重新加载）依赖此模式。

### 常用参数说明

| 参数 | 说明 |
|---|---|
| `-c N` | 上下文长度（如 `128000`） |
| `-ngl N` | GPU 层数；`-1` = 全部层上 GPU，`0` = 纯 CPU |
| `--host 0.0.0.0` | 监听所有网卡（远程访问需要） |
| `--port N` | 端口（llama_mini 设置的 `server_url` 需对应） |
| `--reasoning off` | 关闭思考模式（Qwen3 系列模型） |
| `--api-key xxx` | 开启鉴权（llama_mini 设置的 `api_key` 对应） |
| `--sleep-idle-seconds N` | 空闲 N 秒自动卸载模型（单模型模式也可用；全自动，但下次请求需等待重新加载） |

Windows 下可执行文件为 `llama-server.exe`，`--models-dir` 用绝对路径（如 `D:\ComfyUI\models\LLM\router-models`）。

## unload_clear 节点

参数 `unload_models`（卸载模型）+ `clear_cache`（清缓存），等价于 ComfyUI 菜单"编辑 → 卸载模型 / 卸载模型和执行缓存"。带 `*` 透传输入/输出，可插在 workflow 任意位置。

## 说明

- 节点默认配置针对 `Qwen3.5-9B-Uncensored-HauhauCS-Aggressive-Q8_0` 多模态模型，可通过设置面板修改
- 详细用法见 `llama_mini/README.md`
