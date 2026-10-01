// Public settings for the deployed game. The Supabase publishable key is meant to be public:
// it ships to every browser, and the table's row-level security only lets it ADD feedback
// (supabase/game_feedback.sql) — never read, change or delete anything.
export const GAME_VERSION = '2026.10.01';

export const FEEDBACK = {
  url: 'https://rlkmjujiidvtjmvfrrfw.supabase.co/rest/v1/game_feedback',   // the game's own project (not the flood map's)
  key: 'sb_publishable_kxmi-f_EGl1wgw4TPZX-8A_h4RJDY08',   // publishable key (public by design); empty = the 💌 button stays hidden
  kinds: [                                   // id must match the table's check constraint
    { id: 'idea', icon: '💡' }, { id: 'bug', icon: '🐞' }, { id: 'like', icon: '❤️' }, { id: 'game', icon: '🎮' },
  ],
  min: 3, max: 500,                          // message length (also enforced by the table)
  cooldown: 60,                              // seconds between messages from one player
  timeout: 12,                               // seconds before a send counts as failed
};
