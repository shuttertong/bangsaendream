// Public settings for the deployed game. The Supabase publishable key is meant to be public:
// it ships to every browser, and the table's row-level security only lets it ADD feedback
// (supabase/game_feedback.sql) — never read, change or delete anything.
export const GAME_VERSION = '2026.10.10-1';                 // shown on the title card: bump on each deploy

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

// สนับสนุนเกม — donations (support.html, the landing page, the in-game ⓘ panel). Fill in your own details.
export const SUPPORT = {
  promptpay: '',                             // the PromptPay id to show (phone, citizen id or e-wallet id); empty = the PromptPay block is hidden
  qr: 'assets/support/promptpay.png',        // a picture of the PromptPay QR, if you put one there (optional; hidden when missing)
  links: [],                                 // e.g. { name: 'Ko-fi', url: 'https://ko-fi.com/…' }, { name: 'GitHub Sponsors', url: '…' }
};
// สนับสนุนด้วยตึกในเกม — a real shop sponsors a building on the map (town/sponsor.js, supabase/sponsors.sql, admin.html). Prices in THB per month.
export const SPONSOR = {
  tiers: {
    sign: { icon: '🪧', th: 'ป้ายร้าน', en: 'Shop sign', price: 500, what: { th: 'ป้ายชื่อร้านพร้อมโลโก้บนหน้าตึกที่เลือก และหมุดในเมนูเดินทาง', en: 'Your name and logo on the front of the building you picked, plus a pin in the travel menu' } },
    building: { icon: '🏬', th: 'ทั้งตึก', en: 'Whole building', price: 1500, what: { th: 'ตึกทั้งหลังเป็นสีร้าน มีกันสาด ป้ายข้าง ป้ายบนดาดฟ้า เวลาเปิด และคูปองให้ผู้เล่นเอาไปใช้ที่ร้านจริง', en: 'The whole building in your colour: awning, side banners, a rooftop board, opening hours, and coupons players redeem at the real shop' } },
    game: { icon: '🎮', th: 'ตึก + สปอนเซอร์มินิเกม', en: 'Building + a sponsored mini-game', price: 2500, what: { th: 'ทุกอย่างในแบบทั้งตึก และชื่อ-โลโก้ร้านบนหน้าเริ่มของมินิเกมที่เลือก 1 เกม (ผู้เล่นเห็นทุกครั้งที่เล่น)', en: 'Everything in the whole-building tier, plus your name and logo on the start card of one mini-game, seen every round' } },
  },
  range: 9,                                  // metres from a building front at which the "sponsor this building" prompt shows (pick mode only)
  cooldown: 60,                              // seconds between requests from one browser
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
