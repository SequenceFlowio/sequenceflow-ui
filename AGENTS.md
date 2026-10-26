# Samenwerken in deze repository

Claude Code en Codex werken hier allebei. De samenwerkingsafspraken staan centraal in `~/.codex/AGENTS.md` en worden beheerd via de Agent Room-app op het bureaublad van de gebruiker. Codex leest dat bestand automatisch; Claude leest het via `~/.claude/CLAUDE.md`.

Kort de kern (de centrale afspraken gaan voor):
- Eén bouwer per branch: Claude op `feat/*`, Codex op `codex/*`. Niet in elkaars worktree of branch werken.
- Reviews van de andere agent zijn alleen-lezen.
- Een push naar `main` gaat live; productiedatabase alleen met expliciete toestemming.

## Lopende plannen
- [docs/roadmap.md](docs/roadmap.md): wat we bouwen en in welke volgorde (Ezra's punten, 26 okt). Zet bij een nummer "Bezig: Claude/Codex" met je branch voordat je begint.
- [docs/plan-na-goedkeuring.md](docs/plan-na-goedkeuring.md): wat er moet gebeuren zodra Google (Gmail-verificatie) of Shopify (app-review) iets laat horen. Wie een stap oppakt, zet daar "Bezig: Claude/Codex" bij.
- [docs/plan-setup-demovideo.md](docs/plan-setup-demovideo.md): korte demovideo's bij het koppelen van de mailbox (fase 2).
