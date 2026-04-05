-- 014_knowledge_doc_metadata.sql
-- Adds semantic metadata columns to knowledge_documents.
-- doc_type : user-facing document category (replaces tab-based type for UI purposes)
-- tags     : free-text tags stored as array
-- language : primary language of the document content

alter table knowledge_documents
  add column if not exists doc_type text not null default 'general'
    check (doc_type in ('return_policy', 'shipping_policy', 'warranty', 'product_info', 'general')),
  add column if not exists tags     text[] null,
  add column if not exists language text not null default 'nl';

create index if not exists idx_kd_doc_type on knowledge_documents(doc_type);
