# TG Local LLM — Architecture Evolution

## Overview

A Telegram bot running a local LLM (via Ollama) with an agentic tool-use loop. This branch documents the evolution of the codebase from a flat single-layer structure into a modular monolith with an event-driven communication layer.

---

## Identified Issues

![](.readme/issue1.png)

![](.readme/issue2.png)

![](.readme/issue3.png)

## What Could Not Be Broken

- **Database access**: LLM was unable to find the db file even if it's a simple sqlite file.

## What Was Fixed

- Added blacklisted URLs that are present in environment variables.
- Added blacklisted commands for **bashExec** tool.