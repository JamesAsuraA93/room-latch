-- Self-check for schema rules. Runs in a transaction and rolls back; safe on a seeded DB.
-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/checks.sql   (prints "checks ok")
begin;

insert into profiles (user_id, handle, display_name) values ('u_owner', 'pim_room', 'พิม'), ('u_fan', 'ton_99', 'ต้น');

-- draft: no images, no consent
insert into designs (id, owner_id, room_type, style_id, budget_thb, width_cm, total_max_thb)
values ('00000000-0000-4000-8000-000000000001', 'u_owner', 'condo', 'japandi', 5000, 80, 4620);
insert into design_items (design_id, position, catalog_item_id, x_pct, y_pct, w_pct) values
  ('00000000-0000-4000-8000-000000000001', 0, 'fixture-desk-steel-60', 20, 60, 30);
insert into design_items (design_id, position, listing_id, locked) values
  ('00000000-0000-4000-8000-000000000001', 1, 'shopee-1272585684-27313552963', true);

do $$
begin
  -- publishing without consent must fail
  begin
    update designs set before_path = 'designs/00000000-0000-4000-8000-000000000001/before.jpg',
      after_path = 'designs/00000000-0000-4000-8000-000000000001/after.png', after_kind = 'ai_render',
      image_w = 1447, image_h = 1087, published_at = now()
    where id = '00000000-0000-4000-8000-000000000001';
    raise exception 'FAIL: published without consent';
  exception when check_violation then null;
  end;
  -- an item must point to exactly one product
  begin
    insert into design_items (design_id, position) values ('00000000-0000-4000-8000-000000000001', 2);
    raise exception 'FAIL: item without product';
  exception when check_violation then null;
  end;
  -- image paths must stay inside the design folder
  begin
    update designs set before_path = '../samples/living-before.jpg' where id = '00000000-0000-4000-8000-000000000001';
    raise exception 'FAIL: path outside designs/';
  exception when check_violation then null;
  end;
end $$;

-- publish with consent, then another user likes, saves and remixes it
update designs set before_path = 'designs/00000000-0000-4000-8000-000000000001/before.jpg',
  after_path = 'designs/00000000-0000-4000-8000-000000000001/after.png', after_kind = 'ai_render',
  image_w = 1447, image_h = 1087, consent_at = now(), published_at = now()
where id = '00000000-0000-4000-8000-000000000001';
insert into design_likes values ('00000000-0000-4000-8000-000000000001', 'u_fan');
insert into design_saves values ('00000000-0000-4000-8000-000000000001', 'u_fan');
insert into designs (owner_id, room_type, style_id, budget_thb, width_cm, remix_of)
values ('u_fan', 'condo', 'japandi', 3500, 80, '00000000-0000-4000-8000-000000000001');

do $$
begin
  if (select count(*) from designs where published_at is not null) <> 1 then raise exception 'FAIL: feed count'; end if;
  -- owner deletes account: their design, items, likes and saves go; the remix stays, unlinked
  delete from profiles where user_id = 'u_owner';
  if exists (select 1 from design_items where design_id = '00000000-0000-4000-8000-000000000001') then raise exception 'FAIL: items left'; end if;
  if exists (select 1 from design_saves) or exists (select 1 from design_likes) then raise exception 'FAIL: likes/saves left'; end if;
  if (select remix_of from designs where owner_id = 'u_fan') is not null then raise exception 'FAIL: remix link left'; end if;
  raise notice 'checks ok';
end $$;

rollback;
