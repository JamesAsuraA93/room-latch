-- Decision-model calls made by POST /api/recommend (lib/render-jobs.ts reserveModelCall): backs its daily limits.
begin;
create table if not exists recommend_calls (
  client_key text not null,                -- hash of the caller's IP, never the raw address
  at         timestamptz not null default now()
);
create index if not exists recommend_calls_at_idx on recommend_calls (at);
commit;
