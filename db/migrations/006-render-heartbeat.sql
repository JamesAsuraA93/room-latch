-- Running render jobs refresh heartbeat_at while their instance is alive (lib/render-jobs.ts beatJob).
-- A running row that stops beating lost its server, so it no longer blocks its caller from starting a new job.
-- Additive: older app code ignores the column.
begin;
alter table render_jobs add column if not exists heartbeat_at timestamptz not null default now();
commit;
