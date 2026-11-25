-- Seffy, de klantenservice-agent: kennismaking (onboarding) zoals bij Otis (migratie 073).
-- Null = Seffy vraagt het bij het eerste bezoek aan de inbox.
-- Bestaande werkruimtes die hun antwoordstijl al hadden ingesteld (een handtekening),
-- krijgen meteen een datum, zodat zij de kennismaking niet alsnog zien.

ALTER TABLE tenant_agent_config
  ADD COLUMN IF NOT EXISTS seffy_onboarded_at timestamptz;

UPDATE tenant_agent_config
SET seffy_onboarded_at = now()
WHERE seffy_onboarded_at IS NULL
  AND coalesce(btrim(signature), '') <> '';
