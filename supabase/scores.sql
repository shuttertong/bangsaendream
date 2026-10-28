-- กระดานคะแนน / leaderboard for ปิดเทอมที่บางแสน (shared/scores.js, town/leaderboard.js).
-- One row per player per mini-game: their best round (baht) and, for ตะกร้อวง, the longest streak.
-- Players have no accounts: the row is keyed by the game's own per-device friend id (shared/friends.js),
-- so anyone can write any row. That is accepted for a kids' game with nothing at stake; the checks
-- below only keep the values sane. Run this in the Supabase SQL editor of project rlkmjujiidvtjmvfrrfw.
create table if not exists public.game_scores (
  uid        text not null,
  game       text not null check (game ~ '^[a-z]{2,12}$'),
  name       text not null check (char_length(name) between 1 and 40),
  baht       integer not null check (baht between 0 and 10000),
  streak     integer not null default 0 check (streak between 0 and 10000),
  updated_at timestamptz not null default now(),
  primary key (uid, game)
);
alter table public.game_scores enable row level security;
create policy "scores are public"       on public.game_scores for select to anon, authenticated using (true);
create policy "anyone may post a best"  on public.game_scores for insert to anon, authenticated with check (uid ~ '^[0-9]{1,7}-[0-9]{1,7}$');
create policy "anyone may raise a best" on public.game_scores for update to anon, authenticated using (true) with check (uid ~ '^[0-9]{1,7}-[0-9]{1,7}$');
create index if not exists game_scores_top on public.game_scores (game, baht desc);
