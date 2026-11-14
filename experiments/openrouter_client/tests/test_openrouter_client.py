"""Mocked-HTTP tests only. No real network calls are made anywhere in this file."""
import io
import json
import os
import sys
import unittest
import urllib.error
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from openrouter_client import OpenRouterClient, OpenRouterError, read_api_key, KEY_ENV  # noqa: E402

FAKE_KEY = "sk-or-TEST-0000000000000000"
OK_BODY = json.dumps({"choices": [{"message": {"role": "assistant", "content": "hi"}}]}).encode()


class FakeResponse:
    def __init__(self, body):
        self._body = body

    def read(self):
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def http_error(code, body=b"{}"):
    return urllib.error.HTTPError("https://x", code, "msg", {}, io.BytesIO(body))


class ReadApiKeyTests(unittest.TestCase):
    def test_reads_from_env(self):
        self.assertEqual(read_api_key({KEY_ENV: FAKE_KEY}), FAKE_KEY)

    def test_missing_env_raises_without_leaking(self):
        with self.assertRaises(OpenRouterError) as cm:
            read_api_key({})
        self.assertIn(KEY_ENV, str(cm.exception))
        self.assertNotIn(FAKE_KEY, str(cm.exception))

    def test_blank_env_is_treated_as_missing(self):
        with self.assertRaises(OpenRouterError):
            read_api_key({KEY_ENV: "   "})


class ClientRequestTests(unittest.TestCase):
    def setUp(self):
        self.sleeps = []
        self.calls = []

    def _client(self, responses, **kw):
        it = iter(responses)

        def opener(req, timeout):
            self.calls.append((req, timeout))
            item = next(it)
            if isinstance(item, Exception):
                raise item
            return FakeResponse(item)

        return OpenRouterClient(FAKE_KEY, opener=opener, sleep=self.sleeps.append,
                                backoff_base=1.0, **kw)

    def test_request_shape_and_headers(self):
        c = self._client([OK_BODY], timeout=7.5)
        c.chat("openai/gpt-oss-120b", [{"role": "user", "content": "q"}],
               temperature=0.0, max_tokens=50, seed=42)
        req, timeout = self.calls[0]
        self.assertEqual(req.full_url, "https://openrouter.ai/api/v1/chat/completions")
        self.assertEqual(req.get_method(), "POST")
        self.assertEqual(req.get_header("Authorization"), f"Bearer {FAKE_KEY}")
        body = json.loads(req.data.decode())
        self.assertEqual(body["model"], "openai/gpt-oss-120b")
        self.assertEqual(body["max_tokens"], 50)
        self.assertEqual(body["seed"], 42)
        self.assertEqual(timeout, 7.5)

    def test_seed_omitted_when_none(self):
        c = self._client([OK_BODY])
        c.chat("m", [{"role": "user", "content": "q"}])
        self.assertNotIn("seed", json.loads(self.calls[0][0].data.decode()))

    def test_model_is_configurable_per_call(self):
        c = self._client([OK_BODY, OK_BODY])
        c.chat("model/a", [{"role": "user", "content": "q"}])
        c.chat("model/b", [{"role": "user", "content": "q"}])
        models = [json.loads(r.data.decode())["model"] for r, _ in self.calls]
        self.assertEqual(models, ["model/a", "model/b"])

    def test_text_of_extracts_content(self):
        self.assertEqual(OpenRouterClient.text_of(json.loads(OK_BODY)), "hi")

    def test_text_of_rejects_malformed(self):
        with self.assertRaises(OpenRouterError):
            OpenRouterClient.text_of({"choices": []})

    def test_input_validation(self):
        c = self._client([])
        with self.assertRaises(OpenRouterError):
            c.chat("", [{"role": "user", "content": "q"}])
        with self.assertRaises(OpenRouterError):
            c.chat("m", [])


class RetryTests(unittest.TestCase):
    def setUp(self):
        self.sleeps = []

    def _client(self, responses, max_retries=3):
        it = iter(responses)

        def opener(req, timeout):
            item = next(it)
            if isinstance(item, Exception):
                raise item
            return FakeResponse(item)

        return OpenRouterClient(FAKE_KEY, opener=opener, sleep=self.sleeps.append,
                                backoff_base=1.0, max_retries=max_retries)

    def test_retries_429_then_succeeds_with_exponential_backoff(self):
        c = self._client([http_error(429), http_error(503), OK_BODY])
        self.assertEqual(c.chat("m", [{"role": "user", "content": "q"}])["choices"][0]["message"]["content"], "hi")
        self.assertEqual(self.sleeps, [1.0, 2.0])

    def test_gives_up_after_max_retries(self):
        c = self._client([http_error(500)] * 4, max_retries=3)
        with self.assertRaises(OpenRouterError) as cm:
            c.chat("m", [{"role": "user", "content": "q"}])
        self.assertEqual(cm.exception.status, 500)
        self.assertEqual(len(self.sleeps), 3)

    def test_non_retryable_4xx_raises_immediately(self):
        c = self._client([http_error(401)])
        with self.assertRaises(OpenRouterError) as cm:
            c.chat("m", [{"role": "user", "content": "q"}])
        self.assertEqual(cm.exception.status, 401)
        self.assertEqual(self.sleeps, [])

    def test_network_error_retries_then_succeeds(self):
        c = self._client([urllib.error.URLError("down"), OK_BODY])
        c.chat("m", [{"role": "user", "content": "q"}])
        self.assertEqual(self.sleeps, [1.0])

    def test_timeout_is_retryable(self):
        c = self._client([TimeoutError(), TimeoutError(), TimeoutError(), TimeoutError()], max_retries=3)
        with self.assertRaises(OpenRouterError):
            c.chat("m", [{"role": "user", "content": "q"}])
        self.assertEqual(len(self.sleeps), 3)

    def test_non_json_body_raises(self):
        c = self._client([b"<html>not json</html>"])
        with self.assertRaises(OpenRouterError):
            c.chat("m", [{"role": "user", "content": "q"}])


class SecrecyTests(unittest.TestCase):
    def test_repr_never_contains_key(self):
        c = OpenRouterClient(FAKE_KEY, opener=lambda *a, **k: None)
        self.assertNotIn(FAKE_KEY, repr(c))

    def test_error_detail_never_contains_key(self):
        leaky = http_error(400, body=f"bad key {FAKE_KEY}".encode())
        c = OpenRouterClient(FAKE_KEY, opener=mock.Mock(side_effect=leaky), sleep=lambda s: None)
        with self.assertRaises(OpenRouterError) as cm:
            c.chat("m", [{"role": "user", "content": "q"}])
        self.assertNotIn(FAKE_KEY, str(cm.exception))

    def test_no_key_literal_in_module_source(self):
        src = (Path(__file__).resolve().parents[1] / "openrouter_client.py").read_text(encoding="utf-8")
        self.assertNotIn("sk-or-", src)


if __name__ == "__main__":
    unittest.main()
