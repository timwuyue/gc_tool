# 节点只连接已运行的 llama.cpp server，不负责进程管理

用户自行启动并持续运行 llama-server，节点仅作为 HTTP 客户端连接它。不实现子进程拉起、模型加载状态机或 server 生命周期管理。原因是进程管理会把模型路径、参数、日志、崩溃恢复等一整套复杂度吸进节点，且与"本地已有一个 server 在跑"的主流用法冲突。

边界补充（2025-08）：节点仍不管理 server 进程，但在用户**显式**提供 `model_path` widget 时会调用 `POST /models/load` 自动加载模型、开启 `unload_after` 时会调用 `POST /models/unload` 卸载模型（两者均为 llama.cpp router 模式端点，单模型模式 `-m` 启动没有这些端点）。这是"用完即卸、用时再载"的显式开关，由用户逐节点控制；节点不维护加载状态机，模型是否加载由 server 自身状态决定。
