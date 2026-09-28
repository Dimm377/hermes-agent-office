# Mission Control

Read-only Mission Control MVP for the local Hermes and OpenCode runtime.

## Run

Requires Node.js 20+ and the Hermes Agent CLI (`hermes`) on the `PATH` of the shell that starts the server. `opencode` is optional.

```bash
npm install
npm run dev        # API on 127.0.0.1:3001 + Vite UI (open the URL Vite prints, usually http://localhost:5173)
```

Production (single process, serves the built UI and the API):

```bash
npm run build
npm start          # open http://127.0.0.1:3001
```

Checks: `npm run lint`, `npm test`, `npm run build`.

**After pulling new code** run `npm install && npm run build` and restart `npm start` (a running `npm start` keeps serving the old API; `npm run dev` restarts the API by itself). The UI checks `/api/health` and shows a *Restart needed* banner when the server is older than the page. Set `MISSION_CONTROL_PORT` to change the port. The server binds to `127.0.0.1` only.

## Pages

- **Dashboard** — statistics across every source: gateways running, crew activity, open tasks, scheduled jobs, recent sessions, enabled skills, channels, CLI read health, 7-day usage from `hermes insights` (sessions, messages, tool calls, tokens, estimated cost, top models and tools) and a Kanban status breakdown. Tiles link to their pages.
- **Agents** — the declared chain (Lead Agent → Lead Engineer → OpenCode) with profile, model and gateway state, plus any other Hermes profiles.
- **Office** — the wide 2D pixel office, refreshed every 10 seconds. Each agent has its own desk; an agent that is replying to a chat walks to the meeting table, one running a cron job, tools or a Kanban task sits at its desk with a speech bubble saying what it is doing, and quiet agents rest in the Lounge.
- **Task Board** — Hermes Kanban in board order (triage → todo → scheduled → ready → running → blocked → review → done) with search, assignee filter and priority. Click a card for its full detail from `hermes kanban show <id> --json`: description, result or latest summary, workspace, branch, skills, model, timestamps, dependencies (clickable), runs, comments and activity. Free text is secret-redacted; only ids on the current board can be opened.
- **Calendar** — Hermes cron jobs with status, next run, overdue and last-run outcome.
- **Activity** — the 20 most recent sessions with search.
- **Memory** — per agent, what it carries into every session (following the Hermes memory and context-file docs): `SOUL.md` (identity, system-prompt slot #1), `memories/MEMORY.md` (agent notes) and `memories/USER.md` (user profile) split into their `§` entries with a usage bar against the configured limit (defaults 2,200 / 1,375 chars from `memory.*` in `config.yaml`) and a warning above 80%, context files present in the profile (`HERMES.md`, `.hermes.md`, `AGENTS.override.md`, `AGENTS.md`, `CLAUDE.md`, `.cursorrules`), and the memory settings (enabled stores, `write_approval`, external provider). OpenCode shows its global `AGENTS.md`/`CLAUDE.md`. Entries are searchable. Everything is read through the Folders safety layer, so it is read-only, confined to the agent's folder and secret-redacted. `#/knowledge` opens this page.
- **Folders** — one folder per agent, and only that agent's folder: Lead Agent → `~/.hermes/profiles/default`, Lead Engineer → `~/.hermes/profiles/leadengineer`, OpenCode → `~/.opencode`. Browse sub-folders and view files read-only. See *Folders* below.
- **Logs** — tails of `hermes logs agent|gateway|errors` with level filter, search and follow mode, plus an audit of every command Mission Control ran.

The header has a menu button that hides or shows the sidebar and a light/dark theme toggle; both are remembered per browser. All pages poll automatically, keep the last good data (marked stale) if a refresh fails, and have a manual refresh. "Refresh all" bypasses the 10-second server cache for anything older than 2 seconds. Pages are addressable by URL hash (for example `#/task-board`).

## Data and safety

The server uses only these fixed, read-only commands: `hermes profile list`, `hermes -p leadengineer gateway status`, `opencode --version`, `hermes kanban list --json`, `hermes cron list --all`, `hermes sessions list --limit 20`, `hermes skills list --enabled-only`, `hermes status --all`, `hermes insights --days 7`, `hermes logs <agent|gateway|errors> -n 200`, `hermes kanban show <id> --json` (task detail), and, for live Office activity, `hermes -p <default|leadengineer> logs agent -n 80 --since 3m` and `hermes -p <default|leadengineer> sessions list --limit 3`. Commands run with `NO_COLOR=1` and a wide `COLUMNS` so the plain-text formats parse reliably. The default gateway state is derived from `hermes profile list`; no separate default gateway command is run. Each command is executed with `execFile`, has an 8-second process timeout, and its endpoint result is cached for 10 seconds (insights: 60 seconds; logs: 5 seconds). Concurrent requests share one in-flight read. Browser input never reaches a shell command.

Only normalized profile/model, gateway state, OpenCode version, Kanban title/status, recognized cron fields, session title/preview/last-active/parseable ID, recognized enabled-skill table fields, and configured messaging-platform names with a generic configured/connected state are exposed. The channels source may also expose an integer active-session count when it is safely recognized. Log lines are the one intentional exception to "no raw output": they are returned after Hermes's own secret redaction plus a second Mission Control redaction pass (API keys, bearer tokens, `key=value` secrets, bot tokens) with home-directory paths shortened to `~`, and the `hermes logs` header line (which contains a path) is dropped. Cron last-run error text is never returned, only ok/failed. Otherwise, raw CLI output, process details, paths, configuration, credentials, authentication, API keys, environment files, provider details, and session databases are never read or returned. A failed source is rendered as `Not Available`; an unknown individual field is rendered as `Unknown`.

`/api/tasks`, `/api/calendar`, `/api/activity`, and `/api/knowledge` each return a source availability state and refresh time. Task Board is read-only and does not expose mutations. Calendar is cron-only, so it intentionally excludes general events. Activity is limited to session-list metadata and does not synthesize events. Knowledge is a curated catalog of enabled skills recognized from Hermes's Rich table. Empty source results remain available and show truthful empty states; unparseable output and command failures are shown as `Not Available`. Hermes write actions are intentionally not implemented.

## Office

`/api/office` is a read-only composition of the existing cached runtime, Kanban, and activity reads. It has three fixed stations: Lead Agent (command desk), Lead Engineer (engineering desk), and OpenCode (build terminal). Their declared role, character palette, workstation, and CSS pixel character anatomy are static metadata. The Visual Office provides CSS-only Workspace and Lounge rooms through an extensible room configuration. Workspace contains desks and collaboration details; Lounge places idle characters beside the sofa and chairs. No image or art assets are used.

Office state is always one of `Idle`, `Working`, `Reviewing`, `Collaborating`, `Offline`, or `Unknown`. The precedence is: a direct station-bound `Stopped` gateway marks Lead Agent or Lead Engineer `Offline`; then a fresh, unexpired internal Mission Control explicit-state overlay can declare `Working`, `Reviewing`, or `Collaborating`; then a fresh Kanban task explicitly assigned to the station maps `running` to `Working` and `review` to `Reviewing`; then a fresh actor-attributed active session maps to `Collaborating`; then the managed-idle policy applies.

Managed Idle is a transparent Mission Control placement policy, not agent-reported presence. It resolves only when fresh runtime, Kanban, and activity reads are available; the station-bound gateway is not stopped; there is no fresh explicit overlay; Kanban has no agent-attributed running/review task; and activity has no agent-attributed active session. It places the station in Lounge and labels it `Idle · managed placement`. Any unavailable or stale required input leaves the station `Unknown`. Gateway `Running`, generic sessions, unassigned Kanban tasks, and OpenCode version availability cannot independently create an active state. OpenCode version availability is explicitly not a state signal.

Current task and recent activity require actor attribution. The Office only shows a Kanban task when its explicit assignee matches the station aliases above. Hermes session-list metadata currently has no actor attribution, so the compact Live Activity panel labels it as unattributed session metadata and it is never assigned to a station. Failed task or activity sources retain the existing `Not Available` meaning; `Not Available` is source availability, not an Office work state. Selecting a station opens an in-page, keyboard-accessible detail dialog with room, provenance, and source freshness.

State placement is visualized without inventing work: `Working`, `Reviewing`, and `Collaborating` are in Workspace; `Idle` is in Lounge; `Offline` is dimmed at its assigned workspace station; and `Unknown` is shown at a labelled neutral Workspace presence position. The crew snapshot counts declared stations, active work (`Working`/`Reviewing`/`Collaborating`), managed idle, offline, and unknown separately. Gateway health (how many of the two station gateways report `Running`) is intentionally displayed as a separate metric. When a station has several Kanban tasks, the `running` one wins, then `review`, then the first open task. `/api/channels` is a separate safe snapshot sourced only from the Messaging Platforms section and active-session count of `hermes status --all`; it never exposes unconfigured platforms or any other status content. The Office introduces no write endpoint, shell input, or command beyond the fixed allowlist.

## Live activity in the Office

Every Hermes profile writes all of its work to its own `agent.log`: messaging replies (gateway), cron runs, tool calls and the agent loop. Mission Control reads the last 3 minutes of that log and the profile's most recent session for the two station profiles:

- gateway message lines together with agent-loop or tool lines, or a session active in the last 3 minutes → `Collaborating` (“Replying to a chat”, at the meeting table);
- `cron.*` → `Working` (“Running a scheduled job”); `tools.*` → `Working` (“Using tools”); `agent`/`run_agent` → `Working` (“Working on a request”);
- OpenCode is `Working` when a recent agent log line shows it being driven.

Precedence: explicit overlay → live activity (a running/review Kanban task, when present, labels that work) → stopped gateway (`Offline`) → Kanban task → managed `Idle` in the Lounge. Live work outranks a stopped gateway because CLI and cron work do not need it. Gateway polling noise and CLI housekeeping lines are ignored.

## Folders

Each agent resolves to its own folder:

| Agent | Folder |
|---|---|
| Lead Agent (`default`) | `<hermes root>/profiles/default`; only when that folder does not exist (stock Hermes layout), the Hermes root itself |
| Lead Engineer and other Hermes profiles | `<hermes root>/profiles/<name>` |
| OpenCode | `~/.opencode`, then `~/.config/opencode` (`MISSION_CONTROL_OPENCODE_DIR` overrides) |

The Hermes root follows Hermes's own rules (`HERMES_HOME`, default `~/.hermes`); `MISSION_CONTROL_HERMES_ROOT` overrides it. A non-default agent that resolves to the Hermes root, or to a folder another agent already owns, is shown as unavailable with the reason instead of being opened. When one agent's folder contains another's (the stock root holds `profiles/`), that sub-folder is hidden and cannot be read through the outer agent. Cards and the breadcrumb show the real path.

`/api/folders` lists the agents; `/api/folders/<agent>/list?path=` and `/api/folders/<agent>/file?path=` browse one folder. Every path is resolved (including symlinks) and must stay inside that agent's folder. The `hermes-agent` install, `.git`, virtualenvs and caches are hidden. Credential-bearing and database files (`.env*`, `auth.json`, keys and certificates, names containing token/secret/password/credential, `*.db`/SQLite files) are listed but never read. Text previews are capped at 256 KB and pass through the same secret redaction as logs. Binary files are not previewed.

**Troubleshooting "This folder could not be read".** Mission Control reads folders as the user that runs it. If a profile folder belongs to another user or has mode `700` (for example it was created by a gateway started with `sudo`/systemd as root), the card shows "No read permission for <user>" and opening it explains which user was refused. Check with `ls -ld ~/.hermes/profiles/<name>`; fix it by giving the folder back to your user (`sudo chown -R $USER:$USER ~/.hermes/profiles/<name>`) or granting read access (`sudo setfacl -R -m u:$USER:rX ~/.hermes/profiles/<name>`).

