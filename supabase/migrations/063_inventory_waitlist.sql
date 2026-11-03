-- Vera's waitlist "weer op voorraad": customers who asked when a variant would
-- be back get one mail when it is, after the merchant confirms. This table
-- remembers who was mailed for which variant, so nobody gets it twice.
-- Server-side writes only; members of the workspace can read.

CREATE TABLE inventory_waitlist_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  variant_key text NOT NULL CHECK (char_length(variant_key) <= 400),
  customer_email text NOT NULL CHECK (char_length(customer_email) <= 320),
  conversation_id uuid,
  sent_by uuid,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, variant_key, customer_email)
);
CREATE INDEX inventory_waitlist_sends_tenant ON inventory_waitlist_sends (tenant_id, sent_at DESC);

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['inventory_waitlist_sends'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON %I FROM anon', table_name);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON %I FROM authenticated', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_select ON %I', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_select ON %I FOR SELECT TO authenticated USING (tenant_id = (SELECT tenant_id FROM tenant_members WHERE user_id = (SELECT auth.uid()) LIMIT 1))',
      table_name
    );
  END LOOP;
END $$;
