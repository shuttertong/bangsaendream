// Who lives in the hub: looks (people/body.js), where they stand (a place id from
// places.js) and what they say. All names are fictional. Scripts are arrays of steps:
//   { say: {th, en} }                     a line of dialogue
//   { give: { baht } }                    reward
//   { flag: 'id' } / { quest: [id, st] }  story state
//   { ask: [{ label, then: [steps] }] }   choices
//   { game: 'crab' }                      offer a mini-game
// A script function receives the save data so lines can depend on progress.

const ADULT = { scale: 1.32, headScale: 0.86 };

export const ROSTER = [
  {
    id: 'grandma', place: 'grandma',
    name: { th: 'ยาย', en: 'Grandma' },
    look: { ...ADULT, scale: 1.2, skin: '#c99a74', hair: '#d9d6d0', hairStyle: 'bun', shirt: '#b98fb8', shirtTrim: '#e9dfe8',
      bottom: 'skirt', bottomColor: '#6a4a7a', hat: 'none', glasses: true, shoe: '#6a5040', belly: 0.4 },
    script: s => s.met.grandma ? [
      { say: { th: 'กินข้าวหรือยังหลาน? อย่าลืมกลับมาก่อนมืดนะ', en: 'Have you eaten yet, dear? Be home before dark.' } },
      ...(s.quests.meetFriends === 'done' && !s.flags.grandmaThanks ? [
        { say: { th: 'ได้ยินว่าหลานรู้จักคนทั้งหาดแล้ว เก่งมาก! ยายให้ค่าขนมเพิ่ม', en: 'I hear you know the whole beach now. Here, a little extra pocket money!' } },
        { give: { baht: 50 } }, { flag: 'grandmaThanks' },
      ] : []),
    ] : [
      { say: { th: 'มาถึงแล้วเหรอหลาน! ปิดเทอมนี้อยู่กับยายที่บางแสนนะ', en: 'You made it! This school break you\'re staying with me in Bang Saen.' } },
      { say: { th: 'แถวนี้มีแต่คนใจดี ลองไปทักทายเพื่อนบ้านดูสิ', en: 'Everyone around here is friendly. Go and say hello to the neighbours.' } },
      { say: { th: 'เอ้า เอาเงินนี่ไปซื้อขนมกินนะ', en: 'Here, take this for snacks.' } },
      { give: { baht: 100 } },
      { quest: ['visitGrandma', 'done'] }, { quest: ['meetFriends', 'active'] },
    ],
  },
  {
    id: 'tonkla', place: 'beach',
    name: { th: 'ต้นกล้า', en: 'Tonkla' },
    look: { shirt: '#f0b43a', bottomColor: '#3a6a4a', hat: 'cap', hatColor: '#d8443a', hatBand: '#f4f1e8', skin: '#c68f66' },
    script: s => s.met.tonkla ? [
      { say: { th: 'เย็นนี้ไปจับปูลมกันไหม? ถามลุงแดงดูสิ', en: 'Want to catch ghost crabs tonight? Ask Uncle Daeng.' } },
    ] : [
      { say: { th: 'หวัดดี! มาเที่ยวบ้านยายเหรอ? เราชื่อต้นกล้า', en: 'Hi! Visiting your grandma? I\'m Tonkla.' } },
      { say: { th: 'ที่นี่สนุกนะ มีทั้งลิงที่เขาสามมุข ปูลม แล้วก็ส้มตำป้านวลอร่อยสุด ๆ', en: 'It\'s fun here: monkeys on Khao Sam Muk, ghost crabs, and Aunt Nuan\'s som tam is the best.' } },
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
