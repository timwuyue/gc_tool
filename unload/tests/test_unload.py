"""Unit tests for the 卸载模型 (ModelUnload) node. comfy.model_management is
mocked; no ComfyUI runtime needed."""

import unittest
from unittest import mock

from nodes import ModelUnload


class FakeModelManagement:
    def __init__(self):
        self.unload_calls = 0
        self.soft_calls = 0

    def unload_all_models(self):
        self.unload_calls += 1

    def soft_empty_cache(self):
        self.soft_calls += 1


class TestModelUnload(unittest.TestCase):
    def test_both_actions_by_default(self):
        node = ModelUnload()
        fake = FakeModelManagement()
        with mock.patch("nodes._mm", fake):
            out = node.unload(any="pass")
        self.assertEqual(out, ("pass",))
        self.assertEqual(fake.unload_calls, 1)
        self.assertEqual(fake.soft_calls, 1)

    def test_unload_only(self):
        node = ModelUnload()
        fake = FakeModelManagement()
        with mock.patch("nodes._mm", fake):
            node.unload(unload_models=True, clear_cache=False)
        self.assertEqual(fake.unload_calls, 1)
        self.assertEqual(fake.soft_calls, 0)

    def test_cache_only(self):
        node = ModelUnload()
        fake = FakeModelManagement()
        with mock.patch("nodes._mm", fake):
            node.unload(unload_models=False, clear_cache=True)
        self.assertEqual(fake.unload_calls, 0)
        self.assertEqual(fake.soft_calls, 1)

    def test_neither(self):
        node = ModelUnload()
        fake = FakeModelManagement()
        with mock.patch("nodes._mm", fake):
            node.unload(unload_models=False, clear_cache=False)
        self.assertEqual(fake.unload_calls, 0)
        self.assertEqual(fake.soft_calls, 0)

    def test_inputs_outputs_and_category(self):
        node = ModelUnload()
        inputs = node.INPUT_TYPES()
        self.assertIn("unload_models", inputs["required"])
        self.assertIn("clear_cache", inputs["required"])
        self.assertIn("any", inputs["optional"])
        self.assertEqual(node.RETURN_TYPES[0], "*")
        self.assertEqual(node.CATEGORY, "GC_Tool")


if __name__ == "__main__":
    unittest.main()
