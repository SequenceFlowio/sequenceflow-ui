# Paid media strategy: €100 per day

Updated: June 13, 2026
Market: Netherlands
Primary conversion: completed SequenceFlow sign-up
Secondary conversion: mailbox connected
Business conversion: paid subscription

## Recommendation

Start with Google Search for existing demand and Meta for problem-aware discovery. Do not add LinkedIn at this budget: it would divide spend across too many expensive auctions before the offer and conversion rate are proven.

### Days 1–14

| Campaign | Daily budget | Purpose |
| --- | ---: | --- |
| Google Search: high intent | €60 | Capture people actively looking for AI customer-service or email automation software. |
| Meta: founder + support lead prospecting | €40 | Test two pain-led audiences and creative angles. |
| Retargeting | €0 | Build eligible engagement audiences first. |

### From day 15, only when the audience is large enough

| Campaign | Daily budget | Purpose |
| --- | ---: | --- |
| Google Search: high intent | €55 | Protect the highest-intent source. |
| Meta prospecting | €30 | Keep learning on the strongest persona/creative combination. |
| Meta retargeting | €15 | Retarget Meta/Instagram engagers; add website visitors only after consent-based pixel tracking exists. |

If retargeting cannot spend or frequency becomes excessive, return its budget to Google Search. Do not force €15 into a tiny audience.

Google treats a daily budget as an average and may serve up to twice that amount on a particular day, while its monthly charging limit is 30.4 times the average daily budget. Account for this in cash planning. See [Google Ads: average daily budgets](https://support.google.com/google-ads/answer/1704443?hl=en).

## Funnel and measurement

1. Ad click carries campaign UTMs and, where available, `gclid` or `fbclid`.
2. The landing page records a privacy-minimised first-party `landing_view`.
3. CTA clicks are recorded as `cta_click`.
4. Google sign-up completion is recorded server-side as `signup_completed`, linked to the user and tenant.
5. Activation is evaluated from product data: a mailbox integration is connected and a first email is processed.
6. Revenue is evaluated from Stripe subscription state.

Create separate conversion actions for sign-up and paid subscription. Google explicitly supports separate website conversion actions and choosing which are primary for bidding; see [Google Ads conversion tracking](https://support.google.com/google-ads/answer/1722054?hl=en).

The application does not load Google or Meta advertising pixels. This avoids non-essential tracking before consent infrastructure exists. Initial optimisation therefore uses platform click/landing-page objectives plus SequenceFlow’s first-party sign-up reporting. Do not claim platform-reported conversion optimisation is active.

## UTM standard

Use lowercase values and never change naming mid-flight.

```text
utm_source=google|meta
utm_medium=cpc|paid_social
utm_campaign=c01_google_high_intent|c02_meta_prospecting|c03_meta_retention
utm_content=<adset>_<creative>_<version>
utm_term=<google_keyword_only>
```

## Reporting table

Review weekly by campaign, ad set/ad group, and creative:

- spend;
- impressions and reach;
- clicks, CTR, and CPC;
- landing views and CTA clicks;
- completed sign-ups and cost per sign-up;
- mailbox-connected activations and cost per activation;
- paid subscriptions, CAC, and plan;
- landing-to-sign-up and sign-up-to-activation conversion.

Platform clicks are not the source of truth for sign-ups. Join first-party events by UTM/click identifier and report the difference explicitly.

## Decision rules

- Do not judge an ad after one day. Use at least seven complete days unless it is broken or misleading.
- Pause a search term immediately if it is clearly consumer support, job seeking, free templates, or unrelated chatbot traffic.
- Pause an ad after €100 spend with no completed sign-up, unless attribution is known to be incomplete.
- Pause an ad set after €250 spend with no activation.
- Keep one control creative unchanged while testing one variable at a time.
- Move no more than 20% of daily budget at once; then wait at least three days before another routine budget change.
- Promote a winner only when it has both sign-ups and activations. Cheap clicks alone are not success.
- Determine target CAC only after gross margin and churn are known. The maximum sustainable CAC is based on expected gross profit, not the Starter monthly price alone.

## 30-day launch sequence

### Before spend

- Deploy migrations `024_marketing_attribution.sql` and `025_privacy_hardening.sql`.
- Verify production routes, Google OAuth, Stripe checkout, webhook signatures, cron retention, and mailbox onboarding.
- Complete one real sign-up from every campaign URL and confirm attribution in `marketing_events`.
- Set Google location to people in the Netherlands, not people merely interested in it.
- Exclude existing customers and the SequenceFlow team where each platform supports it.

### Week 1

Launch Google ad groups and two Meta ad sets. Use only the copy and URLs in `marketing/campaigns`. Check search terms daily. Make no audience expansion based on a handful of clicks.

### Week 2

Replace only clear losing ads. Compare founder versus support-team activation, not just CTR. Interview every reachable early sign-up about the phrase that prompted them to try.

### Week 3

Enable engagement retargeting if audience size and delivery are healthy. Shift €10–15 toward the campaign with the best cost per activated account.

### Week 4

Choose one primary ICP and one primary promise for the next month. Add customer proof only when permission and measured outcomes exist. Decide whether consent-based platform conversion tracking is worth implementing.

## Hard launch blockers

Do not spend until all are true:

- production migration applied;
- landing, pricing, privacy, terms, and signup routes return 200;
- attribution survives OAuth and creates `signup_completed`;
- a trial tenant receives the correct limits;
- no debug/test API can invoke paid AI publicly;
- no cross-tenant body parameter can select another tenant;
- Resend and Stripe webhooks fail closed when secrets are absent;
- support content is not stored in event analytics;
- support and marketing events are removed after 90 days;
- a named person checks spend and search terms every business day.

## Current platform references

- [Google Ads: overdelivery and average daily budget](https://support.google.com/google-ads/answer/1704443?hl=en)
- [Google Ads: conversion tracking options](https://support.google.com/google-ads/answer/1722054?hl=en)
- [Meta Business Help: learning phase](https://www.facebook.com/business/help/112167992830700)
- [Meta Business Help: campaign budget](https://www.facebook.com/business/help/190490051321426)

Meta help pages can require an authenticated Business account. Validate the exact UI labels in Ads Manager at launch because platform naming changes frequently.
