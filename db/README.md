# RoomLatch database (Postgres / Neon)

`schema.sql` creates the catalog tables. `seed.sql` fills them from the same files the app reads:

| Table | Rows | From |
|---|---|---|
| `styles` | 8 | app styles |
| `room_types` | 5 | app room types |
| `catalog_items` | 65 | `catalog/products.csv` (50 price ranges) + `lib/fixtures.ts` (15 demo fixtures) |
| `catalog_item_styles` | 177 | style tags of those items |
| `shopee_listings` | 51 | `catalog/shopee-real-snapshot.csv` (26) + `shopee-real-additions.csv` (24) + exact lamp match (1) |
| `shopee_listing_styles` | 129 | style tags of those listings |

Prices are team ranges, not live Shopee prices. Listings store only what was seen (title, link,
verification level, size as stated); there are no price, stock or image columns.

`source = 'search'` rows come from `scripts/gather-shopee.mts` (Shopee public search + local Codex CLI
deciding keep/category/styles). They add `image_url` (Shopee CDN link, checked to load, not copied),
`price_thb` and `rating` as shown on the day (`checked_on`), and `shop_name`. Existing databases need
`db/migrations/001-shopee-gathered.sql` first. Rerun:
`node --env-file=.env.local scripts/gather-shopee.mts` (`--dry` = no writes, `--self-test` = offline checks).

## Users and Feed (empty until people sign up)

| Table | What |
|---|---|
| `profiles` | one row per Better Auth user (`user_id` = auth `user.id`) |
| `designs` | a room plan + placed products. Draft while `published_at` is null; published = Feed post |
| `design_items` | products in a design: one `catalog_items` or `shopee_listings` row each, with position |
| `design_likes`, `design_saves` | likes, and the Saved tab |

Publishing needs both image paths and `consent_at` (DB check). Images go to Object storage at
`designs/<design id>/before.jpg` and `after.png|jpg|webp`; strip EXIF/GPS and resize before upload.
Deleting a profile cascades to its designs, items, likes and saves; the app must also delete the
files under `designs/<id>/`. Shopee seller photos are never stored.

## AI render jobs

`render_jobs` holds the status of renders run by the OpenAI provider (production) and backs the daily
limits; the output image is at `renders/<job id>.png` in Object storage. Rows and images are purged 24 hours
after a job starts. `client_key` is a hash of the caller's IP, never the address. Existing databases need
`db/migrations/002-render-jobs.sql`. `npm run test:db` exercises the store in a rolled-back transaction.

`checks.sql` exercises these rules in a rolled-back transaction and prints `checks ok`.

## Load into Neon

Put the connection string in an env var, never in a command or file:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/schema.sql -f db/seed.sql
```

Run it once on an empty database (both files run in a transaction; a second run fails on the
existing tables).

## Regenerate the seed

After changing the CSVs or fixtures:

```bash
npm run db:seed
```
