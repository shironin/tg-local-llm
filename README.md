# TG Local LLM — Architecture Evolution

## Overview

A Telegram bot running a local LLM (via Ollama) with an agentic tool-use loop. This branch documents the evolution of the codebase from a flat single-layer structure into a modular monolith with an event-driven communication layer.

---

## Part 1 — Modular Monolith

The original code had all concerns mixed together: history access, LLM calls, summarization logic, and Telegram routing were all tangled in a single handler file with no clear boundaries.

### Module Structure

```
src/
  index.ts              — startup: wires subscriptions, creates bot
  bot.ts                — Telegram bot creation
  handler.ts            — thin routing layer (Telegram I/O only)
  db.ts                 — shared SQLite infrastructure
  config.ts
  logger.ts
  events/               — in-memory event bus
  modules/
    users/              — user identity and persistence
    history/            — conversation storage and retrieval
    chat/               — LLM orchestration, agent loop, summarization
  tools/                — agent tool implementations
```

### Module Responsibilities

**`users`** — maps a Telegram `chatId` to an internal `userId`. Handles first-seen user creation. No other module stores or looks up users directly.

**`history`** — owns all reads and writes to the `chat_history` table. Exposes a service interface: `addMessage`, `getHistory`, `getRows`, `clearHistory`, `performRollingSummarize`. Other modules never touch the DB directly for history.

**`chat`** — orchestrates the full response cycle: saves the user message, runs the agentic loop (`runAgent`), triggers rolling summarization when the context grows too large, saves the assistant reply. Exposes a single entry point: `processMessage(userId, text)`.

### Communication Rules

Modules communicate only through their public `index.ts` interface — never by importing internal files from another module. The `handler.ts` layer only imports from module index files and never touches `db.ts` or any module internals directly.

---

## Part 2 — Event System

Direct calls between modules were partially replaced with an in-memory event bus, removing coupling where the calling side doesn't need to wait for the result.

### Events

| Event | Published by | Payload |
|---|---|---|
| `UserCreated` | `users` module | `{ userId, telegramId }` |
| `MessageReceived` | `chat` module | `{ userId, role, content }` |
| `ResponseGenerated` | `chat` module | `{ userId, content }` |

### Implementation

Built on Node.js's built-in `EventEmitter`, wrapped in a typed `AppEventEmitter` class that enforces payload types per event name via `AppEventMap`. A singleton `eventBus` is exported from `src/events/`.

Subscriptions are registered once at startup in `index.ts` before the bot starts polling, keeping the wiring visible in one place.

### Design Note

The `chat` module still calls `addMessage` directly before emitting `MessageReceived` — this is intentional. The agent reads history synchronously during its loop, so the user message must be persisted before `runAgent` is called. Events are used for broadcasting after the fact, not as a replacement for operations the current request depends on.

---

## Architecture Diagrams

### Request Flow

```
Telegram
   │
   ▼
handler.ts
   ├── getOrCreateUser() ──────────────────► modules/users
   ├── processMessage() ───────────────────► modules/chat
   │                                              │
   │                                              └── addMessage() ──► modules/history
   │
   ├── getHistory() ───────────────────────────────────────────────► modules/history
   └── clearHistory() ─────────────────────────────────────────────► modules/history
```

### Event Flow

```
modules/users  ──── UserCreated ───────────────────────► eventBus
modules/chat   ──── MessageReceived ───────────────────► eventBus
modules/chat   ──── ResponseGenerated ─────────────────► eventBus
                                                             │
                                                             ▼
                                                  history/subscriptions
```

### modules/chat internals

```
modules/chat
   ├── llm.ts         (Ollama API calls with retry)
   ├── agent.ts       (Thought-Action-Observation loop)
   └── summarizer.ts  (rolling context compression)
```
