// Public settings for the deployed game. The Supabase publishable key is meant to be public:
// it ships to every browser, and the table's row-level security only lets it ADD feedback
// (supabase/game_feedback.sql) — never read, change or delete anything.
export const GAME_VERSION = '2026.10.01';

export const FEEDBACK = {
  url: 'https://vyvmxmqbxoxyngzzisqe.supabase.co/rest/v1/game_feedback',
  key: 'sb_publishable_HZ_xvmYhprSJOegr0Gixcg_-JrA-wES',
  kinds: [                                   // id must match the table's check constraint
    { id: 'idea', icon: '💡' }, { id: 'bug', icon: '🐞' }, { id: 'like', icon: '❤️' }, { id: 'game', icon: '🎮' },
  ],
  min: 3, max: 500,                          // message length (also enforced by the table)
  cooldown: 60,                              // seconds between messages from one player
  timeout: 12,                               // seconds before a send counts as failed
};
