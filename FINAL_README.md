# TG Local LLM

A Telegram bot that routes your messages to a locally running LLM via Ollama, with persistent per-chat conversation history and automatic rolling summarization to keep the context window manageable.

```
You → Telegram → Bot → Ollama (local LLM) → Bot → Telegram → You
```

## Prerequisites

- Ollama installed: `curl -fsSL https://ollama.com/install.sh | sh`
- A model pulled, e.g. `ollama run qwen2.5:7b`
- Node.js v22+
- A Telegram bot token from [@BotFather](https://t.me/BotFather)

## Project structure

```
src/
  config.ts   — loads and validates environment variables
  llm.ts      — Ollama API client (native fetch, no SDK)
  bot.ts      — creates the Telegram bot with polling
  handler.ts  — wires messages and commands to the LLM and context
  context.ts  — per-chat history storage and summarization helpers
  db.ts       — SQLite setup and schema migrations
  logger.ts   — lightweight structured logger
  index.ts    — entry point, graceful shutdown
prompts/
  summarize.md  — prompt used to generate/update the rolling summary
data/
  chats_history/history.db  — SQLite database (auto-created, gitignored)
```

## Steps to run

### Local

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set your `TELEGRAM_API_TOKEN`. All other values have sensible defaults.

3. **Start Ollama with your model**

   ```bash
   ollama run qwen2.5:7b
   ```

4. **Run the bot**

   ```bash
   npm start
   ```

   The bot uses polling — no public URL or webhook required.

5. **Optional: build for production**

   ```bash
   npm run build
   npm run start:prod
   ```

### Docker

```bash
cp .env.example .env
# edit .env — set TELEGRAM_API_TOKEN, keep OLLAMA_URL=http://host.docker.internal:11434
docker compose up -d
```

Ollama must be running on the host. `host.docker.internal` resolves automatically on macOS/Windows; on Linux it is wired via `extra_hosts` in `docker-compose.yml`. The SQLite database is persisted in `./data` on the host via a volume mount.

## Configuration

All settings are controlled via environment variables:

| Variable | Default | Description |
|---|---|---|
| `TELEGRAM_API_TOKEN` | *(required)* | Bot token from @BotFather |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama API base URL |
| `OLLAMA_MODEL` | `qwen2.5:7b` | Model name to use |
| `CONTEXT_SYSTEM_PROMPT` | *(empty)* | System prompt prepended to every LLM request |
| `MEM_THRESHOLD` | `15` | Total messages stored before rolling summarization triggers |
| `MEM_SHORT_TERM_SIZE` | `5` | Number of recent messages to keep as raw text after summarization |
| `DB_PATH` | `./data/chats_history` | Directory for the SQLite database |

## Bot commands

| Command | Description |
|---|---|
| `/history` | Show the current context: the rolling summary (if any) followed by the recent raw messages |
| `/summarize` | Force-summarize immediately, regardless of the threshold |
| `/clear` | Wipe the entire conversation history for this chat |

## How context and summarization work

Each chat's history is stored in SQLite. The table holds at most one `summary` row and up to `MEM_THRESHOLD` regular message rows per chat.

**Rolling summarization** triggers automatically whenever the total row count exceeds `MEM_THRESHOLD`:

1. The history is split at `total - MEM_SHORT_TERM_SIZE`:
   - **Segment A** (archive) — all messages except the most recent `MEM_SHORT_TERM_SIZE`
   - **Segment B** (fresh) — the most recent `MEM_SHORT_TERM_SIZE` messages, kept as raw text
2. The existing summary (if any) plus Segment A are sent to the LLM with `prompts/summarize.md` to produce a new, updated summary.
3. The entire history is replaced atomically: `[new summary, Segment B messages]`.

The result is that the bot always has at most one summary row (covering all older context) and a small window of recent raw messages. The summarize prompt can be edited in `prompts/summarize.md` without redeploying.
