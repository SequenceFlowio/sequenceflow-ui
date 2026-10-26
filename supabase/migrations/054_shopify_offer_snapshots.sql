-- Shopify variants (price, availability and stock) are stored as offer
-- snapshots next to bol.com offers, once a shop grants read_products and
-- read_inventory. Same table, RLS and retention: rows go with their order.
ALTER TABLE commerce_offer_snapshots
  DROP CONSTRAINT IF EXISTS commerce_offer_snapshots_provider_check;
ALTER TABLE commerce_offer_snapshots
  ADD CONSTRAINT commerce_offer_snapshots_provider_check
  CHECK (provider IN ('bol', 'shopify'));
