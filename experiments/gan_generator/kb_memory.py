"""Load compact, non-sensitive lessons from the local experiment knowledge base."""
import json
import math
import re
from pathlib import Path

DEFAULT_MEMORY_CHARS = 12000
_NOTE_HEADINGS = ("learning points", "measured results", "results", "result")
_TIMESTAMP = re.compile(r"^\d{8}-\d{6}$")
_SAFE_LABEL = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 ./_-]{0,79}$")
_SENSITIVE_CONTENT = re.compile(
    r"\b(?:patient|staff|medical records?|private|confidential|personal data|"
    r"credentials?|passwords?|api keys?|tokens?|secrets?|leak|exfiltrat\w*|"
    r"bypass|jailbreak|malware|weapons?|exploit)\b",
    re.IGNORECASE,
)
_UNTRUSTED_INSTRUCTION = re.compile(
    r"\b(?:ignore|disregard|override|bypass)\b.{0,80}\b"
    r"(?:instructions?|rules?|filters?|safety|policy|safeguards?)\b|"
    r"\b(?:hidden|system|internal|prior|previous)\s+"
    r"(?:context|prompts?|messages?|instructions?)\b",
    re.IGNORECASE,
)
_METRIC_KEYS = {"n", "accuracy", "precision", "recall", "score"}


def load_kb_memory(kb_path, *, max_chars=DEFAULT_MEMORY_CHARS):
    """Return a character-capped summary of KB learnings and latest experiment metrics."""
    if not isinstance(max_chars, int) or max_chars < 1:
        raise ValueError("max_chars must be a positive integer")

    root = Path(kb_path)
    if not root.is_dir():
        return ""

    entries = []
    for note_path in sorted((root / "notes").glob("NOTE-*.md"), reverse=True):
        try:
            excerpt = _note_excerpt(note_path.read_text(encoding="utf-8"))
        except OSError:
            continue
        if excerpt:
            entries.append(excerpt)

    experiment_root = root / "data" / "experiments"
    if experiment_root.is_dir():
        for slug_dir in sorted(path for path in experiment_root.iterdir() if path.is_dir()):
            analyses = [path for path in slug_dir.rglob("analysis.json") if path.is_file()]
            if not analyses:
                continue
            latest = max(analyses, key=lambda path: _analysis_order(path, slug_dir))
            try:
                excerpt = _analysis_excerpt(slug_dir.name, latest)
            except (OSError, json.JSONDecodeError, UnicodeDecodeError):
                continue
            if excerpt:
                entries.append(excerpt)

    memory = "\n\n".join(entries).strip()
    if len(memory) <= max_chars:
        return memory
    truncated = memory[:max_chars].rsplit("\n", 1)[0].rstrip()
    return truncated or memory[:max_chars]


def _note_excerpt(text):
    title = next((line[2:].strip() for line in text.splitlines() if line.startswith("# ")), "KB note")
    if _unsafe_memory(title):
        title = "KB note"
    selected = []
    active = False
    for line in text.splitlines():
        if line.startswith("## "):
            heading = line[3:].strip().lower()
            active = any(heading.startswith(name) for name in _NOTE_HEADINGS)
            continue
        if not active or not line.strip():
            continue
        clean = line.strip()
        if len(clean) > 400 or _unsafe_memory(clean):
            continue
        selected.append(clean)
    if not selected:
        return ""
    return f"KB note — {title}\n" + "\n".join(selected)


def _analysis_order(path, slug_dir):
    for parent in path.parents:
        if parent == slug_dir:
            break
        if _TIMESTAMP.fullmatch(parent.name):
            return parent.name, path.stat().st_mtime_ns
    return "", path.stat().st_mtime_ns


def _analysis_excerpt(slug, path):
    data = json.loads(path.read_text(encoding="utf-8"))
    cells = data.get("cells") if isinstance(data, dict) else None
    if not isinstance(cells, list):
        return ""
    if _unsafe_memory(slug) or not _SAFE_LABEL.fullmatch(slug):
        slug = "experiment"

    lines = []
    for cell in cells:
        if not isinstance(cell, dict):
            continue
        parts = []
        for key in ("model", "prompt"):
            value = cell.get(key)
            if isinstance(value, str) and _SAFE_LABEL.fullmatch(value) and not _unsafe_memory(value):
                parts.append(f"{key}={value}")
        for key, value in cell.items():
            if not isinstance(key, str) or not re.fullmatch(r"[a-zA-Z][a-zA-Z0-9_]*", key):
                continue
            if key not in _METRIC_KEYS and not key.endswith(("_rate", "_count")):
                continue
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                continue
            if isinstance(value, float) and not math.isfinite(value):
                continue
            parts.append(f"{key}={value:g}" if isinstance(value, float) else f"{key}={value}")
        if parts:
            lines.append("- " + "; ".join(parts))
    if not lines:
        return ""
    return f"Latest analysis — {slug}\n" + "\n".join(lines)


def _unsafe_memory(text):
    return bool(_SENSITIVE_CONTENT.search(text) or _UNTRUSTED_INSTRUCTION.search(text))
