-- Fase 2 werkstroomkern (docs/plan-werkstroomkern.md): wat de feitencheck vond
-- bij een concept. In schaduwmodus alleen vastgelegd; in enforce-modus gaat
-- het concept dan naar een mens. Alleen toevoegen, niets wordt gewijzigd.
alter table support_decisions add column if not exists fact_check jsonb;

comment on column support_decisions.fact_check is
  'Feitencheck: {"mode":"shadow"|"enforce","issues":[{"kind","value"}]} (lib/commerce/factCheck.ts)';
