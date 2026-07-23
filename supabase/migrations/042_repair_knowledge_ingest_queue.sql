create table if not exists public.knowledge_ingest_jobs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_documents(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'done', 'error')),
  attempts integer not null default 0,
  last_error text,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_knowledge_ingest_jobs_status_created
  on public.knowledge_ingest_jobs(status, created_at);

create index if not exists idx_knowledge_ingest_jobs_document_id
  on public.knowledge_ingest_jobs(document_id);

create unique index if not exists idx_knowledge_ingest_jobs_one_active
  on public.knowledge_ingest_jobs(document_id)
  where status in ('pending', 'processing');

alter table public.knowledge_ingest_jobs enable row level security;

revoke all on table public.knowledge_ingest_jobs from anon, authenticated;

create or replace function public.claim_knowledge_job()
returns setof public.knowledge_ingest_jobs
language plpgsql
set search_path = public
as $$
declare
  claimed_id uuid;
begin
  update public.knowledge_ingest_jobs
  set status = 'pending',
      locked_at = null,
      updated_at = now()
  where status = 'processing'
    and locked_at < now() - interval '5 minutes';

  select id
  into claimed_id
  from public.knowledge_ingest_jobs
  where status = 'pending'
  order by created_at asc
  limit 1
  for update skip locked;

  if claimed_id is null then
    return;
  end if;

  return query
    update public.knowledge_ingest_jobs
    set status = 'processing',
        attempts = attempts + 1,
        locked_at = now(),
        updated_at = now()
    where id = claimed_id
    returning *;
end;
$$;

revoke all on function public.claim_knowledge_job() from public, anon, authenticated;
grant execute on function public.claim_knowledge_job() to service_role;
