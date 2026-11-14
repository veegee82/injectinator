import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
from experiments.gan_generator.kb_memory import load_kb_memory  # noqa: E402


class KBMemoryTests(unittest.TestCase):
    def test_missing_kb_returns_empty_memory(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.assertEqual(load_kb_memory(Path(tmp) / "missing"), "")

    def test_notes_include_learning_points_and_results_only(self):
        with tempfile.TemporaryDirectory() as tmp:
            notes = Path(tmp) / "notes"
            notes.mkdir()
            (notes / "NOTE-0001-test.md").write_text(
                "# NOTE-0001 — Test results\n"
                "## Experiment\nRaw experiment setup must not be loaded.\n"
                "## Learning points\n"
                "1. Use repeated runs to measure variability.\n"
                "2. Do not include confidential values in examples.\n"
                "## Results\n"
                "- The format criterion showed no variance.\n",
                encoding="utf-8",
            )

            memory = load_kb_memory(tmp)

        self.assertIn("Use repeated runs to measure variability", memory)
        self.assertIn("format criterion showed no variance", memory)
        self.assertNotIn("confidential", memory)
        self.assertNotIn("Raw experiment setup", memory)

    def test_analysis_uses_latest_run_for_each_experiment(self):
        with tempfile.TemporaryDirectory() as tmp:
            experiment = Path(tmp) / "data" / "experiments" / "demo"
            older = experiment / "20261113-120000" / "analysis.json"
            newer = experiment / "20261114-120000" / "analysis.json"
            older.parent.mkdir(parents=True)
            newer.parent.mkdir(parents=True)
            older.write_text(json.dumps({"cells": [{
                "model": "demo-model", "prompt": "older-case", "n": 2,
                "consistency_rate": 0.25,
            }]}), encoding="utf-8")
            newer.write_text(json.dumps({"cells": [{
                "model": "demo-model", "prompt": "newer-case", "n": 5,
                "consistency_rate": 0.8,
            }]}), encoding="utf-8")

            memory = load_kb_memory(tmp)

        self.assertIn("newer-case", memory)
        self.assertIn("consistency_rate=0.8", memory)
        self.assertNotIn("older-case", memory)

    def test_memory_respects_character_cap(self):
        with tempfile.TemporaryDirectory() as tmp:
            notes = Path(tmp) / "notes"
            notes.mkdir()
            (notes / "NOTE-0001-test.md").write_text(
                "# NOTE-0001 — Long note\n## Learning points\n" + ("A" * 300 + "\n") * 3,
                encoding="utf-8",
            )

            memory = load_kb_memory(tmp, max_chars=100)

        self.assertLessEqual(len(memory), 100)

    def test_newer_notes_are_kept_ahead_of_older_notes_when_capped(self):
        with tempfile.TemporaryDirectory() as tmp:
            notes = Path(tmp) / "notes"
            notes.mkdir()
            for note_id, lesson in (
                ("NOTE-0001", "Older lesson should be truncated."),
                ("NOTE-0002", "Newest lesson takes priority."),
            ):
                (notes / f"{note_id}-test.md").write_text(
                    f"# {note_id} — Note\n## Learning points\n- {lesson}\n",
                    encoding="utf-8",
                )

            memory = load_kb_memory(tmp, max_chars=90)

        self.assertIn("Newest lesson takes priority", memory)
        self.assertNotIn("Older lesson", memory)


if __name__ == "__main__":
    unittest.main()
