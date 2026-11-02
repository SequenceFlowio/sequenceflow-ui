-- Seasons the merchant sets by hand per product, for the inkoopadvies:
-- { "<product key>": [5, 6, 7, 8] } for the months it mainly sells in, or []
-- for "sells all year". Products not listed are detected from their sales.
ALTER TABLE inventory_settings
  ADD COLUMN IF NOT EXISTS product_seasons jsonb NOT NULL DEFAULT '{}'::jsonb;
