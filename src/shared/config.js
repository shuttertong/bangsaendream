// Public settings for the deployed game. The Supabase publishable key is meant to be public:
// it ships to every browser, and the table's row-level security only lets it ADD feedback
// (supabase/game_feedback.sql) — never read, change or delete anything.
export const GAME_VERSION = '2026.10.03-13';                 // shown on the title card: bump on each deploy

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

// Online multiplayer on https hosts (core/realtime.js): Supabase Realtime, public channel.
// The free plan allows ~100 messages/s and 2 million a month, so online play sends less often.
export const REALTIME = {
  url: 'wss://rlkmjujiidvtjmvfrrfw.supabase.co/realtime/v1/websocket',
  key: FEEDBACK.key,
  topic: 'realtime:bangsaendream-hub',
  heartbeat: 25, tries: 3, backoff: [1000, 15000],   // seconds; failed attempts before staying single-player; ms
  hostTimeout: 3,                                    // seconds of silence before another player hosts the trucks
  rates: { sendHz: 4, keepAlive: 3, truckHz: 3, delay: 0.35 },   // vs. Wi-Fi: 10 / 2 / 10 / 0.15
};

// ร้านพันธมิตร — real shops on the map (supabase/partners.sql, admin.html, town/partners.js). Prices in THB.
export const PARTNERS = {
  rest: 'https://rlkmjujiidvtjmvfrrfw.supabase.co/rest/v1',
  key: FEEDBACK.key,
  range: 3.2,                                // metres from the counter to get the coupon prompt
  visitRange: 12,                            // metres that count as a visit (once per browser session)
  prices: {
    pin: { th: 'หมุด', price: 300 }, shop: { th: 'ร้าน', price: 900 }, game: { th: 'สปอนเซอร์มินิเกม', price: 2500 },
    event: { th: 'อีเวนต์', price: 3000 }, coupon: { th: 'คูปอง (ต่อใบที่ใช้)', price: 15 },
  },
};
