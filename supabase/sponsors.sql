-- ผู้สนับสนุน / sponsors: a building on the map dressed as a real shop, and the inbox of requests from
-- players who picked a building in the game (town/sponsor.js). Run AFTER partners.sql in the SQL editor.
-- Payment is not in the game: a request lands here, you contact the shop, confirm the PromptPay transfer,
-- then create or approve the placement in admin.html with the tier and the building the request names.

-- ---------- placements can be a building, not only a kiosk ----------
alter table public.placements add column if not exists tier text not null default 'kiosk' check (tier in ('kiosk', 'sign', 'building', 'game'));
alter table public.placements add column if not exists bx numeric;          -- the building's footprint centre (local metres); null for a kiosk
alter table public.placements add column if not exists bz numeric;
alter table public.placements add column if not exists game text check (game is null or game ~ '^[a-z]{2,12}$');   -- the sponsored mini-game (tier 'game')
alter table public.placements add column if not exists sign_text text check (sign_text is null or char_length(sign_text) <= 40);

create or replace view public.public_placements with (security_invoker = false) as
  select id, name, name_en, kind, zone, x, z, yaw, color, logo_url, hours, package, coupon_enabled, coupon_text, tier, bx, bz, game, sign_text
  from public.placements
  where status = 'approved' and (starts_on is null or starts_on <= current_date) and (ends_on is null or ends_on >= current_date);
grant select on public.public_placements to anon, authenticated;

-- ---------- requests from the game: anyone may add one, only the admin reads them ----------
create table if not exists public.sponsor_requests (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  x          numeric not null, z numeric not null,                 -- the building picked (footprint centre, local metres)
  building   text check (char_length(building) <= 40),           -- what the game called it ("ตึกแถว 3 คูหา ถนนเลียบหาด")
  tier       text not null check (tier in ('sign', 'building', 'game')),
  shop_name  text not null check (char_length(shop_name) between 1 and 40),
  contact    text not null check (char_length(contact) between 3 and 120),   -- phone / LINE / e-mail, as the sender typed it
  message    text check (char_length(message) <= 300),
  lang       text check (lang in ('th', 'en')),
  player     text check (char_length(player) <= 40),             -- the game's random per-browser id (rate limiting only)
  status     text not null default 'new' check (status in ('new', 'contacted', 'done', 'dropped')),
  note       text
);
alter table public.sponsor_requests enable row level security;
drop policy if exists "players may ask" on public.sponsor_requests;
create policy "players may ask" on public.sponsor_requests for insert to anon, authenticated with check (true);
drop policy if exists admin_all on public.sponsor_requests;
create policy admin_all on public.sponsor_requests for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.sponsor_requests from anon;
grant insert (x, z, building, tier, shop_name, contact, message, lang, player) on public.sponsor_requests to anon, authenticated;
grant select, update, delete on public.sponsor_requests to authenticated;
