-- AI render jobs run by the OpenAI provider (lib/render-jobs.ts). Status lives here so any server instance
-- can answer a poll; the output image lives in Object storage. Rows also back the daily limits.
-- Rows and their images are purged 24 hours after they start.
begin;
create table if not exists render_jobs (
  id           uuid primary key,
  client_key   text not null,               -- hash of the caller's IP: the rate-limit bucket, never the raw address
  status       text not null default 'running' check (status in ('running', 'succeeded', 'failed', 'cancelled')),
  error        text check (length(error) <= 80),
  output_path  text check (output_path ~ '^renders/[0-9a-f-]{36}\.png$'),
  image_w      integer check (image_w > 0),
  image_h      integer check (image_h > 0),
  bytes        integer check (bytes > 0),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  check (status <> 'succeeded' or (output_path is not null and image_w is not null and image_h is not null and bytes is not null)),
  check ((status = 'running') = (finished_at is null))
);
create index if not exists render_jobs_started_idx on render_jobs (started_at);
commit;
