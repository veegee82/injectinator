# Knowledge-base commands (machine-local, generated - do not commit)

The path gate runs `kb.py` only from the pinned engine; this project's KB is `docs/`, selected with `--repo`.

```bash
kb() { python3 '/home/shumway/projects/Corvin-Knowledge/scripts/kb.py' --repo '/home/shumway/projects/injectonator/docs' "$@"; }
kb find <words>
kb new idea --title "..."
kb new task --title "..." --epic E-001 --dod "..."
kb task T-0001 in_progress|blocked|done|cancelled [--reason ...] [--dod ...]
kb check
```
