# stark-bot

![CI](https://github.com/MacheroKiller/stark-bot/actions/workflows/ci.yml/badge.svg)

A lightweight WhatsApp bot built with [Baileys](https://github.com/WhiskeySockets/Baileys) and [Bun](https://bun.com/), backed by MongoDB for persistent group/user data. It's the successor to an earlier Next.js-based bot (`wpp-bot`, now deprecated) — rebuilt from scratch with a leaner runtime, a cleaner command architecture, and no framework overhead it didn't need.

## Features

- **WhatsApp connectivity** via Baileys, with automatic reconnection handling and QR-code pairing on first login.
- **Persistent storage** in MongoDB: groups are auto-registered on join, and messages sent per user/group are tracked.
- **Command system**: a simple, extensible command registry — each command is its own class implementing a shared interface, looked up via a `Map` for O(1) dispatch.
- **Structured logging** with level filtering and a JSON output mode, ready for production log aggregation.
- **Dockerized**: `Dockerfile` + `docker-compose.yml` for containerized deployment.
- **Unit tests** with Bun's built-in test runner, covering the database service layer, command dispatch, and JID parsing utilities.
- **Admin role management**: group admins are synced automatically on join and kept up to date in real time, powering admin-only commands.

### Current commands

| Command | Description |
|---|---|
| `/ping` | Health check — replies "Pong!" |
| `/top` | Shows the top message senders in the current group |
| `/find [@mention]` | Shows a user's message count and ranking position in the group. Defaults to the sender if no one is mentioned. |
| `/ban [@mention]` | Removes a user from the group. **Admin-only** — requires the bot itself to be a group admin. |

### Admin role management

Admin status is tracked per user/group in MongoDB (`isAdmin` field) and kept in sync automatically, with no manual setup required:

- **On group join / metadata refresh** (`groups.upsert`): the bot reads the group's participant list and marks existing admins.
- **On promote/demote** (`group-participants.update`): admin status is updated in real time as the group's admin list changes.

Commands can be restricted to admins by setting `requiresAdmin: true` on the handler — the check runs centrally in `HandleCommand`, so individual commands don't need to implement authorization logic themselves.

## Architecture

```
src/
├── main.ts                     # Entry point
├── bootstrap.ts                 # App wiring: DB + WhatsApp client init
├── commands/
│   ├── command.registry.ts      # List of active command handlers
│   ├── handle-command.ts        # Parses incoming text, dispatches to the right handler
│   ├── interfaces/               # CommandHandler contract (incl. requiresAdmin)
│   ├── enums/                    # Command string constants
│   ├── ping/
│   ├── top/
│   ├── find/
│   └── ban/
├── core/whatsapp/
│   ├── client.ts                 # Baileys socket lifecycle (connect/reconnect)
│   ├── handlers/                 # messages.upsert, groups.upsert, group-participants.update listeners
│   └── send-message.ts           # Outbound message helper (typing simulation, mentions)
├── database/
│   ├── mongo.ts                  # Lazily-initialized Mongo client/db
│   ├── models/                   # Typed collection accessors
│   ├── services/                 # Business logic (find-or-create, counters, top-N, ranking)
│   │   ├── *.service.ts
│   │   └── *.service.test.ts     # Unit tests, colocated with each service
│   └── interfaces/
└── shared/utils/
    ├── jid.ts                     # WhatsApp JID parsing helpers
    └── logger.ts                  # Leveled, namespaced logger
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
```

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

- Database services (`UserService`, `GroupService`)
- Command dispatch (`handle-command.test.ts`)
- JID parsing utilities (`jid.test.ts`)

Individual command handlers (`FindCommand`, `BanCommand`) are next in line.

## Roadmap

- [x] **Dockerfile** for containerized deployment
- [x] **`.env.example`** template
- [x] **Unit tests** (`bun test`) for database services, command dispatch, and JID utilities
- [x] **Admin role management** (`/ban`, admin sync on join and promote/demote)
- [x] **Deploy to Railway** to keep the bot running 24/7
- [ ] Unit tests for individual command handlers (`FindCommand`, `BanCommand`)
- [ ] **`/help` command** listing all available commands and their descriptions
- [ ] More commands (TBD based on actual group usage/needs)
- [ ] Centralized environment validation at startup instead of failing on first DB access

## Built with

- [Bun](https://bun.com/) — JavaScript runtime and test runner
- [Baileys](https://github.com/WhiskeySockets/Baileys) — WhatsApp Web API client
- [MongoDB](https://www.mongodb.com/) (native driver, no ORM)
- [Pino](https://getpino.io/) — used internally by Baileys for its own logging
- [Docker](https://www.docker.com/) — containerized deployment

## License

MIT — see [LICENSE](LICENSE).
