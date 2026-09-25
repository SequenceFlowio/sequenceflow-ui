# Samenwerken in deze repository

Hier werken twee AI-agents aan dezelfde code: **Claude Code** en **Codex**. Ze zien elkaars werk niet live. Deze afspraken voorkomen dat ze door elkaar heen werken.

## Eén bouwer per branch
- Werk nooit in de worktree of op de branch van de andere agent, tenzij de gebruiker daar expliciet om vraagt.
- **Claude** werkt op `feat/*`-branches. **Codex** werkt op `codex/*`-branches.
- Kijk voordat je begint wat er al loopt: `git worktree list`, `git branch -a` en `git log origin/main -5`. Staat er werk voor hetzelfde onderwerp op een branch van de ander? Stop dan en vraag het de gebruiker.
- Laat geen ongecommit werk achter als je stopt. Commit het als WIP op je eigen branch, zodat de ander ziet wat er loopt.

## Reviews
- Vraagt de ene agent de andere om een review (bijvoorbeeld via de Codex-plugin in Claude Code), dan is die review **alleen-lezen**: geen bestanden aanpassen, niet committen.
- Wijzigingen naar aanleiding van een review doet de bouwer van die branch.

## Lopende onderwerpen
- **Shopify-app:** alleen op `feat/shopify-app` (bouwer: Claude). `codex/shopify-public-app` is vervangen en wordt niet meer gebruikt.

## Main en productie
- Een push naar `main` gaat automatisch live via Vercel. Doe altijd eerst `git fetch` en rebase op `origin/main`. Nooit force-pushen naar `main`.
- Wijzigingen aan de productiedatabase (migraties, data) alleen na expliciete toestemming van de gebruiker.
- Maak geen `.github/workflows/` of andere CI/CD-bestanden aan.
- Commit nooit `.env*`-bestanden en toon geen secrets.
