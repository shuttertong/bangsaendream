// Who lives in the hub: looks (people/body.js), where they stand (a place id from
// places.js) and what they say. All names are fictional. Scripts are arrays of steps:
//   { say: {th, en} }                     a line of dialogue
//   { give: { baht } }                    reward
//   { flag: 'id' } / { quest: [id, st] }  story state
//   { ask: [{ label, then: [steps] }] }   choices
//   { game: 'crab' }                      offer a mini-game
//   { coop: 'banana' }                    start a co-op lobby (multiplayer; solo when offline)
// A script function receives the save data so lines can depend on progress.

const ADULT = { scale: 1.32, headScale: 0.86 };

export const ROSTER = [
  {
    id: 'grandma', place: 'grandma',
    name: { th: 'ยาย', en: 'Grandma' },
    look: { ...ADULT, scale: 1.2, skin: '#c99a74', hair: '#d9d6d0', hairStyle: 'bun', shirt: '#b98fb8', shirtTrim: '#e9dfe8',
      bottom: 'skirt', bottomColor: '#6a4a7a', hat: 'none', glasses: true, shoe: '#6a5040', belly: 0.4 },
    script: s => {
      const has = pre => Object.keys(s.bag).find(k => k.startsWith(pre) && s.bag[k] > 0);
      if (!s.met.grandma) return [
        { say: { th: 'มาถึงแล้วเหรอหลาน! ปิดเทอมนี้อยู่กับยายที่บางแสนนะ', en: 'You made it! This school break you\'re staying with me in Bang Saen.' } },
        { say: { th: 'แถวนี้มีแต่คนใจดี ลองไปทักทายเพื่อนบ้านดูสิ', en: 'Everyone around here is friendly. Go and say hello to the neighbours.' } },
        { say: { th: 'เอ้า เอาเงินนี่ไปซื้อขนมกินนะ', en: 'Here, take this for snacks.' } },
        { give: { baht: 100 } },
        { quest: ['visitGrandma', 'done'] }, { quest: ['meetFriends', 'active'] },
      ];
      if (s.quests.dinner === 'active') {
        const item = has('squid_') || has('crab_');
        return item ? [
          { say: { th: 'โอ้โห ได้ของทะเลมาด้วย! คืนนี้ยายจะทำกับข้าวอร่อย ๆ ให้กินนะ', en: 'Oh my, you brought something from the sea! I\'ll cook us something delicious tonight.' } },
          { take: item }, { flag: 'gaveDinner' },
          { say: { th: 'ไปเล่นก่อน เดี๋ยวพระอาทิตย์ตกแล้วกลับมากินข้าวนะ', en: 'Go and play. Come back for dinner when the sun goes down.' } },
        ] : [
          { say: { th: 'ยายอยากทำหมึกผัดไข่ ลองไปตกหมึกกับลุงเปี๊ยก หรือจับปูลมกับลุงแดงมาให้ยายหน่อยสิ', en: 'I\'d love to make squid with egg. Go jigging with Uncle Piak, or catch crabs with Uncle Daeng, and bring me some?' } },
        ];
      }
      if (s.quests.ending === 'active') return [
        { say: { th: 'มาแล้วเหรอ ข้าวเสร็จพอดีเลย กินเยอะ ๆ นะหลาน', en: 'There you are, dinner\'s just ready. Eat up!' } },
        { say: { th: 'ปิดเทอมนี้หลานได้เพื่อนเยอะ ได้เที่ยวทั่วบางแสนเลยนะ', en: 'You made so many friends this break, and saw all of Bang Saen.' } },
        { say: { th: 'ยายดีใจมากที่หลานมาอยู่ด้วย ปิดเทอมหน้ามาอีกนะ', en: 'I\'m so happy you came to stay. Come back next break, won\'t you?' } },
        { flag: 'ending' }, { ending: true },
      ];
      return [
        { say: { th: 'กินข้าวหรือยังหลาน? อย่าลืมกลับมาก่อนมืดนะ', en: 'Have you eaten yet, dear? Be home before dark.' } },
        ...(s.quests.meetFriends === 'done' && !s.flags.grandmaThanks ? [
          { say: { th: 'ได้ยินว่าหลานรู้จักคนทั้งหาดแล้ว เก่งมาก! ยายให้ค่าขนมเพิ่ม', en: 'I hear you know the whole beach now. Here, a little extra pocket money!' } },
          { give: { baht: 50 } }, { flag: 'grandmaThanks' },
        ] : []),
        { ask: [
          { label: { th: '🎋 ช่วยยายขายข้าวหลาม', en: '🎋 Help sell khao lam' }, then: [
            { say: { th: 'ดีเลยหลาน เอาค้อนทุบกะเทาะเปลือกให้บาง ๆ นะ อย่าทุบแรงจนข้าวแตกล่ะ', en: "Lovely! Pound the burnt skin off with the hammer, nice and thin, and don't hit so hard the rice cracks." } },
            { game: 'khaolam' },
          ] },
          { label: { th: 'เดี๋ยวค่อยช่วยนะยาย', en: 'Later, Grandma' }, then: [] },
        ] },
      ];
    },
  },
  {
    id: 'tonkla', place: 'beach', game: 'football',
    name: { th: 'ต้นกล้า', en: 'Tonkla' },
    look: { shirt: '#f0b43a', bottomColor: '#3a6a4a', hat: 'cap', hatColor: '#d8443a', hatBand: '#f4f1e8', skin: '#c68f66' },
    script: s => [...(s.met.tonkla ? [
      !s.flags.rodDaeng
        ? { say: { th: 'รู้ไหม มาบางแสนไม่ได้ขึ้นรถแดง แสดงว่ามาไม่ถึงนะ! รถแดงวิ่งอยู่บนถนนเลียบหาด เดินไปท้ายรถแล้วกระโดดขึ้นเลย', en: "You know what they say: if you come to Bang Saen and don't ride the red truck, you haven't really arrived! They run along the beach road; hop on at the back." } }
        : s.quests.playAll === 'active'
        ? { say: { th: 'ลองให้ครบทุกอย่างสิ! ช่วยยายขายข้าวหลาม ตกหมึก ไล่ลิง ลอยห่วงยาง ช่วยป้านวลขายส้มตำ จับปูลม เล่นวอลเลย์กับเตะบอลกับเรา แล้วก็บานาน่าโบ๊ท โซฟาโบ๊ท กับเจ็ทสกีของพี่ต้อม', en: "Try it all! Grandma's khao lam, squid, monkeys, the tube, helping Aunt Nuan, ghost crabs, volleyball and football with me, and Tom's banana boat, sofa boat and jet ski." } }
        : { say: { th: 'เย็นนี้ไปจับปูลมกันไหม? ถามลุงแดงดูสิ', en: 'Want to catch ghost crabs tonight? Ask Uncle Daeng.' } },
    ] : [
      { say: { th: 'หวัดดี! มาเที่ยวบ้านยายเหรอ? เราชื่อต้นกล้า', en: 'Hi! Visiting your grandma? I\'m Tonkla.' } },
      { say: { th: 'ที่นี่สนุกนะ มีทั้งลิงที่เขาสามมุข ปูลม แล้วก็ส้มตำป้านวลอร่อยสุด ๆ', en: 'It\'s fun here: monkeys on Khao Sam Muk, ghost crabs, and Aunt Nuan\'s som tam is the best.' } },
    ]),
      { say: { th: 'เด็กหาดวอนนภามาท้าแข่งอีกแล้ว มาอยู่ทีมเดียวกับเราไหม? เล่นอะไรดี?', en: 'The kids from Wonnapha beach want a match again. Will you be on my team? What shall we play?' } },
      { ask: [
        { label: { th: '🏐 วอลเลย์บอลชายหาด', en: '🏐 Beach volleyball' }, then: [{ game: 'volley' }] },
        { label: { th: '⚽ เตะบอลชายหาด', en: '⚽ Beach football' }, then: [{ game: 'football' }] },
        { label: { th: 'ไว้ก่อนนะ', en: 'Maybe later' }, then: [] },
      ] },
    ],
  },
  {
    id: 'daeng', place: 'crabBeach', game: 'crab',
    name: { th: 'ลุงแดง', en: 'Uncle Daeng' },
    look: { ...ADULT, skin: '#b8835c', shirt: '#e8e4d8', sleeves: 'none', bottom: 'shorts', bottomColor: '#5a4a3a', hat: 'bucket', hatColor: '#7a8a5a', belly: 0.6 },
    script: () => [
      { say: { th: 'ปูลมออกตอนโพล้เพล้ วิ่งเร็วมากนะ ต้องใช้ไฟฉายส่องให้ดี', en: 'Ghost crabs come out at dusk. They\'re fast; you need a good flashlight.' } },
      { ask: [
        { label: { th: 'ไปจับปูลม!', en: 'Let\'s catch crabs!' }, then: [{ game: 'crab' }] },
        { label: { th: 'ไว้ก่อนนะลุง', en: 'Maybe later' }, then: [{ say: { th: 'ได้ ๆ ลุงอยู่แถวนี้แหละ', en: 'Sure, I\'m always around here.' } }] },
      ] },
    ],
  },
  {
    id: 'piak', place: 'laemThaen', game: 'squid',
    name: { th: 'ลุงเปี๊ยก', en: 'Uncle Piak' },
    look: { ...ADULT, skin: '#a8764f', shirt: '#3f6f9a', sleeves: 'long', bottom: 'pants', bottomColor: '#3a3a3a', hat: 'cap', hatColor: '#e8e4d8', hatBand: '#3f6f9a' },
    script: () => [
      { say: { th: 'คืนนี้คลื่นลมสงบ เหมาะกับการตกหมึกที่สุด', en: 'Calm sea tonight. Perfect for squid jigging.' } },
      { ask: [
        { label: { th: 'ขอไปด้วย!', en: 'Take me along!' }, then: [{ game: 'squid' }] },
        { label: { th: 'ยังก่อน', en: 'Not yet' }, then: [] },
      ] },
    ],
  },
  {
    id: 'chai', place: 'viewpoint', game: 'monkey',
    name: { th: 'ลุงชัย', en: 'Uncle Chai' },
    look: { ...ADULT, skin: '#b8835c', shirt: '#6a8a5a', bottom: 'pants', bottomColor: '#6a5a4a', hat: 'none', hairStyle: 'short', hair: '#6a6660' },
    script: () => [
      { say: { th: 'ระวังลิงนะหลาน มันชอบแย่งขนมจากมือเลย', en: 'Watch out for the monkeys. They snatch snacks right out of your hand.' } },
      { ask: [
        { label: { th: 'ช่วยเฝ้าขนม', en: 'Guard the snacks' }, then: [{ game: 'monkey' }] },
        { label: { th: 'ไม่ล่ะ', en: 'No thanks' }, then: [] },
      ] },
    ],
  },
  {
    id: 'fon', place: 'rental', game: 'tube',
    name: { th: 'พี่ฝน', en: 'Fon' },
    look: { ...ADULT, scale: 1.25, skin: '#c68f66', shirt: '#4fb3a8', hairStyle: 'long', hair: '#2a2320', bottom: 'shorts', bottomColor: '#e8e4d8', hat: 'none' },
    script: () => [
      { say: { th: 'เช่าห่วงยางไหมจ๊ะ? วันนี้คลื่นกำลังดีเลย', en: 'Rent an inner tube? The waves are just right today.' } },
      { ask: [
        { label: { th: 'เล่นห่วงยาง', en: 'Ride a tube' }, then: [{ game: 'tube' }] },
        { label: { th: 'ไว้คราวหน้า', en: 'Next time' }, then: [] },
      ] },
    ],
  },
  {
    id: 'tom', place: 'speedboat', game: 'banana',
    name: { th: 'พี่ต้อม', en: 'Tom' },
    look: { ...ADULT, skin: '#a8764f', shirt: '#2f6fc4', sleeves: 'none', bottom: 'shorts', bottomColor: '#f4f1e8', hat: 'cap', hatColor: '#f4f1e8', hatBand: '#e8541e', vest: '#e8541e' },
    script: () => [
      { say: { th: 'มาเล่นเครื่องเล่นทางน้ำกันไหม? ใส่เสื้อชูชีพก่อนนะ!', en: 'Up for a ride on the water? Life vest on first!' } },
      { ask: [
        { label: { th: '🍌 บานาน่าโบ๊ท', en: '🍌 Banana boat' }, then: [{ game: 'banana' }] },
        { label: { th: '🍌👫 บานาน่าโบ๊ทกับเพื่อน', en: '🍌👫 Banana boat with friends' }, then: [{ coop: 'banana' }] },
        { label: { th: '🛋️ โซฟาโบ๊ท', en: '🛋️ Sofa boat' }, then: [{ game: 'sofa' }] },
        { label: { th: '🌊 ขับเจ็ทสกี', en: '🌊 Ride the jet ski' }, then: [{ game: 'jetski' }] },
        { label: { th: 'ไว้ก่อนนะพี่', en: 'Maybe later' }, then: [] },
      ] },
    ],
  },
  {
    id: 'kru', place: 'goHouse', game: 'go',
    name: { th: 'ครูหมาก', en: 'Teacher Mak' },
    look: { ...ADULT, skin: '#c99a74', shirt: '#f4f1e8', sleeves: 'long', bottom: 'pants', bottomColor: '#3a3a3a', hat: 'none', hairStyle: 'short', hair: '#8a8680', glasses: true },
    script: () => [
      { say: { th: 'ยินดีต้อนรับสู่บ้านหมากล้อม! วางหมากล้อมพื้นที่ให้ได้มากกว่าอีกฝ่าย ล้อมหมากเขาได้ก็จับกินได้นะ', en: 'Welcome to the Go house! Surround more of the board than the other side. Surround their stones and you capture them.' } },
      { ask: [
        { label: { th: '⚫ เล่นกับครู', en: '⚫ Play the teacher' }, then: [{ game: 'go' }] },
        { label: { th: '⚫👫 เปิดกระดานรอเพื่อน', en: '⚫👫 Open a table for a friend' }, then: [{ coop: 'go' }] },
        { label: { th: 'ขอดูก่อนครับ', en: 'Just looking' }, then: [] },
      ] },
    ],
  },
  {
    id: 'nuan', place: 'shop', game: 'stall',
    name: { th: 'ป้านวล', en: 'Aunt Nuan' },
    look: { ...ADULT, scale: 1.24, skin: '#c99a74', shirt: '#e8958a', hairStyle: 'bun', bottom: 'skirt', bottomColor: '#3a5a7a', apron: '#f4f1e8', hat: 'none', belly: 0.5 },
    script: () => [
      { say: { th: 'ส้มตำไหมลูก? ร้านป้าลูกค้าเยอะ ช่วยป้าขายหน่อยสิ', en: 'Som tam, dear? The stall is busy. Help me sell?' } },
      { ask: [
        { label: { th: 'ช่วยขายส้มตำ', en: 'Help at the stall' }, then: [{ game: 'stall' }] },
        { label: { th: 'แค่แวะมาทักทาย', en: 'Just saying hi' }, then: [{ say: { th: 'ขอบใจจ้ะ มาอีกนะ', en: 'Thank you, come again!' } }] },
      ] },
    ],
  },
];
