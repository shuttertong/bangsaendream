-- บางแสนในฝัน · ร้านพันธมิตร (partner shops on the map) — run once in the game's Supabase project
-- (rlkmjujiidvtjmvfrrfw): dashboard → SQL Editor → paste → Run.
--
-- BEFORE RUNNING: put your own login email in the app_admins insert near the top.
-- Then in Authentication → URL Configuration add the admin page to "Redirect URLs":
--   https://shuttertong.github.io/bangsaendream/admin.html   and   http://localhost:8000/admin.html
--
-- What the public (publishable) key can do: read APPROVED placements (through a view with only safe
-- columns), ask for a coupon (issue_coupon, rate-limited, server-generated code) and count a visit.
-- Nothing else. The admin (you) does everything through admin.html after a magic-link login.

create extension if not exists pgcrypto;

-- ---------- who is the admin ----------
create table if not exists public.app_admins (email text primary key);
insert into public.app_admins (email) values ('YOUR_EMAIL@example.com') on conflict do nothing;   -- <- change this

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_admins where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

-- ---------- tables ----------
create table if not exists public.partners (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null check (char_length(name) between 1 and 80),
  owner_email text,                       -- for the partner self-serve page (phase 2)
  phone       text, line_id text, notes text,
  status      text not null default 'active' check (status in ('active', 'paused'))
);

create table if not exists public.placements (
  id             uuid primary key default gen_random_uuid(),
  partner_id     uuid not null references public.partners (id) on delete cascade,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  name           text not null check (char_length(name) between 1 and 40),
  name_en        text check (char_length(name_en) <= 40),
  kind           text not null default 'shop' check (kind in ('cafe', 'restaurant', 'shop', 'rental', 'hotel', 'other')),
  zone           text not null default 'beach' check (zone in ('beach', 'walking', 'laemthaen', 'ksm', 'village')),
  x              numeric not null, z numeric not null, yaw numeric not null default 0,   -- local metres (game coordinates)
  color          text not null default '#d8743a' check (color ~ '^#[0-9a-fA-F]{6}$'),
  logo_url       text,
  hours          text check (char_length(hours) <= 40),
  line1 text, line2 text, line3 text,     -- NPC lines (phase 2), max 80 chars each
  package        text not null default 'pin' check (package in ('pin', 'shop', 'game', 'event')),
  coupon_enabled boolean not null default false,
  coupon_text    text check (char_length(coupon_text) <= 60),   -- what the coupon gives, e.g. "ลด ฿10"
  coupon_cap_day int not null default 20 check (coupon_cap_day between 0 and 500),
  status         text not null default 'pending' check (status in ('draft', 'pending', 'approved', 'paused', 'rejected')),
  review_note    text,
  starts_on      date, ends_on date,
  constraint lines_len check (coalesce(char_length(line1), 0) <= 80 and coalesce(char_length(line2), 0) <= 80 and coalesce(char_length(line3), 0) <= 80)
);
create index if not exists placements_status_idx on public.placements (status);

create table if not exists public.coupons (
  id           uuid primary key default gen_random_uuid(),
  code         text not null check (code ~ '^[0-9]{6}$'),
  placement_id uuid not null references public.placements (id) on delete cascade,
  player       text not null check (char_length(player) between 4 and 40),   -- random per-browser id, not a person
  issued_at    timestamptz not null default now(),
  expires_at   timestamptz not null,
  status       text not null default 'issued' check (status in ('issued', 'redeemed', 'expired')),
  redeemed_at  timestamptz, redeemed_by text
);
create unique index if not exists coupons_live_code on public.coupons (code) where status = 'issued';
create index if not exists coupons_placement_day on public.coupons (placement_id, issued_at);

create table if not exists public.visits (                 -- daily totals only, no player identity
  placement_id uuid not null references public.placements (id) on delete cascade,
  day          date not null default current_date,
  count        int not null default 0,
  primary key (placement_id, day)
);

create table if not exists public.invoices (
  id         uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id) on delete cascade,
  month      date not null,                                -- first day of the month billed
  amount     numeric not null default 0,
  lines      jsonb not null default '[]',
  status     text not null default 'due' check (status in ('due', 'paid', 'void')),
  paid_at    timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.audit (                  -- who changed what (admin page writes these)
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  who        text, what text, target uuid, detail jsonb
);

-- ---------- row-level security: admin only; the public goes through the view and the functions ----------
alter table public.partners   enable row level security;
alter table public.placements enable row level security;
alter table public.coupons    enable row level security;
alter table public.visits     enable row level security;
alter table public.invoices   enable row level security;
alter table public.audit      enable row level security;
do $$ declare t text; begin
  foreach t in array array['partners', 'placements', 'coupons', 'visits', 'invoices', 'audit'] loop
    execute format('drop policy if exists admin_all on public.%I', t);
    execute format('create policy admin_all on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;
revoke all on public.partners, public.placements, public.coupons, public.visits, public.invoices, public.audit from anon;
grant select, insert, update, delete on public.partners, public.placements, public.coupons, public.visits, public.invoices, public.audit to authenticated;

-- what the game may read: approved placements inside their campaign dates, safe columns only
create or replace view public.public_placements with (security_invoker = false) as
  select id, name, name_en, kind, zone, x, z, yaw, color, logo_url, hours, package, coupon_enabled, coupon_text
  from public.placements
  where status = 'approved' and (starts_on is null or starts_on <= current_date) and (ends_on is null or ends_on >= current_date);
grant select on public.public_placements to anon, authenticated;

-- ---------- functions the game calls ----------
-- A coupon for this player at this shop: one per player per shop per day (asking again returns the same one),
-- a daily cap per shop, 7-day expiry, server-made 6-digit code (unique among live coupons).
create or replace function public.issue_coupon(p_placement uuid, p_player text)
returns table (code text, expires_at timestamptz, shop text, coupon_text text)
language plpgsql security definer set search_path = public as $$
declare pl public.placements%rowtype; c public.coupons%rowtype; n int; newcode text; tries int := 0;
begin
  if p_player is null or char_length(p_player) not between 4 and 40 then raise exception 'bad player'; end if;
  select * into pl from public.placements where id = p_placement and status = 'approved' and coupon_enabled
    and (starts_on is null or starts_on <= current_date) and (ends_on is null or ends_on >= current_date);
  if not found then raise exception 'no coupons here'; end if;
  select * into c from public.coupons where placement_id = p_placement and player = p_player and status = 'issued'
    and issued_at::date = current_date and expires_at > now() limit 1;
  if found then return query select c.code, c.expires_at, pl.name, pl.coupon_text; return; end if;
  select count(*) into n from public.coupons where placement_id = p_placement and issued_at::date = current_date;
  if n >= pl.coupon_cap_day then raise exception 'cap'; end if;
  loop
    newcode := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (select 1 from public.coupons where public.coupons.code = newcode and status = 'issued' and public.coupons.expires_at > now());
    tries := tries + 1; if tries > 50 then raise exception 'busy'; end if;
  end loop;
  insert into public.coupons (code, placement_id, player, expires_at) values (newcode, p_placement, p_player, now() + interval '7 days') returning * into c;
  return query select c.code, c.expires_at, pl.name, pl.coupon_text;
end $$;
revoke all on function public.issue_coupon(uuid, text) from public;
grant execute on function public.issue_coupon(uuid, text) to anon, authenticated;

-- The shop (or the admin) types the code the kid shows: marks it used, once.
create or replace function public.redeem_coupon(p_code text)
returns table (ok boolean, shop text, coupon_text text, reason text)
language plpgsql security definer set search_path = public as $$
declare c public.coupons%rowtype; pl public.placements%rowtype; me text := coalesce(auth.jwt() ->> 'email', '');
begin
  if me = '' then return query select false, null::text, null::text, 'login'; return; end if;
  select * into c from public.coupons where public.coupons.code = p_code and status = 'issued' order by issued_at desc limit 1;
  if not found then return query select false, null::text, null::text, 'unknown'; return; end if;
  select * into pl from public.placements where id = c.placement_id;
  if not public.is_admin() and not exists (select 1 from public.partners p where p.id = pl.partner_id and lower(p.owner_email) = lower(me)) then
    return query select false, null::text, null::text, 'not yours'; return;
  end if;
  if c.expires_at < now() then update public.coupons set status = 'expired' where id = c.id; return query select false, pl.name, pl.coupon_text, 'expired'; return; end if;
  update public.coupons set status = 'redeemed', redeemed_at = now(), redeemed_by = me where id = c.id;
  return query select true, pl.name, pl.coupon_text, 'ok';
end $$;
revoke all on function public.redeem_coupon(text) from public;
grant execute on function public.redeem_coupon(text) to authenticated;

-- A kid walked up to the shop (counted once per browser session by the game): daily total +1.
create or replace function public.log_visit(p_placement uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.placements where id = p_placement and status = 'approved') then return; end if;
  insert into public.visits (placement_id, day, count) values (p_placement, current_date, 1)
  on conflict (placement_id, day) do update set count = public.visits.count + 1;
end $$;
revoke all on function public.log_visit(uuid) from public;
grant execute on function public.log_visit(uuid) to anon, authenticated;

-- ---------- logos: a public bucket the admin uploads into ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('logos', 'logos', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
  on conflict (id) do nothing;
drop policy if exists logos_admin_write on storage.objects;
create policy logos_admin_write on storage.objects for all to authenticated
  using (bucket_id = 'logos' and public.is_admin()) with check (bucket_id = 'logos' and public.is_admin());
drop policy if exists logos_public_read on storage.objects;
create policy logos_public_read on storage.objects for select to anon, authenticated using (bucket_id = 'logos');
