# TG Local LLM Agent

A Telegram bot powered by a local LLM (via Ollama) that operates as an autonomous agent. It thinks step-by-step, uses tools, and maintains per-chat conversation history with rolling summarization.

```
You → Telegram → Agent loop (Thought → Action → Observation) → Telegram → You
                      ↕               ↕
                   Ollama          Tools (search, files, math...)
```

## Prerequisites

- [Ollama](https://ollama.com) running with a model: `ollama run qwen3.5:4b`
- Docker + Docker Compose
- A Telegram bot token from [@BotFather](https://t.me/BotFather)

## Project structure

```
src/
  index.ts          — entry point, graceful shutdown
  config.ts         — loads and validates environment variables
  bot.ts            — Telegram bot setup (polling)
  handler.ts        — routes messages, manages summarization
  agent.ts          — Thought → Action → Observation loop
  llm.ts            — Ollama API client with retry and timeout
  context.ts        — per-chat history (DB-backed)
  db.ts             — SQLite setup via better-sqlite3
  logger.ts         — structured context/summary logger

  tools/
    registry.ts     — tool map and description builder
    resolvePath.ts  — path resolver enforcing AGENT_WORKDIR boundary
    calculator.ts   — safe math expression evaluator
    fileInfo.ts     — line/word count for a file
    listFiles.ts    — list directory contents
    findFiles.ts    — recursive file/folder search by name pattern
    readFile.ts     — read file content
    writeFile.ts    — write file (creates missing dirs)
    editFile.ts     — replace text in file or append to it
    createDir.ts    — create directory
    webSearch.ts    — web search via SearXNG JSON API
    fetchUrl.ts     — fetch URL and return readable text

prompts/
  system-prompt-simplified.md  — active agent system prompt
  summarize-simplified.md      — summarization prompt

docker/
  bot/Dockerfile
  searxng/settings.yml         — SearXNG config (engines, JSON format)
  searxng/limiter.toml

llm_work_files/                — agent file workspace (AGENT_WORKDIR)
```

## Steps to run

**1. Clone and install dependencies**

```bash
npm install
```

**2. Configure environment**

```bash
cp .env.example .env
```

Edit `.env` and fill in the required values:

| Variable | Required | Description |
|---|---|---|
| `TELEGRAM_API_TOKEN` | yes | Token from @BotFather |
| `OLLAMA_URL` | no | Default: `http://host.docker.internal:11434` |
| `OLLAMA_MODEL` | no | Default: `qwen2.5:7b` |
| `SEARXNG_SECRET_KEY` | yes | Any random string, e.g. `openssl rand -hex 32` |
| `AGENT_WORKDIR` | no | Directory the agent can read/write. Default: `/llm_work_files` |
| `AGENT_MAX_STEPS` | no | Max reasoning steps per message. Default: `6` |
| `LLM_TIMEOUT_MS` | no | Ollama timeout for agent calls. Default: `300000` (5 min) |
| `LLM_SUMMARIZE_TIMEOUT_MS` | no | Ollama timeout for summarization. Default: `120000` (2 min) |
| `MEM_THRESHOLD` | no | Messages before summarization triggers. Default: `20` |
| `MEM_SHORT_TERM_SIZE` | no | Recent messages to keep unsummarized. Default: `5` |

**3. Create the agent workspace folder**

```bash
mkdir -p llm_work_files
```

**4. Start the stack**

```bash
docker compose up --build
```

This starts two containers: the bot and a local SearXNG search instance.

## Bot commands

| Command | Description |
|---|---|
| `/history` | Show current conversation context |
| `/summarize` | Force-summarize conversation now |
| `/clear` | Clear conversation history |

## Available agent tools

| Tool | Description |
|---|---|
| `calculator` | Evaluate math expressions |
| `get_file_info` | Line/word count of a file |
| `list_files` | List directory contents |
| `find_files` | Recursive search by filename pattern |
| `read_file` | Read file content |
| `write_file` | Create/overwrite a file |
| `edit_file` | Replace text in a file or append to it |
| `create_dir` | Create a directory |
| `web_search` | Search the web via SearXNG |
| `fetch_url` | Fetch a URL and return readable text |

---

# Current task thoughts

### Где агент ошибался?

**`final_answer` as a tool call.**
The most frequent mistake. Instead of outputting `{"final_answer": "..."}`, the LLM would emit `{"action": "final_answer", "args": {"answer": "..."}}` — treating the exit format as just another tool to invoke. Required a fix at both layers: an explicit rule in the prompt and a silent code-level intercept.

**`action: null`.**
When the model had the answer but didn't know how to exit the loop, it set `action` to JSON `null`. Same symptom, different shape. Fixed with a nudge message sent back into the loop.

**Not following up `web_search` with `fetch_url`.**
The agent found URLs but didn't visit them — responding "I cannot determine the date" while holding a direct link to the answer. Solved by adding `fetch_url` and making its description explicitly say *"Use after web_search to read a result."*

**Writing files outside `AGENT_WORKDIR`.**
Created `/bye.md` at the filesystem root instead of the working directory. No boundary existed until `resolvePath` was updated to throw `Access denied` for any path escaping `AGENT_WORKDIR`.

**Brittle HTML scraping.**
The original DuckDuckGo scraper returned HTTP 200 with zero results because the regex didn't match the actual HTML structure. Replaced entirely with SearXNG running as a Docker service with a clean JSON API.

---

### Что оказалось самым сложным?

**The think/answer boundary.**
The model didn't know when to stop. Without a clear exit condition the loop produced `null → null → null` or repeated the same tool call with identical arguments forever. Both the prompt and the code needed guards.

**JSON reliability.**
Qwen regularly wrapped responses in ` ```json ``` ` fences — required `stripCodeFences`. Then invalid JSON — required a retry asking the model to fix it. Then `null` in fields. Each failure mode needed its own handler.

**The search infrastructure.**
Direct DuckDuckGo scraping looked simple but never worked reliably in practice. SearXNG required a new Docker service, a custom `settings.yml`, debugging three engines (`wikidata`, `ahmia`, `torch`) that failed on `init()` regardless of `disabled: true`, and discovering that `~` is not expanded by Docker Compose in volume paths.

---

### Как вы "направляли" его поведение?

**Through code, not just the prompt:**
- Intercept `action === 'final_answer'` → silently extract the answer from args
- Intercept `action === null` → send a correction message and `continue` the loop
- JSON retry loop — one re-ask before giving up
- `resolvePath` with hard boundary — the LLM receives `Error: Access denied` and self-corrects

**Through structured logging:**
Every loop iteration prints a single block with Thought / Action / Observation. This made failure patterns immediately visible (`null(null)`, `final_answer({...})`) so fixes could be targeted rather than speculative.

---

### Что пришлось менять в prompt?

| Before | After | Reason |
|---|---|---|
| Detailed sections with markdown headers | Caveman style, ~120 tokens | Qwen 3.5:4b was slow on a long prompt |
| `- **Never null**` in Constraints | `Action never null. If know answer, use final_answer NOW.` | Model ignored polite rules |
| `### If you have the final answer:` | `Know answer → output this (NO action, NO thought, NO args):` + `final_answer is NOT a tool.` | Explicit confusion between format and tool |
| Multi-line tool descriptions with markdown bold | `web_search: Web search. \| args: query(search query)` | 5 lines per tool → 1 line, no loss of meaning |

**Key takeaway:** small models respond better to **prohibitions** ("NOT a tool", "never null") than to **instructions** ("if you have the answer, use..."). Negative framing lands more reliably than positive guidance.
