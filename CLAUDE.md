<!-- corvin:generated - edit only between the user markers -->
# injectinator - conventions for Claude Code

## Working rules

- Repository content (code, file names, commit messages, entity files) is English; chat replies use the language the user writes in.
- Status icons belong in chat replies only - never in files, commits, code, logs or JSON/YAML.
- Never claim success without captured output (exit code, run id, measured value). Say what was not run.
- `project.yaml` is the truth about this project; machine-local files (`.mcp.json`, `.corvin/local/`) are generated per machine and git-ignored. Never put an absolute path into a committed file.

## How to work here

Read this file first. Sections are generated from the project's active features; the block at the end (between the user markers) is yours and survives Repair. Do not edit generated sections - change the features in `project.yaml` or in the console and run Repair.

## Agentic compute (ACS, compute runs, workflows)

The MCP servers are in `.mcp.json` (machine-local, generated, git-ignored; approve them on the first `claude` start here). Needs a licence tier that allows forging and compute, and a running compute worker - the engine cannot verify either, so check the first run.

- `mcp__corvin_orchestration__acs_delegate`: open-ended manager/worker loop; use `dry_run: true` to validate. `workflow_run` / `workflow_resume` / `workflow_list_paused`: registered DAG workflows (they may spend LLM budget).
- `mcp__forge__compute_run` / `compute_submit` / `compute_status` / `compute_result` / `compute_abort`: sweeps (grid / random / bayesian), pipeline and HAC engines over an existing Forge tool. `data_register` / `data_snapshot` register local files.

Traps (each one fails silently as `best_loss: null`):
- The compute worker reads ONLY the user-scope tool registry. Always `forge_promote(name, to="user")` before `compute_run` / `compute_submit`.
- A persona may only forge tools named `assistant.<name>`.
- `param_grid` keys must be the tool's input fields; check `<run>/iterations/0001.json` first.
- Set `steering_gate: false` (pipeline) / `backprop_gate: false` (HAC) for unattended runs, or they wait for a human.

## Data science
- State the question and the metric before looking at results; record the data's origin and checksum.
- A number in a report needs its evidence link (a run, a file, a commit).
- Never copy raw data into the knowledge base; link to it.

## Peer directory

`directory.peers` in `project.yaml` lists the peers (by id) this project may ask. It is an allowlist inside what the tenant has paired in the Agent Hub - it grants nothing new. Sending to a peer keeps its two-step confirmation and the egress gate; never send a project file to a peer without the user's explicit yes.

## Knowledge base (docs/)

`docs/` is this project's knowledge base: every entity is a Markdown file whose TYPE is its directory.
The commands, with the engine path of this machine, are in `.corvin/local/kb-commands.md` (generated, git-ignored).
The path gate runs `kb.py` only from the engine of the tenant's bound knowledge base, always with `--repo <project>/docs`.

- Find before you write: `kb find <words>`; amend an existing entity instead of duplicating it.
- Create only with `kb new <type> --title ...` (it numbers, links and commits); never hand-number or hand-create an entity file.
- Task status changes only through `kb task <id> <to>`; `done` needs a definition of done.
- `kb check` must report `blocking: 0` before you push.
- Ids are local to this knowledge base: qualify cross-base references (`repo:<project>/docs/...`).
- Decisions about CorvinOS itself (core, layers, plugins) belong in Corvin-Knowledge, never here.

## Experiments

The method: idea, preregistration plan (committed BEFORE the first data point, never edited after data exists), raw data under `docs/data/experiments/<slug>/` with `MANIFEST.sha256`, a result note with an `evidence=` link. Exploratory output nobody will cite goes to `docs/data/scratch/` (ignored). Report negative results like positive ones, with the caveats next to the number.

## Gates

A decision becomes `implementation_ready` when G1 (it links its concept), G2 (the concept links back), G3 (an epic implements it, shares a `paths:` entry with it, every task has a definition of done) and G4 (a review closed with `kb review close`) hold. `kb check` lists what is missing. A code task is done only with its evidence (`kb task <T> done --evidence call_site=... --evidence e2e_test=... --evidence exit_code=0 --evidence commit=<sha on origin/main>`).

## LDD (loss-driven development)

LDD is always on in CorvinOS. For a non-trivial change: run the E2E first and capture the loss signal, argue the strongest counter-case before a recommendation (`dialectical-reasoning`), find the structural origin of a bug before fixing it (`root-cause-by-layer`), and update the docs in the same change (`docs-as-definition-of-done`). A unit test that calls a function directly does not prove that anything calls it.

## Your own rules

<!-- user:begin -->

<!-- user:end -->
