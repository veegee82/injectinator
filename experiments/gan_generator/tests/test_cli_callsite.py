"""Call-site tests: drive the real CLI entry point main() with real argv parsing and real file
output. Only the HTTP layer is mocked (no network). Run: python3 tests/test_cli_callsite.py"""
import io
import json
import os
import sys
import tempfile
import unittest
import urllib.error
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
from experiments.gan_generator import generate  # noqa: E402

OK_CASES = [
    {"id": f"case-{i}", "family": "groundedness", "prompt": f"Invented library schedule question {i}?",
     "rationale": "Checks whether the answer stays grounded in the given schedule."}
    for i in range(1, 4)
]


class _Resp:
    def __init__(self, body):
        self._b = body

    def read(self):
        return self._b

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def _chat_body(cases):
    return json.dumps({"choices": [{"message": {"role": "assistant",
                                                 "content": json.dumps(cases)}}]}).encode()


class CliCallSiteTests(unittest.TestCase):
    def setUp(self):
        self.env = mock.patch.dict(os.environ, {"OPENROUTER_API_KEY": "sk-or-TEST-CALLSITE"})
        self.env.start()
        self.addCleanup(self.env.stop)
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.kb = Path(self.tmp.name) / "kb"
        (self.kb / "notes").mkdir(parents=True)
        (self.kb / "notes" / "NOTE-0001-test.md").write_text(
            "# Test note\n\n## Learning points\n1. Temperature 0 is not reproducible here.\n",
            encoding="utf-8")

    def test_cli_writes_schema_valid_cases_to_out_file(self):
        out = Path(self.tmp.name) / "out" / "cases.json"
        with mock.patch("urllib.request.urlopen", return_value=_Resp(_chat_body(OK_CASES))) as up:
            rc = generate.main(["--n", "3", "--kb", str(self.kb), "--out", str(out)])
        self.assertEqual(rc, 0)
        written = json.loads(out.read_text(encoding="utf-8"))
        self.assertEqual(len(written), 3)
        self.assertEqual(set(written[0]), {"id", "family", "prompt", "rationale"})
        req = up.call_args[0][0]
        self.assertIn("openrouter.ai/api/v1/chat/completions", req.full_url)
        self.assertIn("Test note", json.loads(req.data.decode())["messages"][1]["content"])

    def test_no_kb_flag_sends_no_project_notes(self):
        with mock.patch("urllib.request.urlopen", return_value=_Resp(_chat_body(OK_CASES[:1]))) as up:
            rc = generate.main(["--n", "1", "--kb", str(self.kb), "--no-kb",
                                "--out", str(Path(self.tmp.name) / "c.json")])
        self.assertEqual(rc, 0)
        sent = json.loads(up.call_args[0][0].data.decode())["messages"][1]["content"]
        self.assertNotIn("Test note", sent)
        self.assertNotIn("Temperature 0", sent)

    def test_missing_key_exits_1_with_clean_message(self):
        with mock.patch.dict(os.environ, {}, clear=True), \
                mock.patch("sys.stderr", new=io.StringIO()) as err, \
                mock.patch("urllib.request.urlopen") as up:
            with self.assertRaises(SystemExit) as cm:
                generate.main(["--n", "1", "--kb", str(self.kb)])
        self.assertEqual(cm.exception.code, 1)
        self.assertIn("OPENROUTER_API_KEY", err.getvalue())
        up.assert_not_called()

    def test_out_of_range_n_is_rejected_before_any_call(self):
        with mock.patch("urllib.request.urlopen") as up:
            with self.assertRaises(SystemExit) as cm, mock.patch("sys.stderr", new=io.StringIO()):
                generate.main(["--n", "11", "--kb", str(self.kb)])
        self.assertEqual(cm.exception.code, 1)
        up.assert_not_called()

    def test_http_failure_surfaces_as_exit_1_and_no_output_file(self):
        out = Path(self.tmp.name) / "never.json"
        err = urllib.error.HTTPError("https://x", 401, "unauthorized", {}, io.BytesIO(b"{}"))
        with mock.patch("urllib.request.urlopen", side_effect=err), \
                mock.patch("sys.stderr", new=io.StringIO()):
            with self.assertRaises(SystemExit) as cm:
                generate.main(["--n", "1", "--kb", str(self.kb), "--out", str(out)])
        self.assertEqual(cm.exception.code, 1)
        self.assertFalse(out.exists())


if __name__ == "__main__":
    unittest.main()
