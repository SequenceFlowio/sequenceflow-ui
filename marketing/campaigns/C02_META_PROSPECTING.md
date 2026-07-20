# C02: Meta — prospecting

**Budget:** €40/day for days 1–14; €30/day after retargeting is viable
**Objective:** landing-page views initially; website conversion optimisation is not represented as active without consent-based pixel tracking
**Placements:** Advantage+ placements, then inspect placement quality
**Geography:** Netherlands
**Exclusions:** existing customers, team, and recent sign-ups where an appropriately permissioned audience exists

Keep two ad sets only. More would starve each test.

## Ad set 1: e-commerce founders

**Budget share:** 50%
**Audience hypothesis:** owners/founders and e-commerce operators; keep targeting broad enough for delivery and let the creative qualify the viewer
**Landing:** `/for/ecommerce-founders`

### Ad F1 — inbox interruption

Primary text:

> Hoe vaak open je vandaag je supportmailbox voor dezelfde vraag? SequenceFlow maakt antwoorden klaar voor bestelstatus, retouren en productvragen op basis van jouw eigen beleid. Jij controleert eerst. Automatiseer pas wanneer je dat vertrouwt. Probeer 14 dagen gratis, zonder creditcard.

Headline: `Laat je inbox niet je dag bepalen`
Description: `AI-concepten vanuit jouw webshopbeleid.`
CTA: `Gratis proefversie`
Creative: `marketing/creatives/meta-founder-inbox.svg`

URL:

```text
https://emailreply.sequenceflow.io/for/ecommerce-founders?utm_source=meta&utm_medium=paid_social&utm_campaign=c02_meta_prospecting&utm_content=founders_inbox_v1
```

### Ad F2 — policy control

Primary text:

> Een generiek AI-antwoord is niet genoeg wanneer het over retouren of garantie gaat. SequenceFlow gebruikt jouw documenten als context, toont het concept en laat jou beslissen wat wordt verstuurd. Start met je bestaande mailbox.

Headline: `Jouw beleid. Een sneller antwoord.`
Description: `Menselijke goedkeuring is de standaard.`
CTA: `Meer informatie`

URL suffix: `utm_content=founders_policy_v1`

### Ad F3 — no migration

Primary text:

> Je hoeft geen nieuwe helpdesk te implementeren om klantmail slimmer af te handelen. Koppel forwarding of IMAP, verstuur via je eigen adres en laat SequenceFlow het eerste concept maken. 14 dagen gratis met 150 e-mails.

Headline: `Houd je mailbox. Verlies het handwerk.`
Description: `Start zonder creditcard.`
CTA: `Gratis proefversie`

URL suffix: `utm_content=founders_mailbox_v1`

## Ad set 2: customer-service leads

**Budget share:** 50%
**Audience hypothesis:** customer service managers, support leads, e-commerce managers, operations managers
**Landing:** `/for/customer-service-teams`

### Ad T1 — team capacity

Primary text:

> Je agents hoeven niet iedere retour- of bestelvraag vanaf nul te schrijven. SequenceFlow classificeert de mail en maakt een concept vanuit jullie eigen kennis. Lage zekerheid en uitzonderingen blijven zichtbaar voor review.

Headline: `Meer capaciteit. Zelfde controle.`
Description: `AI ondersteunt je agents, niet andersom.`
CTA: `Meer informatie`
Creative: `marketing/creatives/meta-support-control.svg`

URL:

```text
https://emailreply.sequenceflow.io/for/customer-service-teams?utm_source=meta&utm_medium=paid_social&utm_campaign=c02_meta_prospecting&utm_content=support_capacity_v1
```

### Ad T2 — consistency

Primary text:

> Retourbeleid gewijzigd? Geef ieder teamlid hetzelfde startpunt. SequenceFlow gebruikt gedeelde kennis voor elk concept, terwijl agents kunnen aanpassen, goedkeuren en escaleren.

Headline: `Eén beleid in ieder antwoord`
Description: `Voor groeiende e-commerce supportteams.`
CTA: `Meer informatie`

URL suffix: `utm_content=support_consistency_v1`

### Ad T3 — controlled automation

Primary text:

> Automatiseren zonder black box. Start met menselijke goedkeuring, bekijk intentie en vertrouwen, en activeer gecontroleerde auto-send pas voor de situaties die bij jullie passen.

Headline: `AI-workflow met een controlepunt`
Description: `Probeer 14 dagen zonder creditcard.`
CTA: `Gratis proefversie`

URL suffix: `utm_content=support_control_v1`

## Test order

1. Run F1 and T1 as controls.
2. Add the policy/consistency variant after each control has meaningful delivery.
3. Test no-migration/controlled-automation third.
4. Compare cost per activated account by persona. Do not select a winner on CTR alone.
