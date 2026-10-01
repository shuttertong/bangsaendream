-- บางแสนในฝัน: players' requests and feedback (the in-game 💌 form, src/shared/feedback.js).
-- Run once in project rlkmjujiidvtjmvfrrfw (the game's own project): dashboard → SQL Editor, or via the Supabase MCP.
-- Anyone may ADD a message through the public (publishable) key; nobody can read, change or
-- delete messages through it — only you, in the dashboard (Table Editor → game_feedback).
-- No personal data is collected: no names, emails or phone numbers, just the message and a
-- little context (what kind, language, phone/tablet/desktop, nearest place, game version).

create table if not exists public.game_feedback (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  game        text not null default 'bangsaendream' check (game = 'bangsaendream'),
  kind        text not null check (kind in ('idea', 'bug', 'like', 'game', 'other')),
  message     text not null check (char_length(message) between 3 and 500),
  lang        text check (lang in ('th', 'en')),
  device      text check (device in ('phone', 'tablet', 'desktop')),
  place       text check (char_length(place) <= 40),
  version     text check (char_length(version) <= 40)
);

alter table public.game_feedback enable row level security;

drop policy if exists "players can send feedback" on public.game_feedback;
create policy "players can send feedback"
  on public.game_feedback for insert
  to anon, authenticated
  with check (true);
-- (no select / update / delete policies: the public key can only insert)

revoke all on public.game_feedback from anon, authenticated;
grant insert (kind, message, lang, device, place, version) on public.game_feedback to anon, authenticated;
