-- Rate limiting voor openbare routes (websitechat, affiliate-aanmelding,
-- Content Calendar-login, MCP OAuth). Eén rij per sleutel en venster; de
-- functie telt atomair op zodat serverless-instances dezelfde teller delen.
create table if not exists rate_limit_buckets (
  key          text primary key,
  count        integer not null default 0,
  window_start timestamptz not null default now()
);

alter table rate_limit_buckets enable row level security;
revoke all on rate_limit_buckets from anon, authenticated;

create index if not exists idx_rate_limit_buckets_window_start on rate_limit_buckets (window_start);

create or replace function rate_limit_hit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into rate_limit_buckets (key, count, window_start)
  values (p_key, 1, now())
  on conflict (key) do update set
    count = case
      when rate_limit_buckets.window_start < now() - make_interval(secs => p_window_seconds) then 1
      else rate_limit_buckets.count + 1
    end,
    window_start = case
      when rate_limit_buckets.window_start < now() - make_interval(secs => p_window_seconds) then now()
      else rate_limit_buckets.window_start
    end
  returning count into v_count;
  return v_count <= p_limit;
end;
$$;

revoke all on function rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function rate_limit_hit(text, integer, integer) to service_role;
