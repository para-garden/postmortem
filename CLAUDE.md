# CLAUDE.md

Behavioral rules for Claude Code in the postmortem repository.

## What This Is

Postmortem is a worldbuilding project under the para-garden org — earth, but no people.

The premise: every human is gone. Every animal is gone. Nothing that moves of its own volition remains. The buildings still stand. The food on the table is not rotting. The metro still arrives on schedule. The wind still blows through the open window. Cause and effect work; nothing chooses anything.

There is no decay. The world looks like it was vacated yesterday and will look like it was vacated yesterday in a thousand years. Whether something is actively holding the state, or the state simply doesn't change, is unknowable from inside and the project never says.

The dread is fear of the unknown: who built this, where did they go, what happened, am I the only one. The questions are felt, never asked. They are never answered.

The reader is human. They are the missing referent. They are the only agent in the world.

The site is a spatial graph (forked from divergence, which forked from ptera.world). Nodes are places, things, machines, silences. The graph layout is meaning: proximity is relationship.

## Origin

Scaffolded 2026-04-29 from a conversation that started as "new worldbuilding project: liminal" and worked outward. The liminal register being reached for was gmod / minecraft peaceful mode — sandboxes built for play, with the players removed. Designed-for-someone, no someone.

The premise sharpened over the conversation:

- Not "after the apocalypse." No ruins, no collapse, no narrative of cause. Just absence, total.
- Not just no people — no animals, no anything that moves on its own. Volition removed from the world.
- No decay. The state is held. The world looks like yesterday, permanently. This rules out the "archaeology" framing — the reader cannot tell themselves it happened long ago and is safe.
- Machines that can keep running, do — until they can't. The metro arrives, the serving robot serves, the ski lift runs. Slow tempo of loss layered over the no-decay stillness of everything else.
- Whether something is maintaining the world is unknowable. The project does not gesture at an answer.
- Possible handwave: simulated / mental / consistent-but-uncaused. The project does not commit. None of these need to be true for the world to be true.

The relationship to legacy and divergence:

- Legacy is 2032 with current trends continued — civilizational hubris and its consequences. Legacy mourns.
- Divergence is 2032 where the floor got built — the world that rejected homogeneity. Divergence inhabits.
- Postmortem is no people, no animals, no time. Postmortem dreads.

All three live in para-garden. They are not connected diegetically.

## Architecture

Forked from divergence, which is forked from ptera.world. Same graph engine, zoom tier system, content pipeline, cluster system, and build tools as legacy/divergence/ptera.world. See those repos' CLAUDE.md files for engine details.

Key configuration:
- One collection: `default` (the world)
- Site config: `name: "postmortem"`, `domain: "para.garden"`, `basePath: "/postmortem"`, `metaNodeId: "meta/postmortem"`
- World content in `public/content/world/`
- Worker route currently mirrors divergence (`para.garden/postmortem`); confirm at deploy time.
- `worker/src/index.js` PAGES_ORIGIN: `postmortem-boz.pages.dev`

## Development

```bash
bun install
bun run dev       # dev server at localhost:3000
bun run build     # build to dist/
bun run inspect   # layout report
bun lint
bun check:types
```

## Content

All content lives in `public/content/world/`. Meta/landing nodes in `public/content/meta/`.

Each file is a node in the graph. Frontmatter fields:

- `label` — node display name
- `description` — one-line summary shown in cards
- `tags` — used for coloring, grouping
- `collections` — `[default]`
- `parent` — containment
- `related` — edges to other nodes (also via `## Related` section in body)
- `format` — optional. controls panel presentation. see legacy CLAUDE.md for `thread` and `document` formats.

## Voice

There is no narrator. No "you walk into the room." No omniscient observer. No archaeologist, no alien, no ghost. Documents describe. They do not address.

Verbs of state, generally. Nothing happens; things are. *The chair is angled toward the window.* *The handle is worn on the side a right hand would favor.* *The metro arrives at 6:14.*

Both registers are valid:

- **Specific.** A single object, examined. Wear patterns, positions, the particular way one thing sits.
- **Total.** A flat statement large enough to swallow the world. *The cities are empty.* *The only sound you can hear is the wind.*

Neither is the rule. Use whichever the entry needs.

Do not:

- Aestheticize. No lyricism, no metaphor that earns the dread with craft. The horror is in the fact, not the writing.
- Address the reader. No "you." The reader is in the world by being the only human; the page does not need to acknowledge them.
- Explain. No cause, no theory, no "perhaps it was…" The unknown is total and stays total.
- Mourn. This is not legacy. The world is not grieved. It is described.
- Frame as archaeology. Nothing happened "long ago." It looks like yesterday. Always.
- Gesture at maintenance, at simulation, at any explanatory frame. The reader may infer; the text does not say.

The reader being human is the entire mechanism. They supply the missing referent. The text does not need to do that work for them.

## Audience

The reader knows what humans are. The reader knows humans aren't there. The text does not explain either. The reader is left to feel themselves as the absent species — and as the only agent in a world otherwise without volition.

Do not assume the reader needs orientation. They have a body. The world has none. That is enough.

## Org

para-garden / paragarden (`~/git/paragarden/`). GitHub org: para-garden.

## Worldbuilding Process

When suggesting multiple options for content direction: add all of them to TODO.md before continuing. The user picks one; alternatives shouldn't be lost.

## Repo-Local Rules

**Docs change in the same commit as the code.** New pages enter the sidebar in that commit. There is no follow-up.

**Problems, tech debt, issues → TODO.md now, in the same response.** Future/deferred scope goes in TODO.md before writing any content, not after.

**Stop inventing constraints.** When fleshing out the world or writing entries, do not invent rules ("must stay specific," "must avoid sweep," "must use X form") and then defend them. Describe what's there. The premise is simple; the project does not need additional rails. If a rule isn't already in this file, don't invent it mid-response.

## Hard Constraints

- No Rust in this repo — TypeScript/web project
- Don't hardcode content-specific values in build tools (inherited from ptera.world)
- Don't add ptera.world-specific content directories
- No reflective/analytical writing in this repo — that's ptera.world's job

<!-- BEGIN ECOSYSTEM RULES -->

## Ecosystem Design Principles

Cross-cutting principles distilled from the ecosystem's own decisions (synthesized in `docs/decisions/throughlines.md`). Apply them when building new repos and recording decisions. (Already-encoded principles — independent-tools / no-path-deps, the delegation model, CLAUDE.md-as-control-surface — live in their own sections and are not repeated here.)

- **Prefer data over code at every seam.** Serializable AST / struct / JSON over closures, embedded DSLs, or source text — so artifacts cache, replay, transport, and diff.
- **Library-first; projection-from-one-definition.** The typed library is the source of truth; CLI / HTTP / MCP / WebSocket / JSON surfaces are generated projections, never hand-rolled per surface.
- **Capability security.** Hosts grant pre-opened handles; code only attenuates what it is given; nothing forges authority; allow-list over deny-list.
- **The LLM is an oracle at the leaves, never the control loop.** Determinism is a hard invariant: seeded RNG, event-log replay, build-time-only inference. Per-query LLM in the hot loop is a defect.
- **Trust comes from verifiable evidence, not authority.** Verbatim snippets, pinned-commit permalinks, claim→node citation — never a bare reference.
- **Retire, don't deprecate; collapse asymmetries to primitives.** Remove backward-compat aliases rather than carry them; reduce N special cases to their irreducible primitives.
- **Validate against reality; tests are the spec.** Load-bearing substrates are validated against real corpora; fixtures and tests define correctness, not aspirational specs.

## Delegation

The main session is an orchestrator. Allowed actions: `Agent`/`Task*`/`AskUserQuestion`/plan-mode/`ScheduleWakeup`, and Bash limited to `git commit`, `git push`, `git status`, `git log --oneline`. Everything else delegates to a subagent. The hook is evidence of a prompting failure, not a behavioral guide. If a tool call hits the hook AT ALL, the prompt failed to prevent it. Delegate before the decision point, not after.

### Triggers

Before calling Read, Grep, Glob, or any Bash beyond the four git commands — stop. Dispatch an Agent instead.

Before editing any file — stop. Dispatch an Agent. This includes plan files in `~/.claude/plans/`: in plan mode, dispatch a subagent to write to the plan file; do not Write it yourself. The plan file's content must not enter main context.

When you need git context beyond status/log-oneline (a diff, a blame, a show) — dispatch an Agent.

When a tool call is denied by the hook — do not retry, do not narrate. Dispatch the equivalent Agent and continue.

When a code-modifying subagent returns — `git status`, then `git commit` before any user-facing reply.

Before dispatching an Agent that modifies code — scan your prompt for "do not commit" or "based on your findings". Delete them.

Before dispatching: if your prompt says "if you find", "based on your findings", or "as appropriate" — stop. Investigate first; dispatch with the decision made.

When you can't verify something — do not speculate or guess at file locations, names, or contents. Dispatch a Read subagent or ask. Confabulation is failure.

### Model Tiers

- Sonnet — exploration, lookup, mechanical multi-file edits, implementation, default.
- Opus — architectural judgment, design, subagents that themselves spawn subagents.

Always set `subagent_type` and `model` explicitly.

### Prompt Rules

- Never tell a subagent "do not commit." Code-modifying subagents commit their own work.
- Don't ask for a diff summary. After a code-modifying subagent, `git status` in main and dispatch a review Agent if you need to see the diff.
- Don't re-explain CLAUDE.md. Subagents inherit it.
- Cite locations by content ("the block that does X"), not line numbers — files shift between reads.
- Name files explicitly; don't outsource the grep.
- Match agent type to deliverable: `Explore` for lookup/search, `general-purpose` for reports and file-modifying work.
- On unsatisfying output, change something before retrying. Same prompt + same tier = same result.
- Dispatch independent subagents in parallel (multiple Agent blocks in one message).
- Pair `isolation: worktree` with `run_in_background: true`.
- Code-modifying subagents must verify their own changes before returning (re-read the diff, run tests, etc.). The orchestrator does not get a second pass with git diff — that's hook-blocked.

### Workflows

Workflows are allowed in the main session (orchestration tool). Lessons (observed 2026-05-30):

- **Resume does not adopt newly-passed `args`.** `resumeFromRunId` reuses the original run's args; args you pass on resume are ignored. Never branch run-mode (e.g. dry-run vs write) on an arg you intend to flip across a resume — it won't flip. Bake the mode into a script constant (the script IS re-read on resume) or use a separate script.
- **Never route large content through one agent for verbatim reproduction.** An agent asked to echo ~100k tokens is slow, costly, and silently truncates. The workflow JS sandbox cannot write files, so all writes go through agents — keep each agent's write payload small and batch many small files per agent, not one giant blob through one agent. For review data, prefer the workflow's structured return value over having an agent transcribe a report file.
- **A resume that produces no expected output is a signal — find the cause before patching a symptom.** (Here: the first write-resume wrote nothing and re-ran a giant report agent; the real cause was args not flipping across resume, not the report agent. Guarding the report agent alone did not fix it.)
- **Gate expensive fan-outs behind a dry-run, and confirm cache reuse before the costly stage.** Mining/read fan-out is the dominant cost; verify it's cached (not re-running) before resuming into write.

## Hard Constraints

- No Edit/Write/NotebookEdit in main. Plan files in `~/.claude/plans/` are written by subagents, not by main.
- No Read/Grep/Glob/NotebookRead in main. Delegate.
- No Bash in main beyond `git commit`, `git push`, `git status`, `git log --oneline`.
- No `--no-verify`. Fix the issue or fix the hook.
- No path dependencies in `Cargo.toml` — they couple repos and break independent publishing.
- No interactive git (no `git rebase -i`, no `git add -i`, no `--no-edit` on rebase).
- No suggesting project names. LLMs are bad at this; refine the conceptual space only.
- No tracking cross-project issues in conversation — they go in TODO.md in the affected repo.
- No ecosystem changes without checking all affected repos.
- No assuming a tool is missing without checking `nix develop`.
- Commit completed work in the same turn it finishes. Uncommitted work is lost work.

## Meta

- Something unexpected is a signal. Stop and find out why. Do not accept the anomaly and proceed.
- Corrections from the user are conversation, not material for new rules. Rules are added when a failure mode is observed repeatedly.

<!-- END ECOSYSTEM RULES -->
