# Mission Control

Read-only Mission Control MVP for the local Hermes and OpenCode runtime.

## Run

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal. The API runs only on `127.0.0.1:3001`, and the UI proxies `/api` requests to it. It is not reachable from non-loopback network interfaces.

```bash
npm run lint
npm test
npm run build
npm start
```

## Data and safety

The server uses only these fixed, read-only commands: `hermes profile list`, `hermes -p leadengineer gateway status`, `opencode --version`, `hermes kanban list --json`, `hermes cron list --all`, `hermes sessions list --limit 20`, `hermes skills list --enabled-only`, and `hermes status --all`. The default gateway state is derived from `hermes profile list`; no separate default gateway command is run. Each command is executed with `execFile`, has an 8-second process timeout, and its endpoint result is cached for 10 seconds. Browser input never reaches a shell command.

Only normalized profile/model, gateway state, OpenCode version, Kanban title/status, recognized cron fields, session title/preview/last-active/parseable ID, recognized enabled-skill table fields, and configured messaging-platform names with a generic configured/connected state are exposed. The channels source may also expose an integer active-session count when it is safely recognized. Raw CLI output, process details, paths, configuration, credentials, authentication, API keys, environment files, provider details, and session databases are never read or returned. A failed source is rendered as `Not Available`; an unknown individual field is rendered as `Unknown`.

`/api/tasks`, `/api/calendar`, `/api/activity`, and `/api/knowledge` each return a source availability state and refresh time. Task Board is read-only and does not expose mutations. Calendar is cron-only, so it intentionally excludes general events. Activity is limited to session-list metadata and does not synthesize events. Knowledge is a curated catalog of enabled skills recognized from Hermes's Rich table. Empty source results remain available and show truthful empty states; unparseable output and command failures are shown as `Not Available`. Hermes write actions are intentionally not implemented.

## Office

`/api/office` is a read-only composition of the existing cached runtime, Kanban, and activity reads. It has three fixed stations: Lead Agent (command desk), Lead Engineer (engineering desk), and OpenCode (build terminal). Their declared role, character palette, workstation, and CSS pixel character anatomy are static metadata. The Visual Office provides CSS-only Workspace and Lounge rooms through an extensible room configuration. Workspace contains desks and collaboration details; Lounge places idle characters beside the sofa and chairs. No image or art assets are used.

Office state is always one of `Idle`, `Working`, `Reviewing`, `Collaborating`, `Offline`, or `Unknown`. The precedence is: a direct station-bound `Stopped` gateway marks Lead Agent or Lead Engineer `Offline`; then a fresh, unexpired internal Mission Control explicit-state overlay can declare `Working`, `Reviewing`, or `Collaborating`; then a fresh Kanban task explicitly assigned to the station maps `running` to `Working` and `review` to `Reviewing`; then a fresh actor-attributed active session maps to `Collaborating`; then the managed-idle policy applies.

Managed Idle is a transparent Mission Control placement policy, not agent-reported presence. It resolves only when fresh runtime, Kanban, and activity reads are available; the station-bound gateway is not stopped; there is no fresh explicit overlay; Kanban has no agent-attributed running/review task; and activity has no agent-attributed active session. It places the station in Lounge and labels it `Idle · managed placement`. Any unavailable or stale required input leaves the station `Unknown`. Gateway `Running`, generic sessions, unassigned Kanban tasks, and OpenCode version availability cannot independently create an active state. OpenCode version availability is explicitly not a state signal.

Current task and recent activity require actor attribution. The Office only shows a Kanban task when its explicit assignee matches the station aliases above. Hermes session-list metadata currently has no actor attribution, so the compact Live Activity panel labels it as unattributed session metadata and it is never assigned to a station. Failed task or activity sources retain the existing `Not Available` meaning; `Not Available` is source availability, not an Office work state. Selecting a station opens an in-page, keyboard-accessible detail dialog with room, provenance, and source freshness.

State placement is visualized without inventing work: `Working`, `Reviewing`, and `Collaborating` are in Workspace; `Idle` is in Lounge; `Offline` is dimmed at its assigned workspace station; and `Unknown` is shown at a labelled neutral Workspace presence position. The crew snapshot counts declared stations, active work (`Working`/`Reviewing`/`Collaborating`), managed idle, offline, and unknown separately. Gateway reachability is intentionally displayed as a separate health metric. `/api/channels` is a separate safe snapshot sourced only from the Messaging Platforms section and active-session count of `hermes status --all`; it never exposes unconfigured platforms or any other status content. The Office introduces no write endpoint, shell input, or command beyond the fixed allowlist.
