-- Wekelijkse mail met wat Support One deed en wat aandacht vraagt. Standaard aan; afmelden via de link in de mail.
alter table tenants add column if not exists weekly_briefing_enabled boolean not null default true;
