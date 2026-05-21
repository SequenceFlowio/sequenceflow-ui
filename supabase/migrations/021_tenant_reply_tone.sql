-- 021_tenant_reply_tone.sql
-- Adds tenant-controlled reply style settings used by the AI draft pipeline.

alter table tenant_agent_config
  add column if not exists reply_tone text not null default 'friendly_informal',
  add column if not exists reply_pronoun_preference text not null default 'informal';

alter table tenant_agent_config
  drop constraint if exists tenant_agent_config_reply_tone_check;

alter table tenant_agent_config
  add constraint tenant_agent_config_reply_tone_check
  check (reply_tone in ('friendly_informal', 'professional', 'warm', 'concise'));

alter table tenant_agent_config
  drop constraint if exists tenant_agent_config_reply_pronoun_preference_check;

alter table tenant_agent_config
  add constraint tenant_agent_config_reply_pronoun_preference_check
  check (reply_pronoun_preference in ('informal', 'formal'));
