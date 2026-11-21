-- Private copy of each listing's Shopee photo in the "assets" bucket (scripts/copy-listing-images.mts).
-- Server-side AI input only (segmentation, reference images); never served to users directly.
begin;
alter table shopee_listings
  add column if not exists image_path text
    constraint shopee_listings_image_path_check check (image_path ~ '^listings/[0-9]+-[0-9]+/original\.(jpg|png|webp)$');
commit;
