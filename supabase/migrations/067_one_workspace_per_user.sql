-- Eén workspace per gebruiker. De code (lib/tenant.ts, app/(app)/layout.tsx)
-- leest het lidmaatschap met .single(); een gebruiker met twee rijen raakte
-- daardoor uit beide workspaces buitengesloten. De index maakt de aanname hard;
-- de uitnodigingsroute controleert het vooraf en geeft een nette melding.
--
-- Controleer vóór het uitvoeren of er gebruikers met meer dan één rij zijn
-- (de index mislukt dan bewust, zodat niets stil wordt verwijderd):
--   select user_id, count(*) from tenant_members group by 1 having count(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS tenant_members_one_per_user
  ON tenant_members (user_id);

-- Zoekt een bestaande gebruiker op e-mailadres, zodat een uitnodiging voor een
-- adres dat al een workspace heeft kan worden geweigerd. Alleen voor de
-- service-role; geeft nooit meer terug dan het id.
CREATE OR REPLACE FUNCTION find_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(trim(p_email)) LIMIT 1;
$$;

REVOKE ALL ON FUNCTION find_user_id_by_email(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION find_user_id_by_email(text) TO service_role;
