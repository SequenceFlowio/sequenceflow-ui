-- 011_billing.sql
-- Adds billing columns to tenants table

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz DEFAULT (now() + interval '14 days'),
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS billing_period_start timestamptz DEFAULT date_trunc('month', now());

-- Plan values: trial | starter | growth | scale | expired
-- Add a comment to document allowed values
COMMENT ON COLUMN tenants.plan IS 'Allowed values: trial, starter, growth, scale, expired';
