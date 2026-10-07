-- "Try an example" in the Shopify app costs AI per click. One atomic counter
-- per installation keeps it to p_limit per 24 hours, also under parallel clicks.
ALTER TABLE shopify_installations
  ADD COLUMN sample_count integer NOT NULL DEFAULT 0,
  ADD COLUMN sample_window_start timestamptz;

CREATE FUNCTION reserve_shopify_sample(p_tenant uuid, p_limit integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE shopify_installations SET
    sample_count = CASE WHEN sample_window_start IS NULL OR sample_window_start < now() - interval '1 day' THEN 1 ELSE sample_count + 1 END,
    sample_window_start = CASE WHEN sample_window_start IS NULL OR sample_window_start < now() - interval '1 day' THEN now() ELSE sample_window_start END
    WHERE tenant_id = p_tenant AND status = 'active'
      AND (sample_window_start IS NULL OR sample_window_start < now() - interval '1 day' OR sample_count < p_limit);
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION reserve_shopify_sample(uuid,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION reserve_shopify_sample(uuid,integer) TO service_role;
