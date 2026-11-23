-- Mails in de taal van de ontvanger.
-- 1. Affiliates: de taal van de pagina waarop ze zich aanmeldden (/nl/affiliate of /en/affiliate).
alter table affiliates add column if not exists language text not null default 'nl' check (language in ('nl', 'en'));

-- 2. Aanmeldingen voor de gratis downloads (/nl/gratis, /en/free): taal, toestemming voor tips,
--    waar in de mailreeks ze zijn en of ze zich hebben afgemeld. Eén regel per e-mailadres;
--    een tweede download werkt de regel bij.
create table if not exists marketing_leads (
  id               uuid        primary key default gen_random_uuid(),
  email            text        not null unique,
  name             text,
  store            text,
  language         text        not null default 'nl' check (language in ('nl', 'en')),
  freebies         text[]      not null default '{}',   -- welke downloads (catalog.ts), eerste eerst
  source           text,                                -- utm uit de link, voor wat werkt per post
  marketing        boolean     not null default false,  -- vinkje "stuur me ook tips": alleen dan de reeks
  nurture_step     int         not null default 0,      -- hoeveel mails uit de reeks al verstuurd
  nurture_sent_at  timestamptz,
  unsubscribed_at  timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists marketing_leads_nurture_idx on marketing_leads (nurture_step, created_at) where marketing and unsubscribed_at is null;

alter table marketing_leads enable row level security;
revoke all on marketing_leads from anon, authenticated;
