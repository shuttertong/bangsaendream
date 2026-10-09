// What the people in the background say when the kid talks to them (crowd.js: sellers, shoppers
// and people at the tables; strollers.js: people walking the market road). One line of small
// talk from the pool for what they are doing, never the same line twice in a row. Fictional
// people; real place names only, no brands or shop names.

// name tags by body type (`kind` in crowd.js / strollers.js); sellers get their own
export const WHO = {
  aunt: { th: 'คุณป้า', en: 'Auntie' }, uncle: { th: 'คุณลุง', en: 'Uncle' },
  sis: { th: 'พี่สาว', en: 'Big sister' }, bro: { th: 'พี่ชาย', en: 'Big brother' },
  girl: { th: 'น้องสาว', en: 'Girl' }, boy: { th: 'น้องชาย', en: 'Boy' },
  sellerF: { th: 'แม่ค้า', en: 'Stall owner' }, sellerM: { th: 'พ่อค้า', en: 'Stall owner' },
};
const WOMEN = ['aunt', 'sis'], CHILDREN = ['girl', 'boy'];

export const CHATTER = {
  seller: [
    { th: 'รับอะไรดีจ๊ะหนู ร้านนี้ของอร่อยทุกอย่างเลยนะ', en: 'What would you like, dear? Everything here is tasty!' },
    { th: 'หมึกย่างร้อน ๆ จ้า หอมไปทั้งถนนเลย', en: 'Hot grilled squid! You can smell it all down the street.' },
    { th: 'วันนี้ลมทะเลเย็นดี คนเดินเยอะ ขายดีจัง', en: 'Lovely sea breeze today. So many people out, business is good!' },
    { th: 'มาเที่ยวบ้านยายเหรอจ๊ะ ปิดเทอมนี้เที่ยวให้สนุกนะ', en: 'Visiting your grandma? Have a lovely school break!' },
    { th: 'ข้าวหลามต้องกินตอนอุ่น ๆ นะหนู ของยายหนูอร่อยที่สุดแล้ว', en: "Khao lam is best while it's warm. Your grandma's is the best there is." },
    { th: 'ขึ้นเขาสามมุขระวังลิงนะ ถือขนมไปมันแย่งเอาได้', en: 'Mind the monkeys on Khao Sam Muk. They will snatch your snacks.' },
    { th: 'เก็บค่าขนมไว้ดี ๆ นะ เดี๋ยวได้เอาไปแต่งตัวสวย ๆ', en: 'Save your pocket money and you can dress up nicely.' },
    { th: 'หิวไหมจ๊ะ ส้มตำป้านวลหน้าหาดก็อร่อยนะ คนแน่นทุกวัน', en: "Hungry? Aunt Nuan's som tam by the beach is great. It's packed every day." },
    { th: 'ของสดใหม่ทุกวันจ้า เรือเข้าเมื่อเช้านี้เอง', en: 'Fresh every day! The boat came in just this morning.' },
  ],
  shopper: [
    { th: 'อันนี้น่ากินจัง จะซื้ออันไหนดีนะ', en: 'This looks yummy. Which one should I get?' },
    { th: 'ของฝากเยอะไปหมด เลือกไม่ถูกแล้ว', en: "So many souvenirs, I can't choose." },
    { th: 'มาบางแสนทีไร ต้องแวะถนนคนเดินทุกที', en: 'Every time I come to Bang Saen, I have to stop at the walking street.' },
    { th: 'หนูมาคนเดียวเหรอ เดินดี ๆ นะ คนเยอะ', en: 'Out on your own? Mind the crowd.' },
    { th: 'เดี๋ยวจะไปดูพระอาทิตย์ตกที่แหลมแท่น สวยมากเลยนะ', en: "I'm off to watch the sunset at Laem Thaen. It's beautiful." },
    { th: 'ลองนั่งรถแดงหรือยัง สิบบาทเอง นั่งชมวิวสบายเลย', en: 'Tried the red truck yet? Just ten baht, and a lovely ride.' },
    { th: 'ต่อราคาไม่เก่งเลย หนูช่วยเลือกหน่อยสิ', en: "I'm no good at haggling. Help me pick one?" },
  ],
  guest: [
    { th: 'นั่งกินลมชมทะเลแบบนี้ สบายที่สุดแล้ว', en: 'Eating by the sea in the breeze. Nothing better.' },
    { th: 'อาหารทะเลที่นี่สดมาก ลองหมึกย่างดูสิ', en: 'The seafood here is so fresh. Try the grilled squid.' },
    { th: 'วันนี้คลื่นกำลังดี เด็ก ๆ เล่นห่วงยางกันสนุกเลย', en: 'Good waves today. The kids are having fun on the inner tubes.' },
    { th: 'อิ่มแล้วเดี๋ยวจะไปเดินเล่นที่สะพานราชนาวีต่อ', en: "Once we're full, we'll take a stroll on the Navy pier." },
    { th: 'หนูกินข้าวหรือยัง อย่าเล่นจนลืมกินข้าวนะ', en: "Have you eaten? Don't play so hard you forget to." },
    { th: 'ใต้ร่มสีฟ้าขาวนี่แหละ บางแสนของแท้', en: 'Under a blue-and-white umbrella. This is the real Bang Saen.' },
  ],
  stroller: [
    { th: 'อากาศดีจัง เดินเล่นตอนเย็นแบบนี้ชอบที่สุด', en: 'Lovely weather. An evening walk like this is my favourite.' },
    { th: 'ถนนคนเดินวันนี้ของกินเยอะเลย เดินจนเมื่อยแล้ว', en: 'So much food at the walking street today. My feet are tired!' },
    { th: 'ไปจุดชมวิวเขาสามมุขมาหรือยัง เห็นทะเลทั้งอ่าวเลยนะ', en: 'Been up to the Khao Sam Muk viewpoint? You can see the whole bay.' },
    { th: 'หมวกสวยจัง ซื้อที่ไหนเหรอ', en: 'Nice hat! Where did you get it?' },
    { th: 'กำลังหาร้านขนมอยู่เลย หนูรู้ไหมร้านไหนอร่อย', en: "I'm looking for a snack stall. Do you know a good one?" },
    { th: 'ได้ยินว่าตกหมึกตอนกลางคืนที่แหลมแท่นสนุกมาก', en: 'I hear squid fishing at night off Laem Thaen is great fun.' },
    { th: 'สวัสดีจ้ะ มาเที่ยวเหมือนกันเหรอ', en: 'Hello there! Here on holiday too?' },
  ],
  child: [
    { th: 'พี่ไปเล่นบานาน่าโบ๊ทมาหรือยัง สนุกมากเลย!', en: "Have you been on the banana boat yet? It's so much fun!" },
    { th: 'อยากกินไอติมจัง แต่ต้องกินข้าวก่อน', en: 'I want ice cream, but I have to eat dinner first.' },
    { th: 'เมื่อกี้เห็นปูลมวิ่งเร็วมาก จับไม่ทันเลย', en: "I just saw a ghost crab. It ran so fast I couldn't catch it." },
    { th: 'ชุดพี่เท่จัง!', en: 'Your outfit is so cool!' },
    { th: 'เล่นด้วยกันไหม เราชอบเล่นห่วงยาง', en: 'Want to play? I love the inner tubes.' },
    { th: 'เราเก็บเปลือกหอยได้ตั้งเยอะ พี่เก็บได้กี่อันแล้ว', en: 'I found loads of shells. How many have you got?' },
  ],
};

/** The name tag and the script (one line) for someone doing `role`, of body type `kind`. */
export function chatFor(role, kind) {
  const pool = CHATTER[CHILDREN.includes(kind) ? 'child' : role] || CHATTER.stroller;
  let last = -1;
  return {
    name: role === 'seller' ? WHO[WOMEN.includes(kind) ? 'sellerF' : 'sellerM'] : WHO[kind] || WHO.sis,
    script() {
      let i = Math.floor(Math.random() * pool.length);
      if (i === last) i = (i + 1) % pool.length;
      last = i;
      return [{ say: pool[i] }];
    },
  };
}
