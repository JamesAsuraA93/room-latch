-- RoomLatch catalog schema (Postgres 16 / Neon).
-- Static demo catalog: no live price, stock, variant or image-rights claims.
-- Load: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/schema.sql -f db/seed.sql

begin;

create table styles (
  id         text primary key,            -- app style id, e.g. 'japandi'
  name_th    text not null,
  sort_order smallint not null unique
);

create table room_types (
  id         text primary key,            -- 'condo', 'bedroom', ...
  name_th    text not null,
  sort_order smallint not null unique
);

-- Items the budget/width engine picks from (lib/plan.ts):
-- team price ranges from catalog/products.csv + labelled demo fixtures (lib/fixtures.ts).
-- Prices and widths are team estimates, not live Shopee data.
create table catalog_items (
  id            text primary key,
  room_type     text not null references room_types (id),
  slot          text not null,             -- 'desk', 'chair', 'lighting', 'rug', ...
  name          text not null,
  keyword       text not null default '',  -- Shopee search keyword
  price_min_thb integer not null check (price_min_thb >= 0),
  price_max_thb integer not null check (price_max_thb >= price_min_thb),
  priority      smallint not null default 1,
  listing_url   text check (listing_url ~ '^https://shopee\.co\.th/product/[0-9]+/[0-9]+$'),
  width_cm      integer check (width_cm > 0),        -- demo size; null = textile/small item
  uses_floor    boolean not null default false,      -- true = takes corner floor width
  is_fixture    boolean not null default false       -- demo fixture, name ends with "(fixture)"
);

create table catalog_item_styles (
  item_id  text not null references catalog_items (id) on delete cascade,
  style_id text not null references styles (id),
  primary key (item_id, style_id)
);

-- Real Shopee listings the team opened (snapshot 2026-11-21 + additions + exact match).
-- Only what was seen is stored; the URL is rebuilt from shop/item ids, never a search link.
create table shopee_listings (
  id              text primary key,         -- 'shopee-<shop>-<item>' (render allowlist id)
  shop_id         bigint not null,
  item_id         bigint not null,
  url             text generated always as ('https://shopee.co.th/product/' || shop_id || '/' || item_id) stored,
  title           text not null,
  category        text not null check (category in ('seating', 'table', 'light', 'textile', 'accent')),
  verification    text not null check (verification in ('photo', 'listing', 'gallery_failed')),
  evidence_status text not null,            -- raw status from the source file
  dimensions_cm   text,                     -- as stated on the listing, variant unconfirmed; null = not stated
  notes           text not null default '',
  source          text not null constraint shopee_listings_source_check check (source in ('snapshot', 'addition', 'exact_match', 'search')),
  shown_in_rooms  text[] not null default '{}',  -- exact matches shown on these room types
  checked_on      date not null,
  -- source 'search' rows only (scripts/gather-shopee.mts); image_url links Shopee's CDN, no photo is stored
  image_url       text,
  price_thb       numeric(12, 2),
  shop_name       text,
  rating          real,
  unique (shop_id, item_id),
  check (id = 'shopee-' || shop_id || '-' || item_id)
);

create table shopee_listing_styles (
  listing_id text not null references shopee_listings (id) on delete cascade,
  style_id   text not null references styles (id),
  primary key (listing_id, style_id)
);

-- ---------------------------------------------------------------------------
-- Users and social (Feed / Saved / Remix)
-- Auth tables (user, session, account, verification) are created and owned by Better Auth.
-- profiles.user_id = Better Auth user.id (text). No FK here so this file loads without auth;
-- add one once the auth tables exist in the same database.
-- ---------------------------------------------------------------------------

create table profiles (
  user_id      text primary key,
  handle       text not null unique check (handle ~ '^[a-z0-9_]{3,30}$'),
  display_name text not null check (length(display_name) between 1 and 60),
  created_at   timestamptz not null default now()
);

-- One design = one room plan (style, budget, width) + placed products.
-- Draft while published_at is null (owner only, shown in Saved).
-- Published = a Feed post: needs both images and the owner's consent timestamp.
-- Images live in Object storage; only the paths are stored here.
create table designs (
  id            uuid primary key default gen_random_uuid(),
  owner_id      text not null references profiles (user_id) on delete cascade,
  room_type     text not null references room_types (id),
  style_id      text not null references styles (id),
  budget_thb    integer check (budget_thb > 0),   -- null = not set (e.g. team example rooms)
  width_cm      integer check (width_cm > 0),
  total_max_thb integer check (total_max_thb >= 0),  -- sum of price_max at save time (estimate)
  title         text check (length(title) <= 80),
  remix_of      uuid references designs (id) on delete set null,
  before_path   text check (before_path ~ '^designs/[0-9a-f-]{36}/before\.(jpg|webp)$'),
  after_path    text check (after_path ~ '^designs/[0-9a-f-]{36}/after\.(jpg|webp|png)$'),
  after_kind    text check (after_kind in ('ai_render', 'composite')),  -- always labelled as a simulation
  image_w       integer check (image_w > 0),
  image_h       integer check (image_h > 0),
  consent_at    timestamptz,                -- owner ticked "publish Before and After"
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (published_at is null or (before_path is not null and after_path is not null
         and after_kind is not null and image_w is not null and image_h is not null
         and consent_at is not null and consent_at <= published_at)),
  check (remix_of is distinct from id)
);

-- Products placed in a design. Exactly one of catalog_item_id / listing_id.
-- Positions are percentages of the room frame (same as the app's Pos type).
create table design_items (
  design_id       uuid not null references designs (id) on delete cascade,
  position        smallint not null check (position >= 0),
  catalog_item_id text references catalog_items (id),
  listing_id      text references shopee_listings (id),
  x_pct           real check (x_pct between 0 and 100),
  y_pct           real check (y_pct between 0 and 100),
  w_pct           real check (w_pct > 0 and w_pct <= 100),
  locked          boolean not null default false,  -- user locked it; budget swaps keep it
  primary key (design_id, position),
  check (num_nonnulls(catalog_item_id, listing_id) = 1)
);

create table design_likes (
  design_id  uuid not null references designs (id) on delete cascade,
  user_id    text not null references profiles (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (design_id, user_id)
);

-- Saved tab: other people's published designs the user bookmarked.
create table design_saves (
  design_id  uuid not null references designs (id) on delete cascade,
  user_id    text not null references profiles (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (design_id, user_id)
);

-- AI render jobs run by the OpenAI provider (lib/render-jobs.ts). Status lives here so any server instance
-- can answer a poll; the output image lives in Object storage. Rows also back the daily limits.
-- Rows and their images are purged 24 hours after they start.
create table render_jobs (
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

create index designs_feed_idx on designs (published_at desc) where published_at is not null;
create index designs_owner_idx on designs (owner_id, updated_at desc);
create index designs_remix_idx on designs (remix_of) where remix_of is not null;
create index design_likes_user_idx on design_likes (user_id);
create index design_saves_user_idx on design_saves (user_id, created_at desc);
create index render_jobs_started_idx on render_jobs (started_at);
create index design_items_listing_idx on design_items (listing_id) where listing_id is not null;

create index catalog_items_room_slot_idx on catalog_items (room_type, slot);
create index catalog_item_styles_style_idx on catalog_item_styles (style_id);
create index shopee_listings_category_idx on shopee_listings (category);
create index shopee_listing_styles_style_idx on shopee_listing_styles (style_id);

commit;
