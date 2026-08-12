# HTTP 调用放线程池、batch 顺序执行、非流式

ComfyUI 节点同步执行，直接阻塞发请求会冻结整个 UI 队列。因此 HTTP 调用丢进线程池，节点主逻辑轮询结果。batch 逐张时顺序请求（一张完成再发下一张），不并发——llama.cpp server 默认串行处理，并发只会排队或 OOM。请求为非流式（`stream: false`），v1 不做 SSE。流式与并发留作后续增强。
