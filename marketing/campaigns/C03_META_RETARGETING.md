# C03: Meta — retargeting and warm audiences

**Budget:** up to €15/day, only after the audience can deliver
**Objective:** landing-page views initially
**Landing:** `/pricing` or the persona page matching the original ad

## Eligible audiences now

- Instagram account engagers, 30 days.
- Facebook page engagers, 30 days.
- Video viewers at 50% or more, 30 days, once video creative exists.
- Lead or customer lists only with a documented lawful basis and platform-compliant permission.

Website-visitor retargeting is intentionally not configured because the application does not load an advertising pixel. Add it only together with a consent manager and an updated privacy/cookie implementation.

## Ad set 1: engaged, no trial

Exclude known sign-ups and customers where possible.

### Ad R1 — low-risk start

Primary text:

> Nog aan het vergelijken? Test SequenceFlow met je eigen supportflow. Je start met menselijke goedkeuring, 150 e-mails en 14 dagen om te bepalen of de concepten echt bij jullie beleid passen. Geen creditcard nodig.

Headline: `Test het met echte klantvragen`
Description: `14 dagen gratis. Jij houdt de controle.`
CTA: `Gratis proefversie`
Creative: `marketing/creatives/meta-retarget-trial.svg`

URL:

```text
https://emailreply.sequenceflow.io/pricing?utm_source=meta&utm_medium=paid_social&utm_campaign=c03_meta_retention&utm_content=engaged_trial_v1
```

### Ad R2 — objection: black box

Primary text:

> SequenceFlow verstuurt niet zomaar alles automatisch. Nieuwe accounts beginnen met review. Je ziet het concept, de intentie en het vertrouwen en bepaalt zelf wanneer gecontroleerde auto-send past.

Headline: `Geen black box in je inbox`
Description: `AI schrijft. Je team beslist.`
CTA: `Meer informatie`

URL suffix: `utm_content=engaged_control_v1`

## Ad set 2: trial started, not activated

This audience cannot be built in Meta without a lawful customer-list sync or consent-based event tracking. Keep it as a lifecycle email segment in SequenceFlow/Resend until that infrastructure exists.

Lifecycle message:

Subject: `Je SequenceFlow-proefperiode staat klaar`
Preview: `Koppel je mailbox en test je eerste klantmail.`

Body:

> Je account is aangemaakt. De volgende stap is je supportmailbox koppelen via forwarding of IMAP. Voeg daarna je retour- en verzendbeleid toe, test je afzender en verwerk één echte of interne testmail. Loop je vast, antwoord dan op deze mail; we kijken gericht mee.

CTA: `Ga verder met instellen`

## Delivery guardrails

- Stop if frequency rises while reach barely grows.
- Keep no more than two active ads in this small audience.
- Return unused budget to Search; do not broaden a retargeting audience until it becomes prospecting in disguise.
