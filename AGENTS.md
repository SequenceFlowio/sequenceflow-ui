# Samenwerken in deze repository

Claude Code en Codex werken hier allebei. De samenwerkingsafspraken staan centraal in `~/.codex/AGENTS.md` en worden beheerd via de Agent Room-app op het bureaublad van de gebruiker. Codex leest dat bestand automatisch; Claude leest het via `~/.claude/CLAUDE.md`.

Kort de kern (de centrale afspraken gaan voor):
- Eén bouwer per branch: Claude op `feat/*`, Codex op `codex/*`. Niet in elkaars worktree of branch werken.
- Reviews van de andere agent zijn alleen-lezen.
- Een push naar `main` gaat live; productiedatabase alleen met expliciete toestemming.

## Lopende plannen
- [docs/plan-werkstroomkern.md](docs/plan-werkstroomkern.md): plan van aanpak tot auto-send op een vertrouwensladder per soort vraag, feitenchecks in code, een live testset en stiltebewaking (22 nov). Wijzig je prompt, model of pipeline? Draai eerst `npm run eval:support` en zet de score in de PR.
- [docs/overdracht-6nov.md](docs/overdracht-6nov.md): wat Claude op 5–6 nov heeft gebouwd (prijzen live, Shopify-afrekening, nieuwe pagina's, inlogfix). Lees dit eerst.
- [docs/review-en-plan-nov-2026.md](docs/review-en-plan-nov-2026.md): technische review (security, bugs, dependencies), werkpakketten WP-01…WP-11 voor kleinere modellen, productkansen en marketingplan (2 nov). Zet bij een werkpakket "Bezig: Claude/Codex" met je branch.
- [docs/roadmap.md](docs/roadmap.md): wat we bouwen en in welke volgorde (Ezra's punten, 26 okt). Zet bij een nummer "Bezig: Claude/Codex" met je branch voordat je begint.
- [docs/plan-mascottes-chat-privacy-nov-2026.md](docs/plan-mascottes-chat-privacy-nov-2026.md): mascottes, team-chat (Milo, Seffy, Otis, Juno), privacy en prijzen. Op 5 november naar main gegaan via `feat/centrale-chat`, inclusief al het werk van `codex/outcome-pricing` en `codex/homepage-product-story`. Codex: ga verder vanaf main (prijzen, hoofdstuk 9, blijft van jou).
- [docs/plan-na-goedkeuring.md](docs/plan-na-goedkeuring.md): wat er moet gebeuren zodra Google (Gmail-verificatie) of Shopify (app-review) iets laat horen. Wie een stap oppakt, zet daar "Bezig: Claude/Codex" bij.
- [docs/blog-planning.md](docs/blog-planning.md): 20 blogposts ingepland (17 nov – 20 dec, 4 per week), Blog-tab in de backoffice met GA4 per post. Batch 2 (17 posts, GEO-opzet met kort antwoord en FAQ-data) vult de lege dagen tot en met 26 dec: elke dag een post. Branch `feat/blog-geo-december`.
- [docs/kosten-otis-seffy-nov-2026.md](docs/kosten-otis-seffy-nov-2026.md): backoffice-tab Kosten en winst (OpenAI per aanroep, Stripe, vast, Meta), Otis op het overzicht met Scale-slot, kennismaking met Seffy (migratie 075 nog niet op productie). Branch `feat/kosten-otis-overzicht`.
- [docs/plan-setup-demovideo.md](docs/plan-setup-demovideo.md): korte demovideo's bij het koppelen van de mailbox (fase 2).
