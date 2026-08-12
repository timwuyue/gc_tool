"""Unit tests for the LlamaMini node. HTTP layer is mocked; no server needed."""

import os
import unittest
from unittest import mock

import numpy as np

import llama_client
from llama_client import build_messages_multi_turn
import nodes
from nodes import LlamaMini, MODEL_NAME


class FakeTensor:
    """Minimal stand-in for a ComfyUI IMAGE tensor (H,W,C float32 0-1)."""

    def __init__(self, arr):
        self._arr = arr

    def detach(self):
        return self

    def cpu(self):
        return self

    def numpy(self):
        return self._arr

    def dim(self):
        return self._arr.ndim

    def __iter__(self):
        return (FakeTensor(self._arr[i]) for i in range(self._arr.shape[0]))


def fake_tensor(shape):
    arr = (np.random.rand(*shape).astype(np.float32) * 255.0) / 255.0
    return FakeTensor(arr)


def fake_image(h=64, w=64, batch=1):
    if batch > 1:
        return fake_tensor((batch, h, w, 3))
    return fake_tensor((h, w, 3))


class TestLlamaMini(unittest.TestCase):
    def test_no_images_is_text_mode(self):
        node = LlamaMini()
        with mock.patch("nodes.chat_completion", return_value="text out") as cc, \
             mock.patch("nodes._model_present", return_value=True):
            (result,) = node.generate(images=None, prompt="hello", system="sys")
        self.assertEqual(result, "text out")
        self.assertEqual(cc.call_args.kwargs["image_data_uris"], [])
        self.assertFalse(cc.call_args.kwargs["multi_turn"])
        self.assertEqual(cc.call_args.kwargs["system_prompt"], "sys")
        self.assertEqual(cc.call_args.kwargs["prompt"], "hello")

    def test_images_use_direct_multi_image_mode(self):
        node = LlamaMini()
        images = fake_image(batch=3)
        with mock.patch("nodes.chat_completion", return_value="综合") as cc, \
             mock.patch("nodes._model_present", return_value=True):
            (result,) = node.generate(images=images, prompt="综合指令")
        self.assertEqual(result, "综合")
        self.assertEqual(cc.call_count, 1)  # one request, all images together
        self.assertEqual(len(cc.call_args.kwargs["image_data_uris"]), 3)
        self.assertTrue(cc.call_args.kwargs["multi_turn"])

    def test_multi_turn_message_structure(self):
        msgs = build_messages_multi_turn("sys", "综合描述", ["u1", "u2"])
        self.assertIn("2 张图片", msgs[1]["content"])  # instruction front-loaded
        self.assertEqual(msgs[2]["content"][0]["image_url"]["url"], "u1")

    def test_max_side_fixed_256(self):
        node = LlamaMini()
        images = fake_image(batch=2)
        with mock.patch("nodes.chat_completion", return_value="x") as cc, \
             mock.patch("nodes._model_present", return_value=True), \
             mock.patch("nodes.resize_to_max_side", wraps=lambda img, m: img) as resize:
            node.generate(images=images)
        self.assertEqual(resize.call_count, 2)
        for call in resize.call_args_list:
            self.assertEqual(call.args[1], 256)

    def test_model_fixed_defaults(self):
        node = LlamaMini()
        with mock.patch("nodes.chat_completion", return_value="x") as cc, \
             mock.patch("nodes._model_present", return_value=True):
            node.generate(images=None)
        kwargs = cc.call_args.kwargs
        self.assertEqual(kwargs["model"], MODEL_NAME)
        self.assertEqual(kwargs["max_tokens"], 32768)
        self.assertEqual(kwargs["api_key"], "")

    def test_config_override_from_file(self):
        # Values from the user's comfy.settings.json override defaults;
        # missing keys fall back.
        import tempfile
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as tf:
            tf.write('{"llama_mini.max_tokens": 1000, "llama_mini.temperature": 0.3,'
                     ' "llama_mini.server_url": "http://example.com:9999"}')
            path = tf.name
        try:
            cfg = nodes._read_config(path)
            self.assertEqual(cfg["max_tokens"], 1000)
            self.assertEqual(cfg["temperature"], 0.3)
            self.assertEqual(cfg["server_url"], "http://example.com:9999")
            self.assertEqual(cfg["top_p"], 1.0)  # fallback default
            self.assertFalse(cfg["debug_log"])  # log switch off by default
            self.assertEqual(cfg["max_side"], 256)
        finally:
            import os as _os
            _os.unlink(path)

    def test_user_settings_candidates_uses_get_user_directory(self):
        # The candidate path must come from folder_paths.get_user_directory()
        # (args.user_directory is None by default and cannot be used).
        class FakeFolderPaths:
            @staticmethod
            def get_user_directory():
                return "C:/ComfyUI/user"

        with mock.patch.dict("sys.modules", {"folder_paths": FakeFolderPaths}):
            candidates = nodes._user_settings_candidates()
        self.assertEqual(candidates[0], os.path.join("C:/ComfyUI/user", "default", "comfy.settings.json"))

    def test_seed_widget_passed_to_request(self):
        node = LlamaMini()
        with mock.patch("nodes.chat_completion", return_value="x") as cc, \
             mock.patch("nodes._model_present", return_value=True):
            node.generate(images=None, seed=42)
        self.assertEqual(cc.call_args.kwargs["seed"], 42)

    def test_unload_before_triggers_comfy_unload(self):
        node = LlamaMini()
        with mock.patch("nodes.chat_completion", return_value="x"), \
             mock.patch("nodes._model_present", return_value=True), \
             mock.patch("nodes._unload_comfy_models") as unload:
            node.generate(images=None, unload_before=True)
        unload.assert_called_once()










    def test_unload_before_calls_free_on_local_server_url(self):
        # unload_before frees the ComfyUI at whatever Local Server URL is set to.
        node = LlamaMini()
        cfg = nodes._read_config()
        cfg["local_server_url"] = "http://49.233.182.221:8188"
        with mock.patch("nodes.chat_completion", return_value="x"),              mock.patch("nodes._model_present", return_value=True),              mock.patch("nodes._read_config", return_value=cfg),              mock.patch("nodes._unload_comfy_models") as unload:
            node.generate(images=None, unload_before=True)
        unload.assert_called_once()
        self.assertEqual(unload.call_args.args[0], "http://49.233.182.221:8188")

    def test_unload_comfy_models_posts_free(self):
        with mock.patch("nodes.requests.post") as post:
            post.return_value.status_code = 200
            nodes._unload_comfy_models("http://49.233.182.221:8188")
        url, kwargs = post.call_args
        self.assertEqual(url[0], "http://49.233.182.221:8188/free")
        self.assertEqual(kwargs["json"], {"unload_models": True, "free_memory": True})

    def test_unload_comfy_models_logs_failure(self):
        with mock.patch("nodes.requests.post", side_effect=Exception("conn refused")):
            nodes._unload_comfy_models("http://127.0.0.1:8188")  # must not raise

    def test_unload_before_off_skips_comfy_unload(self):
        node = LlamaMini()
        with mock.patch("nodes.chat_completion", return_value="x"), \
             mock.patch("nodes._model_present", return_value=True), \
             mock.patch("nodes._unload_comfy_models") as unload:
            node.generate(images=None, unload_before=False)
        unload.assert_not_called()


    def test_config_corrupt_file_falls_back(self):
        import tempfile
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as tf:
            tf.write("not json {{{{")
            path = tf.name
        try:
            cfg = nodes._read_config(path)
            self.assertEqual(cfg["max_tokens"], 32768)  # all defaults
            self.assertEqual(cfg["model"], MODEL_NAME)
        finally:
            import os as _os
            _os.unlink(path)

    def test_settings_values_used_in_request(self):
        node = LlamaMini()
        cfg = {"server_url": "http://s:1", "api_key": "k", "model": "m", "model_path": "m",
               "max_tokens": 1234, "temperature": 0.5, "top_p": 0.9,
               "timeout": 30, "max_side": 0}
        with mock.patch("nodes.chat_completion", return_value="x") as cc, \
             mock.patch("nodes._read_config", return_value=cfg), \
             mock.patch("nodes._ensure_model_loaded", return_value=None):
            node.generate(images=None)
        kwargs = cc.call_args.kwargs
        self.assertEqual(kwargs["server_url"], "http://s:1")
        self.assertEqual(kwargs["api_key"], "k")
        self.assertEqual(kwargs["model"], "m")
        self.assertEqual(kwargs["max_tokens"], 1234)
        self.assertEqual(kwargs["temperature"], 0.5)

    def test_unload_after_triggers_unload(self):
        node = LlamaMini()
        with mock.patch("nodes.chat_completion", return_value="x"), \
             mock.patch("nodes._model_present", return_value=True), \
             mock.patch("nodes.unload_model", return_value=None) as unload:
            node.generate(images=None, unload_after=True)
        unload.assert_called_once()
        self.assertEqual(unload.call_args.kwargs["model_name"], MODEL_NAME)

    def test_model_path_auto_reload(self):
        node = LlamaMini()
        with mock.patch("nodes.chat_completion", return_value="x"), \
             mock.patch("nodes._model_present", return_value=False) as present, \
             mock.patch("nodes.load_model", return_value=None) as load, \
             mock.patch("nodes._wait_for_model", return_value=None):
            node.generate(images=None)
        present.assert_called_once()
        load.assert_called_once()

    def test_required_widgets_and_defaults(self):
        inputs = LlamaMini.INPUT_TYPES()
        req = inputs["required"]
        opt = inputs["optional"]
        # only seed, unload_before and unload_after remain as widgets
        self.assertEqual(set(req.keys()), {"seed", "unload_before", "unload_after"})
        self.assertEqual(req["seed"][1]["default"], -1)
        self.assertEqual(req["unload_after"][1]["default"], False)
        # no other widgets (fixed values in code)
        for hidden in ("server_url", "api_key", "model", "model_path", "max_tokens",
                       "temperature", "top_p", "timeout", "max_side",
                       "system_prompt", "combine", "multi_turn", "separator", "stage1_prompt"):
            self.assertNotIn(hidden, req)
        # port order: images on top, then prompt, then system
        port_order = list(opt.keys())
        self.assertEqual(port_order[0], "images")
        self.assertEqual(port_order[1], "prompt")
        self.assertEqual(port_order[2], "system")
        # ports are forceInput (no panel widget)
        self.assertTrue(opt["prompt"][1].get("forceInput"))
        self.assertTrue(opt["system"][1].get("forceInput"))
        self.assertNotIn("text", opt)
        # category is the node name
        self.assertEqual(LlamaMini.CATEGORY, "GC_Tool/llama_mini")


if __name__ == "__main__":
    unittest.main()
