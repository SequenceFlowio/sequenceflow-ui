-- Otis, de voorraadassistent: kennismaking (onboarding) en wat hij over de winkel onthoudt,
-- plus een melding "nog X% over van de laatste levering".
-- Bestaande gegevens blijven ongewijzigd; alle kolommen hebben een standaardwaarde.

ALTER TABLE inventory_settings
  -- Wanneer de kennismaking met Otis is afgerond; null = Otis vraagt het bij het eerste bezoek.
  ADD COLUMN IF NOT EXISTS otis_onboarded_at timestamptz,
  -- Antwoorden uit de kennismaking en wat Otis in gesprekken onthield (zie lib/inventory/otisProfile.ts).
  ADD COLUMN IF NOT EXISTS otis_profile jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Nieuwe soort melding: voorraad onder een percentage van de laatste levering.
ALTER TABLE inventory_alert_rules DROP CONSTRAINT IF EXISTS inventory_alert_rules_kind_check;
ALTER TABLE inventory_alert_rules ADD CONSTRAINT inventory_alert_rules_kind_check CHECK (kind IN (
  'stock_below', 'days_below', 'percent_below', 'sold_out', 'sales_spike', 'questions_on_short', 'back_in_stock',
  'season_ahead', 'delivery_late', 'dead_stock_value', 'margin_below', 'returns_above'
));
