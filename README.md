# TG local LLM

A minimal Telegram bot that forwards your messages to a locally running LLM via Ollama and replies with the response. No history, no database — each message is a fresh, stateless request to the model.

```
You → Telegram → Bot → Ollama (local LLM) → Bot → Telegram → You
```

## Prerequisites

- MacOS (not tested on other systems)
- Ollama installed: `curl -fsSL https://ollama.com/install.sh | sh`
- Some model running, for example `qwen2.5:7b`: `ollama run qwen2.5:7b`
- NodeJS on your machine, mine is `node v22`
- A Telegram bot token from [@BotFather](https://t.me/BotFather)

## Project structure

```
src/
  config.ts   — loads and validates environment variables
  llm.ts      — Ollama API client (native fetch, no SDK)
  bot.ts      — creates the Telegram bot with polling
  handler.ts  — wires incoming messages to the LLM and back
  index.ts    — entry point, graceful shutdown
```

## Steps to run

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set your `TELEGRAM_API_TOKEN`. The other values default to `http://localhost:11434` and `qwen2.5:7b` if omitted.

3. **Start Ollama with your model** (if not already running)

   ```bash
   ollama run qwen2.5:7b
   ```

4. **Run the bot**

   ```bash
   npm start
   ```

   The bot uses polling — no public URL or webhook setup required.

5. **Optional: build for production**

   ```bash
   npm run build
   npm run start:prod
   ```

# The Story

1.  **Research:** First, I chatted with ChatGPT to understand how to run local models through Ollama.
2.  **Bot Creation:** Then, I created the Telegram bot itself.
3.  **Manual Setup:** Next, I manually created the initial project files:
   * `.env`
   * `.env.example`
   * `.gitignore`
   * `README.md` (containing only the prerequisites list)
4.  **AI Engineering:** After that, I used **Claude Code** with **Claude Sonnet 4.6** (1m 30s) using the following prompt:

    > I need my telegram bot to pass the messages I send him to the local llm running on my machine then send back in chat the llm’s response. Ollama with qwen2.5:7b is already running on my machine. Telegram bot is created and TELEGRAM_API_TOKEN is added to .env file. I want you to create the bot logic using javascript/typescript. Each message I send to bot chat should be treated as individual message to llm (no memory). Telegram bot api should be used through POLLING (and not webhook). No database or any storage needed, just TG -> Bot -> LLM -> Bot -> TG. Let’s use as few dependencies as possible. The bot logic should handle any messages, errors (i.e. LLM is not available or something else went wrong), be able to handle one message after another. I already added some prerequisites details in README.md file, after you finish - add project description and “Steps to run”. The code should be split through small, maintainable files, with clean architecture.

5.  **Testing:** Finally, I tested the bot by sending various messages and verified the responses. I also confirmed the error handling works by sending messages while Ollama was turned off and successfully receiving the designated error message.
