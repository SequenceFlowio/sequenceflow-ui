# Samenwerken in deze repository

Claude Code en Codex werken hier allebei. De samenwerkingsafspraken staan centraal in `~/.codex/AGENTS.md` en worden beheerd via de Agent Room-app op het bureaublad van de gebruiker. Codex leest dat bestand automatisch; Claude leest het via `~/.claude/CLAUDE.md`.

Kort de kern (de centrale afspraken gaan voor):
- Eén bouwer per branch: Claude op `feat/*`, Codex op `codex/*`. Niet in elkaars worktree of branch werken.
- Reviews van de andere agent zijn alleen-lezen.
- Een push naar `main` gaat live; productiedatabase alleen met expliciete toestemming.
