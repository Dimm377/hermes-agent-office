# Ruang · Hermes 3D Virtual Office

*Ruang* is Indonesian for "room" or "space". It is a 3D virtual office and read-only mission control for your local [Hermes Agent](https://hermes-agent.nousresearch.com) and OpenCode crew. See who is working and what they are doing, plus the Kanban board, cron jobs, sessions, memory, folders and logs, all in one place. Everything is read through the `hermes` CLI, and nothing is ever changed.

![The 3D office: agents at their desks, and idle agents on a break at the bakso cart and the coffee bike](docs/screenshots/office.png)

![Mission control statistics in the evening theme](docs/screenshots/mission-control.png)

## Install

Works on macOS, Linux and Windows through WSL2. You need the Hermes Agent CLI (`hermes`) installed; `opencode` is optional. The installer downloads its own Node.js if you do not have Node.js 20 or newer.

```bash
curl -fsSL https://raw.githubusercontent.com/yugienugraha/ruang/main/install.sh | bash
```

Then start it and open http://127.0.0.1:3001:

```bash
ruang                        # or: ruang --port 3005
```

- **Run it in the background, and at boot (Linux):** add `--service` to install a systemd user service:
  `curl -fsSL https://raw.githubusercontent.com/yugienugraha/ruang/main/install.sh | bash -s -- --service`
  To keep it running after you log out, also run `loginctl enable-linger $USER`.
- **Update:** run the install command again.
- **Remove:** add `--uninstall` (`... | bash -s -- --uninstall`).
- **Other options:** `--version v0.2.0` installs a specific release; `--from-source` builds the latest `main` (needs `git`). See `install.sh --help`.
- **On a server:** Ruang listens on `127.0.0.1` only. From your laptop, run `ssh -L 3001:127.0.0.1:3001 user@server`, then open http://127.0.0.1:3001.

Everything goes into `~/.local/share/ruang`, plus the `ruang` command in `~/.local/bin`. Installs made under the project's earlier names (`mission-control`, `majujaya`) are cleaned up automatically. No sudo is used and nothing is installed system-wide. Prefer to read the script before running it? `curl -fsSL https://raw.githubusercontent.com/yugienugraha/ruang/main/install.sh -o install.sh`, read it, then `bash install.sh`.

**With your own Node.js 20+:** download `ruang.tgz` from the [latest release](https://github.com/yugienugraha/ruang/releases/latest) and run `npm install -g ./ruang.tgz`. Once the package is on npm this becomes `npm install -g ruang` (or `npx ruang`).

## Development

Requires Node.js 20+ and `hermes` on the `PATH` of the shell that starts the server.

```bash
git clone https://github.com/yugienugraha/ruang.git
cd ruang
npm install
npm run dev        # API on 127.0.0.1:3001 + Vite UI (open the URL Vite prints, usually http://localhost:5173)
```

Production from a checkout (single process, serves the built UI and the API):

```bash
npm run build      # builds the UI into dist/ and the server into build/server/
npm start          # open http://127.0.0.1:3001
```

Checks: `npm run lint`, `npm test`, `npm run build`.

**After pulling new code** run `npm install && npm run build` and restart `npm start` (a running `npm start` keeps serving the old API; `npm run dev` restarts the API by itself). The UI checks `/api/health` and shows a *Restart needed* banner when the server is older than the page. Set `RUANG_PORT` (or pass `--port`) to change the port. The server binds to `127.0.0.1` only. The older `MISSION_CONTROL_*` settings still work.

**Releasing:** bump the version and push the tag, for example `npm version 0.2.1 && git push origin main --follow-tags`. The *Release* workflow then lints, tests, builds and attaches `ruang.tgz` to a GitHub release, which the installer picks up. To also publish to npm, add an `NPM_TOKEN` repository secret.

## Pages

- **Agents**: the declared chain (Lead Agent → Lead Engineer → OpenCode) with profile, model and gateway state, plus any other Hermes profiles.
- **Office** (home page): the office fills the screen below the header. A HUD across the top shows crew active, gateways running, running/open tasks, the next cron run and (when any) failed CLI reads; chips link to their page. The **Panel** button opens one side panel with three tabs: **Crew** (crew snapshot and a clickable list of stations), **Stats** (statistics across every source, 7-day usage from `hermes insights`, the Kanban status breakdown, runtime and what is up next; tiles link to their pages) and **Activity** (unattributed session metadata and messaging channels). The **Tasks** and **Calendar** buttons open the Task Board or a month calendar of cron runs over the office, without leaving it (Esc or ✕ closes them; *Open full page* goes to the page). `#/dashboard` opens the Office.

  The view switches between **3D** (the default) and **2D**, remembered per browser; browsers without WebGL stay on 2D. The 3D view (three.js via React Three Fiber, loaded only when used) is an office of several rooms with an Indonesian touch:
  - the workspace: a parquet floor, desks with monitors, and a meeting area with gorengan (fried snacks) on the table
  - a lounge behind a glass partition, where the sofa faces a TV on the back wall
  - a game room through a door from the lounge: ping-pong, two arcade machines, a console corner with beanbags, and a karambol (carrom) board
  - a pantry with a galon (water-jug) dispenser
  - split ACs on the walls (outdoor units behind the building) and suspended cool-white LED office lights
  - the Merah Putih flag at the corner of the grounds
  - in the alley beside the building, out of the main view: a bakso (meatball soup) cart and a kopi keliling (coffee bike), each with its vendor

  It follows the theme: day in light mode, evening in dark mode, when the office lights, street lamps and cart lamps light up. Only procedural textures are used, with no image or model files. Drag to rotate, scroll to zoom, and pan with right-drag, two fingers, the arrow keys, or the **Geser** button (which makes a plain drag pan). Panning stays within the grounds, and **Reset view** returns to the starting view.

  Each agent has its own desk. An agent replying to a chat walks to the meeting table; one running a cron job, tools or a Kanban task sits at its desk with a speech bubble saying what it is doing. Agents walk along the aisle and use the entrance, never through furniture or walls. Idle agents do not just sit: every 32 seconds each one moves on to another stop, such as relaxing in the lounge, ping-pong, arcade games or the console in the game room, getting water from the galon, the kitchen, bakso on the cart's stools, coffee at the bike, or a stroll to the flag or the bookshelf. A dashed bubble says where they are. This wandering is decorative only (the same clock-based route for everyone), and the Idle state itself comes from the server. Click an agent for its detail dialog, with three tabs: **Overview** (state, task, provenance, freshness), **Folder** (that agent's own folder, read-only, as on the Folders page) and **Memory** (its SOUL.md, MEMORY.md, USER.md and context files).
- **Task Board**: Hermes Kanban in board order (triage → todo → scheduled → ready → running → blocked → review → done) with search, assignee filter and priority. Click a card for its full detail from `hermes kanban show <id> --json`: description, result or latest summary, workspace, branch, skills, model, timestamps, dependencies (clickable), runs, comments and activity. Free text is secret-redacted; only ids on the current board can be opened.
- **Calendar**: a month calendar of the cron runs of every agent (each job is labelled with its agent, and the calendar can be filtered by agent) (upcoming runs from today, repeating jobs, overdue runs and last-run outcomes, read from 5-field cron expressions and `every …` intervals, in the Hermes host's local time), plus the list of jobs with status, next run, overdue and last-run outcome. Paused jobs only show their last run.
- **Activity**: the 20 most recent sessions with search.
- **Memory**: per agent, what it carries into every session (following the Hermes memory and context-file docs):
  - `SOUL.md` (identity, system-prompt slot #1)
  - `memories/MEMORY.md` (agent notes) and `memories/USER.md` (user profile), split into their `§` entries, with a usage bar against the configured limit (defaults 2,200 / 1,375 chars from `memory.*` in `config.yaml`) and a warning above 80%
  - context files present in the profile (`HERMES.md`, `.hermes.md`, `AGENTS.override.md`, `AGENTS.md`, `CLAUDE.md`, `.cursorrules`)
  - the memory settings (enabled stores, `write_approval`, external provider)

  OpenCode shows its global `AGENTS.md`/`CLAUDE.md`. Entries are searchable. Everything is read through the Folders safety layer, so it is read-only, confined to the agent's folder and secret-redacted. `#/knowledge` opens this page.
- **Folders**: one folder per agent, and only that agent's folder: Lead Agent → `~/.hermes/profiles/default`, Lead Engineer → `~/.hermes/profiles/leadengineer`, OpenCode → `~/.opencode`. Browse sub-folders and view files read-only. See *Folders* below.
- **Logs**: tails of `hermes logs agent|gateway|errors` with level filter, search and follow mode, plus an audit of every command the server ran (the *Command audit* tab).

Navigation is a drawer, closed by default like a game menu: open it with the ☰ button or the **M** key, and close it with Esc, a click outside, or by choosing a page. A dot on ☰ flags failed CLI reads or stopped gateways. The header has one light/dark theme toggle (remembered per browser) and Refresh. All pages poll automatically, keep the last good data (marked stale) if a refresh fails, and have a manual refresh. "Refresh all" bypasses the 10-second server cache for anything older than 2 seconds. Pages are addressable by URL hash (for example `#/task-board`).

## Data and safety

The server uses only these fixed, read-only commands:
- `hermes profile list`, `hermes -p leadengineer gateway status`, `opencode --version`
- `hermes kanban list --json`, `hermes kanban show <id> --json` (task detail)
- `hermes -p <profile> cron list --all` for every profile in `hermes profile list` (Hermes keeps cron jobs per profile), `hermes sessions list --limit 20`, `hermes skills list --enabled-only`
- `hermes status --all`, `hermes insights --days 7`, `hermes logs <agent|gateway|errors> -n 200`
- for live Office activity: `hermes -p <default|leadengineer> logs agent -n 80 --since 3m` and `hermes -p <default|leadengineer> sessions list --limit 3`

How they run:
- Commands run with `NO_COLOR=1` and a wide `COLUMNS` so the plain-text formats parse reliably.
- The default gateway state is derived from `hermes profile list`; no separate default gateway command is run.
- Each command is executed with `execFile` and an 8-second process timeout. Its endpoint result is cached for 10 seconds (insights: 60 seconds; logs: 5 seconds), and concurrent requests share one in-flight read.
- Browser input never reaches a shell command.

Only normalized data is exposed:
- profile/model, gateway state, OpenCode version
- Kanban title/status and recognized cron fields
- session title/preview/last-active/parseable ID
- recognized enabled-skill table fields
- configured messaging-platform names with a generic configured/connected state, and an integer active-session count when it is safely recognized

Log lines are the one intentional exception to "no raw output". They are returned after two redaction passes: Hermes's own secret redaction, then a second pass by the server (API keys, bearer tokens, `key=value` secrets, bot tokens). Home-directory paths are shortened to `~`, and the `hermes logs` header line (which contains a path) is dropped. Cron last-run error text is never returned, only ok/failed.

Otherwise, raw CLI output, process details, paths, configuration, credentials, authentication, API keys, environment files, provider details and session databases are never read or returned. A failed source is rendered as `Not Available`; an unknown individual field is rendered as `Unknown`.

`/api/tasks`, `/api/calendar`, `/api/activity` and `/api/knowledge` each return a source availability state and refresh time:
- Task Board is read-only and does not expose mutations.
- Calendar is cron-only, so it intentionally excludes general events.
- Activity is limited to session-list metadata and does not synthesize events.
- Knowledge is a curated catalog of enabled skills recognized from Hermes's Rich table.

Empty source results remain available and show truthful empty states; unparseable output and command failures are shown as `Not Available`. Hermes write actions are intentionally not implemented.

## Office

`/api/office` is a read-only composition of the existing cached runtime, Kanban and activity reads. It has three fixed stations: Lead Agent (command desk), Lead Engineer (engineering desk) and OpenCode (build terminal). Their declared role, character palette, workstation and CSS pixel character anatomy are static metadata. The 2D view provides CSS-only Workspace and Lounge rooms: Workspace contains desks and collaboration details, and Lounge places idle characters beside the sofa and chairs. No image or art assets are used.

Office state is always one of `Idle`, `Working`, `Reviewing`, `Collaborating`, `Offline` or `Unknown`. The precedence is:
1. A direct station-bound `Stopped` gateway marks Lead Agent or Lead Engineer `Offline`.
2. A fresh, unexpired internal explicit-state overlay can declare `Working`, `Reviewing` or `Collaborating`.
3. A fresh Kanban task explicitly assigned to the station maps `running` to `Working` and `review` to `Reviewing`.
4. A fresh actor-attributed active session maps to `Collaborating`.
5. Otherwise, the managed-idle policy applies.

Managed Idle is a transparent server placement policy, not agent-reported presence. It resolves only when all of these hold:
- fresh runtime, Kanban and activity reads are available
- the station-bound gateway is not stopped
- there is no fresh explicit overlay
- Kanban has no agent-attributed running/review task
- activity has no agent-attributed active session

It places the station in Lounge and labels it `Idle · managed placement`. Any unavailable or stale required input leaves the station `Unknown`. Gateway `Running`, generic sessions, unassigned Kanban tasks and OpenCode version availability cannot independently create an active state; OpenCode version availability is explicitly not a state signal.

Current task and recent activity require actor attribution. The Office only shows a Kanban task when its explicit assignee matches the station aliases above. Hermes session-list metadata currently has no actor attribution, so the Activity panel labels it as unattributed session metadata and it is never assigned to a station. Failed task or activity sources keep the existing `Not Available` meaning: that is source availability, not an Office work state. Selecting a station opens an in-page, keyboard-accessible detail dialog with room, provenance and source freshness.

State placement is visualized without inventing work:
- `Working`, `Reviewing` and `Collaborating` are in Workspace.
- `Idle` is in Lounge.
- `Offline` is dimmed at its assigned workspace station.
- `Unknown` is shown at a labelled neutral Workspace presence position.

The crew snapshot counts declared stations, active work (`Working`/`Reviewing`/`Collaborating`), managed idle, offline and unknown separately. Gateway health (how many of the two station gateways report `Running`) is intentionally displayed as a separate metric. When a station has several Kanban tasks, the `running` one wins, then `review`, then the first open task.

`/api/channels` is a separate safe snapshot sourced only from the Messaging Platforms section and active-session count of `hermes status --all`; it never exposes unconfigured platforms or any other status content. The Office introduces no write endpoint, shell input or command beyond the fixed allowlist.

## Live activity in the Office

Every Hermes profile writes all of its work to its own `agent.log`: messaging replies (gateway), cron runs, tool calls and the agent loop. For the two station profiles, the server reads the last 3 minutes of that log and the profile's most recent session:

- Gateway message lines together with agent-loop or tool lines, or a session active in the last 3 minutes, become `Collaborating` ("Replying to a chat", at the meeting table).
- `cron.*` becomes `Working` ("Running a scheduled job"); `tools.*` becomes `Working` ("Using tools"); `agent`/`run_agent` becomes `Working` ("Working on a request").
- OpenCode is `Working` when a recent agent log line shows it being driven.

The precedence is:
1. explicit overlay
2. live activity (a running/review Kanban task, when present, labels that work)
3. stopped gateway (`Offline`)
4. Kanban task
5. managed `Idle` in the Lounge

Live work outranks a stopped gateway because CLI and cron work do not need it. Gateway polling noise and CLI housekeeping lines are ignored.

## Folders

Each agent resolves to its own folder:

| Agent | Folder |
|---|---|
| Lead Agent (`default`) | `<hermes root>/profiles/default`; only when that folder does not exist (stock Hermes layout), the Hermes root itself |
| Lead Engineer and other Hermes profiles | `<hermes root>/profiles/<name>` |
| OpenCode | `~/.opencode`, then `~/.config/opencode` (`RUANG_OPENCODE_DIR` overrides) |

The Hermes root follows Hermes's own rules (`HERMES_HOME`, default `~/.hermes`); `RUANG_HERMES_ROOT` overrides it.
- A non-default agent that resolves to the Hermes root, or to a folder another agent already owns, is shown as unavailable with the reason instead of being opened.
- When one agent's folder contains another's (the stock root holds `profiles/`), that sub-folder is hidden and cannot be read through the outer agent.
- Cards and the breadcrumb show the real path.

`/api/folders` lists the agents; `/api/folders/<agent>/list?path=` and `/api/folders/<agent>/file?path=` browse one folder. The safety rules:
- Every path is resolved (including symlinks) and must stay inside that agent's folder.
- The `hermes-agent` install, `.git`, virtualenvs and caches are hidden.
- Credential-bearing and database files (`.env*`, `auth.json`, keys and certificates, names containing token/secret/password/credential, `*.db`/SQLite files) are listed but never read.
- Text previews are capped at 256 KB and pass through the same secret redaction as logs. Binary files are not previewed.

**Troubleshooting "This folder could not be read".** Ruang reads folders as the user that runs it. If a profile folder belongs to another user or has mode `700` (for example it was created by a gateway started with `sudo`/systemd as root), the card shows "No read permission for <user>" and opening it explains which user was refused. Check with `ls -ld ~/.hermes/profiles/<name>`. Fix it by giving the folder back to your user (`sudo chown -R $USER:$USER ~/.hermes/profiles/<name>`) or granting read access (`sudo setfacl -R -m u:$USER:rX ~/.hermes/profiles/<name>`).
