// llama_multi settings — registered into the ComfyUI Settings panel.
// Values are persisted by the frontend into user/comfy.settings.json and
// read by the backend (nodes.py _read_config) at execution time.
//
// IMPORTANT:
// 1. category's LAST segment must be unique per setting — the frontend
//    builds the settings tree with buildTree(), where each category level
//    is a tree node and the final level is the leaf (the setting item
//    itself). Settings sharing an identical category array collapse into
//    one node and only the last one is shown.
// 2. Without sortOrder, settings are sorted alphabetically by label in the
//    panel. sortOrder (higher first) restores the registration order.
const { app } = window.comfyAPI.app;

const CATEGORY = "llama_mini";

app.registerExtension({
	name: "llama_mini.Settings",
	settings: [
		{ id: "llama_mini.debug_log", name: "Debug Log", category: [CATEGORY, "Debug Log"], sortOrder: 110, type: "boolean", defaultValue: false, tooltip: "在 ComfyUI 控制台打印每次执行的配置与结果日志" },
		{ id: "llama_mini.local_server_url", name: "Local Server URL", category: [CATEGORY, "Local Server URL"], sortOrder: 105, type: "string", defaultValue: "http://127.0.0.1:8188", tooltip: "本机地址（默认 ComfyUI）。unload_before 开启时，若 llama 的 server_url 与本机地址同一主机则卸载本机 ComfyUI 模型，否则跳过" },
		{ id: "llama_mini.server_url", name: "Server URL", category: [CATEGORY, "Server URL"], sortOrder: 100, type: "string", defaultValue: "http://127.0.0.1:8080", tooltip: "llama-server 地址" },
		{ id: "llama_mini.api_key", name: "API Key", category: [CATEGORY, "API Key"], sortOrder: 90, type: "string", defaultValue: "", tooltip: "Bearer 鉴权密钥（留空 = 无鉴权）" },
		{ id: "llama_mini.model", name: "Model Name", category: [CATEGORY, "Model Name"], sortOrder: 80, type: "string", defaultValue: "Qwen3.5-9B-Uncensored-HauhauCS-Aggressive-Q8_0", tooltip: "请求体 model 字段（router 路由用）" },
		{ id: "llama_mini.model_path", name: "Model Path", category: [CATEGORY, "Model Path"], sortOrder: 70, type: "string", defaultValue: "Qwen3.5-9B-Uncensored-HauhauCS-Aggressive-Q8_0", tooltip: "模型名（自动加载/卸载用）" },
		{ id: "llama_mini.max_tokens", name: "Max Tokens", category: [CATEGORY, "Max Tokens"], sortOrder: 60, type: "number", defaultValue: 32768, tooltip: "最大生成 token 数" },
		{ id: "llama_mini.temperature", name: "Temperature", category: [CATEGORY, "Temperature"], sortOrder: 50, type: "number", defaultValue: 0.7, tooltip: "采样温度" },
		{ id: "llama_mini.top_p", name: "Top P", category: [CATEGORY, "Top P"], sortOrder: 40, type: "number", defaultValue: 1.0, tooltip: "nucleus 采样" },
		{ id: "llama_mini.timeout", name: "Timeout (s)", category: [CATEGORY, "Timeout (s)"], sortOrder: 20, type: "number", defaultValue: 60, tooltip: "请求超时秒数；0 = 无限等待" },
		{ id: "llama_mini.max_side", name: "Max Image Side", category: [CATEGORY, "Max Image Side"], sortOrder: 10, type: "number", defaultValue: 256, tooltip: "图片缩放最长边；0 = 不缩放" },
	],
});
