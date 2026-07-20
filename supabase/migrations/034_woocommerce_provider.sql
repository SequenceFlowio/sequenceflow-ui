-- WooCommerce becomes the active pilot commerce provider while retaining the
-- Shopify schema for a later rollout.
ALTER TABLE commerce_connections DROP CONSTRAINT IF EXISTS commerce_connections_provider_check;
ALTER TABLE commerce_connections ADD CONSTRAINT commerce_connections_provider_check CHECK (provider IN ('shopify', 'woocommerce'));

ALTER TABLE commerce_orders DROP CONSTRAINT IF EXISTS commerce_orders_provider_check;
ALTER TABLE commerce_orders ADD CONSTRAINT commerce_orders_provider_check CHECK (provider IN ('shopify', 'woocommerce'));
