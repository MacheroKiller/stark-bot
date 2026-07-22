# stark-bot

A lightweight WhatsApp bot built with [Baileys](https://github.com/WhiskeySockets/Baileys) and [Bun](https://bun.com/), backed by MongoDB for persistent group/user data. It's the successor to an earlier Next.js-based bot (`wpp-bot`, now deprecated) — rebuilt from scratch with a leaner runtime, a cleaner command architecture, and no framework overhead it didn't need.

## Features

- **WhatsApp connectivity** via Baileys, with automatic reconnection handling and QR-code pairing on first login.
- **Persistent storage** in MongoDB: groups are auto-registered on join, and messages sent per user/group are tracked.
- **Command system**: a simple, extensible command registry — each command is its own class implementing a shared interface, looked up via a `Map` for O(1) dispatch.
- **Structured logging** with level filtering and a JSON output mode, ready for production log aggregation.

### Current commands

| Command | Description |
|---|---|
| `/ping` | Health check — replies "Pong!" |
| `/top` | Shows the top message senders in the current group |

## Architecture

```
src/
├── main.ts                     # Entry point
├── bootstrap.ts                 # App wiring: DB + WhatsApp client init
├── commands/
│   ├── command.registry.ts      # List of active command handlers
│   ├── handle-command.ts        # Parses incoming text, dispatches to the right handler
│   ├── interfaces/               # CommandHandler contract
│   ├── enums/                    # Command string constants
│   ├── ping/
│   └── top/
├── core/whatsapp/
│   ├── client.ts                 # Baileys socket lifecycle (connect/reconnect)
│   ├── handlers/                 # connection.update and messages.upsert listeners
│   └── send-message.ts           # Outbound message helper (typing simulation, mentions)
├── database/
│   ├── mongo.ts                  # Lazily-initialized Mongo client/db
│   ├── models/                   # Typed collection accessors
│   ├── services/                 # Business logic (find-or-create, counters, top-N)
│   └── interfaces/
└── shared/utils/
    ├── jid.ts                     # WhatsApp JID parsing helpers
    └── logger.ts                  # Leveled, namespaced logger
```

## Prerequisites

- [Bun](https://bun.com/) v1.3+
- A MongoDB instance (local or hosted — e.g. MongoDB Atlas free tier)
- A WhatsApp account to link as the bot

## Installation

```bash
git clone https://github.com/MacheroKiller/stark-bot.git
cd stark-bot
bun install
```

## Configuration

Create a `.env` file in the project root:

```env
DB_URI=mongodb://localhost:27017
DB_NAME=stark_bot
WHATSAPP_SESSION_ID=stark-session
LOG_LEVEL=info
```

## Running the bot

```bash
bun run start
```

On first run, a QR code is printed to the terminal — scan it from WhatsApp (**Linked Devices → Link a Device**) to authenticate. The session is then persisted under `auth/<WHATSAPP_SESSION_ID>/`, so you won't need to re-scan on subsequent runs unless the session is invalidated.

## Roadmap

- [ ] **Dockerfile** for containerized deployment
- [ ] **Deploy to Railway** to keep the bot running 24/7
- [ ] **`/help` command** listing all available commands and their descriptions
- [ ] More commands (TBD based on actual group usage/needs)
- [ ] Unit tests (`bun test`) for command handlers and database services
- [ ] `.env.example` template
- [ ] Centralized environment validation at startup instead of failing on first DB access

## Built with

- [Bun](https://bun.com/) — JavaScript runtime
- [Baileys](https://github.com/WhiskeySockets/Baileys) — WhatsApp Web API client
- [MongoDB](https://www.mongodb.com/) (native driver, no ORM)
- [Pino](https://getpino.io/) — used internally by Baileys for its own logging

## License

MIT — see [LICENSE](LICENSE).