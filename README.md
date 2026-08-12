# GC_Tool

ComfyUI 自定义节点包，包含两个节点：

| 节点 | 分类 | 功能 |
|---|---|---|
| **llama_mini** | `GC_Tool/llama_mini` | 视觉/文本多模态 LLM 节点：接入 llama.cpp server，多图综合反推、纯文本生成 |
| **卸载模型** | `GC_Tool` | 通过 ComfyUI 的 `POST /free` 卸载指定机器（本机/远程）的模型并清缓存 |

## 安装

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/timwuyue/gc_tool.git GC_Tool
```

重启 ComfyUI 即可。依赖仅 `requests` + `pillow` + `numpy`（ComfyUI 自带，无需额外安装）。

## llama_mini 节点

连接自建的 [llama.cpp](https://github.com/ggml-org/llama.cpp) server（OpenAI 兼容 API）：

- **有图** = 多图直接一请求（指令前置、每图一条消息，模型直接看原图）；**无图** = 纯文本
- **配置**：ComfyUI 设置面板（齿轮）→ `Other → llama_mini`：server 地址、模型名、token 上限、采样参数、缩放、日志开关等
- **面板开关**：`seed`（采样种子）、`unload_before`（执行前通过 `POST /free` 卸载指定 ComfyUI 的模型，防爆显存）、`unload_after`（执行后卸载 llama server 模型，需 router 模式）
- **建议**：llama.cpp server 用 router 模式启动（不带 `-m`，`--models-dir` 加载），支持模型热加载/卸载

## 卸载模型节点

参数 `unload_models`（卸载模型）+ `clear_cache`（清缓存），等价于 ComfyUI 菜单"编辑 → 卸载模型 / 卸载模型和执行缓存"。带 `*` 透传输入/输出，可插在 workflow 任意位置。

## 说明

- 节点默认配置针对 `Qwen3.5-9B-Uncensored-HauhauCS-Aggressive-Q8_0` 多模态模型，可通过设置面板修改
- 详细用法见 `GC_Tool/llama_mini/README.md`
