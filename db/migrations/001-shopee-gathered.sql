-- Gathered Shopee listings (scripts/gather-shopee.mts): keep what the public search shows.
-- image_url is a link to Shopee's CDN only; no seller photo is copied or stored.
begin;
alter table shopee_listings
  add column if not exists image_url text,
  add column if not exists price_thb numeric(12, 2),
  add column if not exists shop_name text,
  add column if not exists rating real;
alter table shopee_listings drop constraint if exists shopee_listings_source_check;
alter table shopee_listings add constraint shopee_listings_source_check
  check (source in ('snapshot', 'addition', 'exact_match', 'search'));
commit;
