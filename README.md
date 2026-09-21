# stark-bot

![CI](https://github.com/MacheroKiller/stark-bot/actions/workflows/ci.yml/badge.svg)

A lightweight WhatsApp bot built with [Baileys](https://github.com/WhiskeySockets/Baileys) and [Bun](https://bun.com/), backed by MongoDB for persistent group/user data. It's the successor to an earlier Next.js-based bot (`wpp-bot`, now deprecated) — rebuilt from scratch with a leaner runtime, a cleaner command architecture, and no framework overhead it didn't need.

## Features

- **WhatsApp connectivity** via Baileys, with automatic reconnection handling and QR-code pairing on first login.
- **Persistent storage** in MongoDB: groups are registered on join, and messages sent per user/group are tracked.
- **Group allowlist**: new groups start `pending` and stay inert until an OWNER approves or rejects them via DM — no group runs commands or gets counted until it's explicitly allowed in.
- **Owner role**: a fixed list of WhatsApp numbers (set via env, never in the database) that can approve/reject groups, and manage command access globally — the highest privilege level is never database-configurable, so it can't be granted by a bug or unauthorized DB access.
- **Per-group and global command configuration**: any group's admins can enable/disable individual commands or change their admin requirement for that group; the bot owner can additionally disable a command across every group at once — useful while testing changes.
- **Command system**: a simple, extensible command registry — each command is its own class implementing a shared interface, looked up via a `Map` for O(1) dispatch.
- **Safe destructive operations**: `/purge` and `/reset` require a two-step confirmation (dry-run, then `confirm`, with a 2-minute window) and respond over DM to the admin who ran them, never in the group itself. `/purge` also respects a cooldown after a recent `/reset`, so it can't wipe an entire group's counters in one pass.
- **Dev/prod isolation**: in development mode, the bot only responds in an explicit allowlist of test groups (`DEV_ALLOWED_GROUP_JIDS`), so a local instance can't collide with the production bot in real groups.
- **Structured logging** with level filtering and a JSON output mode, ready for production log aggregation.
- **Dockerized**: `Dockerfile` + `docker-compose.yml` for containerized deployment.
- **Unit tests** with Bun's built-in test runner, covering the database service layer, command dispatch, and shared utilities.
- **Admin role management**: group admins are synced automatically on join and kept up to date in real time, powering admin-only commands.
- **Self-documenting commands**: `/help` dynamically lists available commands, factoring in global and per-group configuration, and scoped to what the requesting user (member, admin, or owner) can actually run.

### Current commands

| Command                                                                       | Description                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/ping`                                                                       | Health check — replies "Pong!"                                                                                                                                                                                           |
| `/find [@mention]`                                                            | Shows a user's message count and ranking position in the group. Defaults to the sender if no one is mentioned.                                                                                                           |
| `/findtop <position>`                                                         | Shows whoever holds a given ranking position — e.g. `/findtop 1` returns the top sender.                                                                                                                                 |
| `/help`                                                                       | Lists available commands, dynamically scoped to global config, per-group overrides, and the requester's role.                                                                                                            |
| `/job`                                                                        | Shows a list of places to look for job opportunities.                                                                                                                                                                    |
| `/top`                                                                        | Shows the top message senders in the current group. **Admin-only.**                                                                                                                                                      |
| `/reset`                                                                      | Resets the message counter (`totalMessagesSent`) for every user in the group. **Admin-only, requires `/reset confirm`.** Responses go to the admin's DM.                                                                 |
| `/ban [@mention]`                                                             | Removes a user from the group. **Admin-only** — requires the bot itself to be a group admin.                                                                                                                             |
| `/purge`                                                                      | Removes every user with fewer than 5 messages sent, as an inactivity cleanup. **Admin-only, requires `/purge confirm`.** Responses go to the admin's DM; blocked for a cooldown period after a recent `/reset`.          |
| `/setmessages @mention <n>`                                                   | Manually sets a user's message counter — useful to shield someone from `/purge`. **Admin-only.**                                                                                                                         |
| `/approve <groupJid>` / `/reject <groupJid>`                                  | Approves or rejects a group pending registration. **Owner-only**, sent via DM.                                                                                                                                           |
| `/groupconfig <groupJid> <command> <enable\|disable> [requiresAdmin\|public]` | Configures a command's availability and admin requirement for one specific group. **Owner-only.**                                                                                                                        |
| `/globaldisable <command> [reason]` / `/globalenable <command>`               | Disables or re-enables a command across every group at once. **Owner-only.** A small set of commands that manage the bot itself is exempt from ever being disabled this way, so the owner can never lock themselves out. |

### Group approval workflow

Every group starts in a `pending` state the moment the bot is added to it — it stays functionally inert (no message counting, one "not authorized" notice per command attempt) until an owner explicitly approves it:

1. The bot is added to a group → the group is created as `pending`, and every configured OWNER gets a DM with the group's name, JID, and participant count.
2. An owner runs `/approve <groupJid>` or `/reject <groupJid>` from their own DM with the bot.
3. On approval, the group is marked `approved` and gets a welcome message + `/help`. On rejection, it's marked `rejected` and stays silent from then on.

### Admin role management

Admin status is tracked per user/group in MongoDB (`isAdmin` field) and kept in sync automatically, with no manual setup required:

- **On group join / metadata refresh** (`groups.upsert`): the bot reads the group's participant list and marks existing admins.
- **On promote/demote** (`group-participants.update`): admin status is updated in real time as the group's admin list changes.
- **On removal** (`group-participants.update` with `action: "remove"`): the removed user's data is deleted from the database — this covers `/ban`, `/purge`, and manual kicks from the WhatsApp app alike, since they all funnel through the same event.

Commands can be restricted to admins by setting `requiresAdmin: true` on the handler — the check runs centrally in `HandleCommand`, so individual commands don't need to implement authorization logic themselves. A command marked `locked: true` has its admin requirement fixed permanently — no per-group override can turn a locked command public, which is enforced for anything destructive (`/ban`, `/purge`, `/reset`, `/setmessages`, `/groupconfig`).

## Architecture

```
src/
├── main.ts                       # Entry point
├── bootstrap.ts                   # App wiring: DB init, command config seeding, WhatsApp client init
├── commands/
│   ├── command.registry.ts        # List of active command handlers
│   ├── handle-command.ts          # Parses incoming text, dispatches to the right handler
│   ├── interfaces/                 # CommandHandler contract (requiresAdmin, requiresOwner, locked)
│   ├── enums/                      # Command string constants
│   ├── ping/ find/ findTop/ top/ job/
│   ├── ban/ purge/ reset/ setMessages/
│   ├── help/
│   └── approve/ reject/ groupConfig/ globalDisable/ globalEnable/   # owner-only
├── core/whatsapp/
│   ├── client.ts                   # Baileys socket lifecycle (connect/reconnect)
│   ├── handlers/                   # connection, messages.upsert, groups.upsert, group-participants.update
│   └── send-message.ts             # Outbound message helper (typing simulation, mentions)
├── database/
│   ├── mongo.ts                    # Lazily-initialized Mongo client/db
│   ├── models/                     # Typed collection accessors
│   ├── services/                   # Business logic (find-or-create, counters, ranking, group/command config)
│   │   ├── *.service.ts
│   │   └── *.service.test.ts       # Unit tests, colocated with each service
│   └── interfaces/
└── shared/utils/
    ├── jid.ts                       # WhatsApp JID parsing helpers
    ├── owner.ts                     # OWNER_WHATSAPP_IDS parsing/lookup
    ├── env.ts                       # Dev/prod group isolation
    ├── pendingConfirmationStore.ts  # In-memory, TTL'd confirmation state for /purge and /reset
    └── logger.ts                    # Leveled, namespaced logger
```

## Prerequisites

- [Bun](https://bun.com/) v1.3+
- A MongoDB instance (local or hosted — e.g. MongoDB Atlas free tier), unless running via Docker Compose (see below)
- A WhatsApp account to link as the bot

## Installation

```bash
git clone https://github.com/MacheroKiller/stark-bot.git
cd stark-bot
bun install
```

## Configuration

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

```env
DB_URI=mongodb://localhost:27017
DB_NAME=stark_bot
WHATSAPP_SESSION_ID=stark-session
LOG_LEVEL=info
OWNER_WHATSAPP_IDS=573000000000@s.whatsapp.net
BOT_ENV=production
DEV_ALLOWED_GROUP_JIDS=
```

`OWNER_WHATSAPP_IDS` accepts a comma-separated list. `DEV_ALLOWED_GROUP_JIDS` only matters when `BOT_ENV=development` — leave it empty in production.

## Running the bot

### Locally

```bash
bun run start
```

On first run, a QR code is printed to the terminal — scan it from WhatsApp (**Linked Devices → Link a Device**) to authenticate. The session is then persisted under `auth/<WHATSAPP_SESSION_ID>/`, so you won't need to re-scan on subsequent runs unless the session is invalidated.

### With Docker

```bash
docker compose up -d
```

This spins up the bot alongside a MongoDB container. Check logs for the QR code on first run:

```bash
docker compose logs -f
```

## Running tests

```bash
bun test
```

Tests are colocated with the code they cover (e.g. `user.service.ts` next to `user.service.test.ts`). Current coverage:

- Database services (`UserService`, `GroupService`, `GlobalCommandConfigService`)
- Command dispatch (`handle-command.test.ts`), including global config, per-group overrides, and owner/admin resolution
- Shared utilities (`jid.test.ts`, `owner.test.ts`, `env.test.ts`, `pendingConfirmationStore.test.ts`)

Individual command handlers (the `*.command.ts` classes) and the raw Baileys event listeners are intentionally left untested for now — they're thin orchestration over already-tested services.

CI runs on every push via GitHub Actions: `bun test` plus a `tsc --noEmit` type-check, so a red badge above means either a failing test or a type error, not deployment status.

## Roadmap

- [x] **Dockerfile** for containerized deployment
- [x] **`.env.example`** template
- [x] **Unit tests** (`bun test`) for database services, command dispatch, and shared utilities
- [x] **Admin role management** (sync on join and promote/demote, cascade delete on removal)
- [x] **Deploy to Railway** to keep the bot running 24/7
- [x] **`/help` command**, now dynamic based on global/per-group config and requester role
- [x] **Group allowlist** — pending/approved/rejected, owner approval via DM
- [x] **Per-group and global command configuration** (`/groupconfig`, `/globaldisable`, `/globalenable`)
- [x] **Safe `/purge` and `/reset`** — two-step confirmation, DM-only responses, purge cooldown after reset
- [x] **Dev/prod isolation** so a local bot instance can't respond in production groups
- [ ] Unit tests for individual command handlers
- [ ] `sendMessageToGroup` should report send failures back to the caller instead of only logging them
- [ ] Centralized environment validation at startup instead of failing on first DB access
- [ ] **Funas/history system** — per-group moderation log (`/addfuna`, `/funa`), designed but not yet implemented
- [ ] **LLM integration** (Gemini) for a subset of groups, with an automated weekly summary report — requires capturing message content first (currently only a per-user counter is stored), plus a retention/privacy decision before that's implemented
- [ ] **Admin dashboard** — a small web frontend over the same backend/MongoDB, with WhatsApp-verified login (a one-time code sent to the admin's own chat), for managing groups and command config without touching the database directly

## Built with

- [Bun](https://bun.com/) — JavaScript runtime and test runner
- [Baileys](https://github.com/WhiskeySockets/Baileys) — WhatsApp Web API client
- [MongoDB](https://www.mongodb.com/) (native driver, no ORM)
- [Pino](https://getpino.io/) — used internally by Baileys for its own logging
- [Docker](https://www.docker.com/) — containerized deployment

## License

MIT — see [LICENSE](LICENSE).
