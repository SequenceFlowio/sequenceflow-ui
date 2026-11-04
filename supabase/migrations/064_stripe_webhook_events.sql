-- Stripe levert events soms twee keer. Elk event wordt eerst hier geregistreerd;
-- een tweede levering met hetzelfde id wordt genegeerd (idempotente webhook).
create table if not exists stripe_webhook_events (
  event_id    text primary key,
  type        text not null,
  received_at timestamptz not null default now()
);

alter table stripe_webhook_events enable row level security;
revoke all on stripe_webhook_events from anon, authenticated;

create index if not exists idx_stripe_webhook_events_received_at on stripe_webhook_events (received_at);
