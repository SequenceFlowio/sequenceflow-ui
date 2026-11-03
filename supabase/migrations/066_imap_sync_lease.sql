-- De IMAP-sync draait elke minuut met een budget van 60 seconden. Zonder lock
-- kunnen twee runs dezelfde mailbox tegelijk lezen en dezelfde mail twee keer
-- door de AI-pipeline halen. Twee maatregelen:
--   1. een lease per mailbox (sync_lease_until): een run claimt de mailbox
--      voor 90 seconden en geeft hem aan het einde weer vrij;
--   2. een unieke index op het bericht-id van de provider, zodat een dubbele
--      import op de database stukloopt in plaats van een tweede concept op te leveren.

ALTER TABLE tenant_email_channels
  ADD COLUMN IF NOT EXISTS sync_lease_until timestamptz;

-- LET OP: verwijdert dubbele inbound-berichten (zelfde provider-id binnen één
-- workspace). Dat zijn per definitie dezelfde e-mail die twee keer is
-- ingelezen; de oudste rij blijft staan. Controleer vooraf hoeveel het er zijn:
--   select tenant_id, provider, provider_message_id, count(*)
--   from support_messages where direction = 'inbound' and provider_message_id is not null
--   group by 1, 2, 3 having count(*) > 1;
DELETE FROM support_messages older
USING support_messages newer
WHERE older.direction = 'inbound'
  AND newer.direction = 'inbound'
  AND older.tenant_id = newer.tenant_id
  AND older.provider = newer.provider
  AND older.provider_message_id = newer.provider_message_id
  AND older.provider_message_id IS NOT NULL
  AND older.created_at > newer.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS support_messages_inbound_provider_message_unique
  ON support_messages (tenant_id, provider, provider_message_id)
  WHERE direction = 'inbound' AND provider_message_id IS NOT NULL;
