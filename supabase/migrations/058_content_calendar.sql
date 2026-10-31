-- Content Calendar (/contentcalender): interne tool van SequenceFlow om
-- Instagram/Facebook-posts te genereren, goed te keuren en in te plannen.
-- Losstaand van tenants: alleen de admins via een toegangscode, alleen
-- server-side met de service role. RLS staat aan zonder policies, dus de
-- anon-key kan hier niets lezen of schrijven.

-- Eén rij per post. De volledige post (tekst, slides, beeldstatus, publicatie)
-- staat in data; datum en status staan er los naast om op te filteren.
CREATE TABLE content_posts (
  id text PRIMARY KEY CHECK (char_length(id) BETWEEN 4 AND 40),
  date date NOT NULL,
  time text NOT NULL CHECK (time ~ '^\d{2}:\d{2}$'),
  status text NOT NULL CHECK (status IN ('review', 'approved', 'rejected', 'posted')),
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX content_posts_date_idx ON content_posts (date, time);
CREATE INDEX content_posts_status_idx ON content_posts (status);

-- Wachtrij voor bulk-generatie (één rij: 'main'). locked_until is een korte
-- lease, zodat cron en de open pagina niet tegelijk dezelfde posts maken.
CREATE TABLE content_queue (
  id text PRIMARY KEY,
  data jsonb,
  locked_until timestamptz NOT NULL DEFAULT 'epoch',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO content_queue (id) VALUES ('main');

ALTER TABLE content_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_queue ENABLE ROW LEVEL SECURITY;

-- Gegenereerde foto's. Privé: de app serveert ze zelf, Meta krijgt een
-- getekende render-URL.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('content-calendar', 'content-calendar', false, 20971520, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;
