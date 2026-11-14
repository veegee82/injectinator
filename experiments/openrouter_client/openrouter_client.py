"""Generic OpenAI-compatible client for OpenRouter (https://openrouter.ai/api/v1/chat/completions).

- The model is chosen by name at call time (OpenRouter model IDs, e.g. "openai/gpt-oss-120b").
- The API key is read ONLY from the environment variable OPENROUTER_API_KEY. It is never
  hard-coded, never logged, never included in an exception message.
- Standard library only (urllib). Timeouts, retries with exponential backoff for
  429 / 5xx / network errors; other 4xx errors are raised immediately.
"""
import json
import os
import time
import urllib.error
import urllib.request

ENDPOINT = "https://openrouter.ai/api/v1/chat/completions"
KEY_ENV = "OPENROUTER_API_KEY"
RETRYABLE_STATUS = {429, 500, 502, 503, 504}


class OpenRouterError(Exception):
    """Raised for non-retryable or exhausted-retry failures. Never contains the API key."""

    def __init__(self, message, status=None):
        super().__init__(message)
        self.status = status


def read_api_key(environ=None):
    env = os.environ if environ is None else environ
    key = env.get(KEY_ENV, "").strip()
    if not key:
        raise OpenRouterError(f"environment variable {KEY_ENV} is not set")
    return key


class OpenRouterClient:
    def __init__(self, api_key=None, *, endpoint=ENDPOINT, timeout=60.0,
                 max_retries=3, backoff_base=1.0, sleep=time.sleep, opener=None):
        self._api_key = api_key if api_key is not None else read_api_key()
        self.endpoint = endpoint
        self.timeout = timeout
        self.max_retries = max_retries
        self.backoff_base = backoff_base
        self._sleep = sleep
        # Resolve urlopen at construction time, not at import time, so a patched
        # urllib.request.urlopen (tests) is honoured and no real request is made by accident.
        self._opener = opener if opener is not None else urllib.request.urlopen

    def __repr__(self):  # never expose the key in repr/logs
        return f"OpenRouterClient(endpoint={self.endpoint!r}, key=<redacted>)"

    def _build_request(self, model, messages, temperature, max_tokens, seed):
        body = {"model": model, "messages": messages, "temperature": temperature,
                "max_tokens": max_tokens}
        if seed is not None:
            body["seed"] = seed
        return urllib.request.Request(
            self.endpoint, data=json.dumps(body).encode("utf-8"), method="POST",
            headers={"Authorization": f"Bearer {self._api_key}",
                     "Content-Type": "application/json"})

    def chat(self, model, messages, *, temperature=0.0, max_tokens=300, seed=None):
        """Return the parsed response dict. Raises OpenRouterError after retries are exhausted."""
        if not model or not isinstance(model, str):
            raise OpenRouterError("model must be a non-empty string")
        if not messages:
            raise OpenRouterError("messages must not be empty")
        attempt = 0
        while True:
            req = self._build_request(model, messages, temperature, max_tokens, seed)
            try:
                with self._opener(req, timeout=self.timeout) as resp:
                    raw = resp.read()
                return json.loads(raw.decode("utf-8"))
            except urllib.error.HTTPError as e:
                status = e.code
                detail = _safe_detail(e, self._api_key)
                if status in RETRYABLE_STATUS and attempt < self.max_retries:
                    attempt += 1
                    self._sleep(self.backoff_base * (2 ** (attempt - 1)))
                    continue
                raise OpenRouterError(f"HTTP {status}: {detail}", status=status) from None
            except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
                if attempt < self.max_retries:
                    attempt += 1
                    self._sleep(self.backoff_base * (2 ** (attempt - 1)))
                    continue
                raise OpenRouterError(f"network error: {type(e).__name__}") from None
            except json.JSONDecodeError:
                raise OpenRouterError("response was not valid JSON") from None

    @staticmethod
    def text_of(response):
        """Extract the first assistant message text from a chat-completions response."""
        try:
            content = response["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError):
            raise OpenRouterError("response has no choices[0].message.content") from None
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            parts = []
            for item in content:
                if isinstance(item, str):
                    parts.append(item)
                elif isinstance(item, dict) and isinstance(item.get("text"), str):
                    parts.append(item["text"])
            return "".join(parts)
        raise OpenRouterError("model response was not text")


def _safe_detail(http_error, api_key):
    """Short error detail from an HTTPError body. The actual key VALUE is redacted, because a
    server may echo the Authorization header back; redacting only the variable name is not enough."""
    try:
        body = http_error.read(500).decode("utf-8", "replace")
    except Exception:
        return "no body"
    if api_key:
        body = body.replace(api_key, "<redacted>")
    return body.replace(KEY_ENV, "<env>")[:300]
