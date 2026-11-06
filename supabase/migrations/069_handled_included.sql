-- Afgehandelde gesprekken die bij het vaste bedrag horen (100 / 300 / 1.000 per periode)
-- krijgen de status 'included': vastgelegd, maar niet naar Stripe.
alter table billing_handled_conversations drop constraint if exists billing_handled_conversations_status_check;
alter table billing_handled_conversations add constraint billing_handled_conversations_status_check
  check (status in ('included', 'pending_report', 'reported', 'over_budget', 'not_billed'));
