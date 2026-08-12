# ComfyUI-LlamaCpp-Vision

让 ComfyUI workflow 直接使用本机 llama.cpp server 的视觉/文本模型能力的自定义节点包。节点负责把 ComfyUI 的 IMAGE 张量与文本指令转成 OpenAI 兼容请求并取回文本结果。

## Language

**反推（Captioning）**:
用视觉模型从一张或多张图片生成文本描述或标签列表，供 workflow 下游消费。
_Avoid_: 提示词生成、描述扩展

**LlamaVisionCaption**:
本项目提供的节点，输入可选多张图片 + 文本指令，输出反推文本。

**LlamaTextLLM**:
本项目提供的节点，仅输入文本，输出模型生成的文本。

**batch 逐张（batch）**:
多张图片时，每张图独立发起一次请求，结果一一对应，用 separator 合并为多行输出。节点的默认多图语义。
_Avoid_: 批量合并

**combine 综合（combine）**:
多图综合描述开关。两种实现：`multi_turn` 关（默认）= 两阶段（逐张反推 + 文本层综合，不依赖模型多图能力，稳定）；`multi_turn` 开 = 直接一请求多图（指令前置、每图一条消息，模型直接看原图，实验性，依赖模型多图能力）。

**server**:
用户自行启动并持续运行的 llama.cpp 服务器进程，节点只通过 HTTP 与之通信，不负责启动、加载或管理该进程。

**unload_after（完成后卸载）**:
节点开关。开启后节点执行完毕立即调用 `POST /models/unload` 卸载模型，释放显存/内存，供后续生图等任务使用。仅 router 模式（不带 `-m` 启动）支持；单模型模式无此端点，需用 `--sleep-idle-seconds`。与 model_path 配套实现"用完即卸、用时再载"。

**model_path**:
router 模式下的模型名（GGUF 文件名/HF repo 名/`--alias`）。非空时节点在执行前检查模型是否已加载（`GET /v1/models`），未加载则自动加载（`POST /models/load`），用于卸载后的自动重新加载。为空则不检查不加载。

**prompt**:
发送给模型的 user 消息，决定模型做什么（如"反推这张图"）。两个节点均有多行 widget 默认值，可被可选输入端口覆盖。

**system_prompt**:
发送给模型的 system 角色消息，设定模型行为。两个节点形态对称，均有此字段。

**data URI**:
图片以 base64 内嵌在请求体 `image_url.url` 中的表示方式，全程内存流转，不落盘。默认 JPEG（quality 85）编码，体积约为 PNG 的 1/10。

**max_side**:
视觉节点的可选缩放参数。>0 时发送前把每张图缩到最长边 ≤ 该值（保持纵横比），用于减少多图 combine 的视觉 token、稳定模型对多图的感知。0 = 不缩放。

**separator**:
batch 模式下合并多条结果的字符串，默认换行符。

## 示例对话

> 开发: 我有一批图要反推，能一次塞进去吗？
> 领域专家: 可以，默认 batch 模式——每张图独立出结果，用 separator 拼成多行。
> 开发: 那我想让模型同时看三张参考图总结共同特征呢？
> 领域专家: 打开 combine 开关，三张图进同一条请求，输出一条综合描述。但你的模型得支持多图。
> 开发: 服务器是我自己起的 llama-server，节点只负责发请求？
> 领域专家: 对。server 是你的，节点只是它的一个 HTTP 客户端。
> 开发: 指令怎么给？
> 领域专家: system_prompt 设定行为，prompt 是实际指令，都是多行 widget，也都能从上游节点接进来覆盖。
