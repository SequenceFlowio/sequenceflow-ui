-- Affiliates uitbetalen vanuit het beheerdashboard (sequenceflow.io/backoffice).
-- Twee nieuwe tabellen; bestaande tabellen blijven ongewijzigd. Een uitbetaling
-- zet de vrijgegeven commissieregels op 'paid' met settlement_ref = het id van
-- de uitbetaling. Alleen server-side met de service role.

-- Waar het geld heen moet. Het IBAN staat versleuteld; alleen het land en de laatste vier tekens (iban_last4, bijv. NL4300) zijn leesbaar.
create table if not exists affiliate_payout_accounts (
  affiliate_id    uuid        primary key references affiliates(id) on delete cascade,
  account_holder  text        not null,
  iban_encrypted  text        not null,
  iban_last4      text        not null,
  updated_at      timestamptz not null default now()
);

-- Eén regel per overboeking. `number` is het doorlopende nummer van de self-billingfactuur.
-- `snapshot` bewaart naam, bedrijf en rekening zoals ze op dat moment waren, zodat een factuur later niet verandert.
create table if not exists affiliate_payouts (
  id            uuid        primary key default gen_random_uuid(),
  number        bigint      generated always as identity,
  affiliate_id  uuid        references affiliates(id) on delete set null,
  amount_cents  int         not null check (amount_cents > 0), -- commissie excl. btw
  vat_cents     int         not null default 0,
  total_cents   int         not null,
  reward_count  int         not null,
  reference     text,       -- betalingskenmerk van de overboeking
  paid_by       text,       -- e-mailadres van de beheerder
  paid_at       timestamptz not null default now(),
  snapshot      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists affiliate_payouts_affiliate_idx on affiliate_payouts (affiliate_id, paid_at desc);

alter table affiliate_payout_accounts enable row level security;
alter table affiliate_payouts enable row level security;
revoke all on affiliate_payout_accounts from anon, authenticated;
revoke all on affiliate_payouts from anon, authenticated;
