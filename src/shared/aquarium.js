// สถาบันวิทยาศาสตร์ทางทะเล / ศูนย์เรียนรู้โลกใต้ทะเลบางแสน — what the visit shows (town/marine.js builds the place,
// town/aquarium.js the tanks). The real aquarium (2026): ~44 saltwater tanks from small nursery tanks to a big central
// tank with a glass tunnel, a glowing jellyfish zone, an economic-fish zone, a rocky-shore display and whale and shark
// models hanging from the ceiling; Thai children pay ฿40. Species and facts are kept simple for kids and checked
// against common references; edit them here.
// model: the shape sealife.js builds; colors: [body, belly or second colour, marks]; size: length in metres; tall: a fish's depth (× its length).
export const SPECIES = {
  clownfish:   { icon: '🐠', model: 'fish', size: 0.11, colors: ['#f2772a', '#f6a050', '#ffffff'], bands: 3, name: { th: 'ปลาการ์ตูนส้มขาว', en: 'Clownfish' },
    fact: { th: 'อาศัยอยู่ในดอกไม้ทะเล ผิวมีเมือกพิเศษทำให้ไม่โดนหนวดดอกไม้ทะเลต่อย', en: 'Lives among sea anemones. A special slime on its skin keeps the stinging tentacles from hurting it.' } },
  parrotfish:  { icon: '🐟', model: 'fish', size: 0.4, tall: 0.32, colors: ['#3aa58a', '#7fd0b2', '#e86a9a'], name: { th: 'ปลานกแก้ว', en: 'Parrotfish' },
    fact: { th: 'มีฟันเหมือนจะงอยปากนกแก้ว กัดกินสาหร่ายบนปะการัง แล้วถ่ายออกมาเป็นเม็ดทรายขาว', en: 'Its teeth look like a parrot\'s beak. It nibbles algae off coral and what comes out the other end is white sand!' } },
  puffer:      { icon: '🐡', model: 'puffer', size: 0.22, colors: ['#c8b26a', '#f2ecd8', '#5a4a2a'], name: { th: 'ปลาปักเป้า', en: 'Pufferfish' },
    fact: { th: 'เวลาตกใจจะกลืนน้ำจนตัวพองกลมเป็นลูกบอล ศัตรูจะได้กินไม่ลง', en: 'When it is scared it gulps water and blows up like a ball, too big for a hunter to swallow.' } },
  lionfish:    { icon: '🦁', model: 'lionfish', size: 0.3, colors: ['#c8463a', '#f4efe6', '#7a2a22'], bands: 7, name: { th: 'ปลาสิงโต', en: 'Lionfish' },
    fact: { th: 'ครีบยาวสวยงามแต่มีพิษที่ก้านครีบ ดูได้แต่ห้ามจับนะ', en: 'Its long fins are pretty but the spines are venomous. Look, don\'t touch!' } },
  lobster:     { icon: '🦞', model: 'lobster', size: 0.4, colors: ['#3f6a7a', '#c89a4a', '#f4e6c0'], name: { th: 'กุ้งมังกร', en: 'Spiny lobster' },
    fact: { th: 'ไม่มีก้ามใหญ่เหมือนกุ้งทั่วไป แต่มีหนวดยาวมีหนามไว้ป้องกันตัว', en: 'It has no big claws. Instead it guards itself with long, spiny antennae.' } },
  seahorse:    { icon: '🐉', model: 'seahorse', size: 0.15, colors: ['#e8b23a', '#f4d27a', '#a86a1a'], name: { th: 'ม้าน้ำ', en: 'Seahorse' },
    fact: { th: 'ม้าน้ำตัวพ่อเป็นคนอุ้มท้อง! ตัวแม่วางไข่ไว้ในถุงหน้าท้องของตัวพ่อ', en: 'The father seahorse gets pregnant! The mother puts her eggs in a pouch on his belly.' } },
  barramundi:  { icon: '🐟', model: 'fish', size: 0.7, tall: 0.24, colors: ['#9aa6ae', '#e4e8ea', '#5f6a72'], name: { th: 'ปลากะพงขาว', en: 'Barramundi' },
    fact: { th: 'ปลาเศรษฐกิจของอ่าวไทย อยู่ได้ทั้งในทะเลและในน้ำกร่อยปากแม่น้ำ', en: 'An important food fish of the Gulf of Thailand. It can live in the sea and in the brackish water of river mouths.' } },
  crab:        { icon: '🦀', model: 'crab', size: 0.2, colors: ['#3a74b8', '#f4f0e6', '#2a4a7a'], name: { th: 'ปูม้า', en: 'Blue swimming crab' },
    fact: { th: 'ขาคู่สุดท้ายแบนเหมือนใบพาย ทำให้ว่ายน้ำได้เก่ง ชาวประมงอ่าวไทยจับขายเป็นอาชีพ', en: 'Its back legs are flat like paddles, so it is a good swimmer. Fishers in the Gulf of Thailand catch it for a living.' } },
  grouper:     { icon: '🐟', model: 'fish', size: 1.0, tall: 0.3, colors: ['#7a6a4a', '#b8a882', '#3f3424'], spots: true, name: { th: 'ปลาเก๋า', en: 'Grouper' },
    fact: { th: 'ปากกว้างมาก อ้าปากดูดเหยื่อเข้าไปได้ในพริบตา ตัวที่โตมาก ๆ ยาวกว่าเราอีก', en: 'It has a huge mouth and sucks in its food in a flash. The biggest ones grow longer than you are tall.' } },
  ray:         { icon: '🪽', model: 'ray', size: 1.4, colors: ['#4a5560', '#f2f2ec', '#f2f2ec'], spots: true, name: { th: 'ปลากระเบนนก', en: 'Spotted eagle ray' },
    fact: { th: 'กระพือครีบข้างตัวเหมือนนกบินอยู่ในน้ำ ชอบขุดหาหอยในทรายกิน', en: 'It flaps its side fins like a bird flying through the water, and digs shellfish out of the sand to eat.' } },
  bambooShark: { icon: '🦈', model: 'shark', size: 0.9, colors: ['#8a7458', '#d8c8a8', '#4a3a28'], bands: 9, name: { th: 'ฉลามกบ', en: 'Bamboo shark' },
    fact: { th: 'ฉลามตัวเล็กใจดี ชอบนอนพักที่พื้น ออกลูกเป็นไข่ในฝักแข็ง', en: 'A small, gentle shark that likes to rest on the bottom. Its babies hatch from tough egg cases.' } },
  turtle:      { icon: '🐢', model: 'turtle', size: 0.8, colors: ['#5f6a3a', '#c8b07a', '#3a4224'], name: { th: 'เต่าตนุ', en: 'Green sea turtle' },
    fact: { th: 'กินหญ้าทะเลกับสาหร่าย ตัวแม่จะขึ้นมาวางไข่บนหาดทราย ลูกเต่าต้องคลานลงทะเลเอง', en: 'It eats seagrass and algae. Mothers come ashore to lay eggs in the sand, and the babies crawl to the sea on their own.' } },
  jelly:       { icon: '🪼', model: 'jelly', size: 0.25, colors: ['#e8f0ff', '#c8d8ff', '#ffd8f0'], name: { th: 'แมงกะพรุนพระจันทร์', en: 'Moon jellyfish' },
    fact: { th: 'ตัวเป็นน้ำเกือบทั้งหมด ไม่มีสมอง ไม่มีหัวใจ แต่ว่ายน้ำได้ด้วยการหุบกางร่ม', en: 'It is almost all water and has no brain or heart, yet it swims by opening and closing its bell.' } },
  eel:         { icon: '⚡', model: 'eel', size: 1.2, colors: ['#3f4438', '#c8a85a', '#2a2e24'], name: { th: 'ปลาไหลไฟฟ้า', en: 'Electric eel' },
    fact: { th: 'ปล่อยไฟฟ้าได้แรงหลายร้อยโวลต์ ใช้ล่าเหยื่อและป้องกันตัว (อยู่น้ำจืดนะ ไม่ใช่ทะเล)', en: 'It can make a shock of several hundred volts to hunt and to protect itself. (It lives in fresh water, not the sea.)' } },
  starfish:    { icon: '⭐', model: 'starfish', size: 0.22, colors: ['#e8743a', '#f0a060', '#c84a2a'], name: { th: 'ดาวทะเล', en: 'Starfish' },
    fact: { th: 'ถ้าแขนขาด ดาวทะเลงอกแขนใหม่ขึ้นมาได้ แตะได้เบา ๆ ด้วยปลายนิ้วนะ', en: 'If it loses an arm it can grow a new one. You may touch it gently with a fingertip.' } },
  seaCucumber: { icon: '🥒', model: 'cucumber', size: 0.3, colors: ['#4a3a30', '#7a6050', '#2a201a'], name: { th: 'ปลิงทะเล', en: 'Sea cucumber' },
    fact: { th: 'กินตะกอนในทรายแล้วปล่อยทรายสะอาดออกมา เหมือนพนักงานทำความสะอาดพื้นทะเล', en: 'It eats the dirt in the sand and leaves clean sand behind, like a cleaner of the sea floor.' } },
  // the museum: models, not live animals
  brydesWhale: { icon: '🐋', model: 'whale', size: 12, colors: ['#4a5560', '#d8d8d2', '#2f3840'], name: { th: 'วาฬบรูด้า (โมเดล)', en: "Bryde's whale (model)" },
    fact: { th: 'วาฬบรูด้าหากินอยู่ในอ่าวไทยตอนบน อ้าปากกว้างฮุบฝูงปลาเล็ก ๆ ทีละมาก ๆ', en: 'Bryde\'s whales feed in the upper Gulf of Thailand, opening their huge mouths to gulp whole schools of small fish.' } },
  whaleShark:  { icon: '🦈', model: 'whaleShark', size: 7, colors: ['#4f5e6a', '#e8eaea', '#f4f4f0'], spots: true, name: { th: 'ฉลามวาฬ (โมเดล)', en: 'Whale shark (model)' },
    fact: { th: 'ปลาที่ใหญ่ที่สุดในโลก แต่กินแค่แพลงก์ตอนกับปลาตัวจิ๋ว ใจดีกับนักดำน้ำ', en: 'The biggest fish in the world, yet it only eats plankton and tiny fish, and is gentle with divers.' } },
};

// what lives where: tank id → [species, how many]; the tank shapes and places are in marine.js / aquarium.js
export const TANKS = {
  reef:     [['clownfish', 8], ['parrotfish', 3], ['puffer', 2]],
  lion:     [['lionfish', 3], ['lobster', 3]],
  seahorse: [['seahorse', 7]],
  economic: [['barramundi', 5], ['crab', 6]],
  big:      [['grouper', 5], ['ray', 4], ['bambooShark', 4], ['turtle', 2], ['parrotfish', 6], ['barramundi', 6]],
  touch:    [['starfish', 9], ['seaCucumber', 5]],
  eel:      [['eel', 2]],
  jelly:    [['jelly', 9]],
  cylinder: [['parrotfish', 4], ['clownfish', 9], ['puffer', 2]],
};

// each label in the aquarium opens one zone: its title and the animals it tells about
export const ZONES = {
  reef:       { icon: '🪸', name: { th: 'แนวปะการัง', en: 'Coral reef' }, species: ['clownfish', 'parrotfish', 'puffer'] },
  lion:       { icon: '⚠️', name: { th: 'สัตว์ที่ต้องระวัง', en: 'Look, don\'t touch' }, species: ['lionfish', 'lobster'] },
  seahorse:   { icon: '🐉', name: { th: 'ม้าน้ำ', en: 'Seahorses' }, species: ['seahorse'] },
  economic:   { icon: '🎣', name: { th: 'สัตว์น้ำเศรษฐกิจอ่าวไทย', en: 'Food from the Gulf of Thailand' }, species: ['barramundi', 'crab'] },
  big:        { icon: '🌊', name: { th: 'ตู้ใหญ่ · อุโมงค์ใต้ทะเล', en: 'The big tank and its tunnel' }, species: ['grouper', 'ray', 'bambooShark', 'turtle'] },
  touch:      { icon: '🖐️', name: { th: 'บ่อสัมผัส', en: 'Touch pool' }, species: ['starfish', 'seaCucumber'] },
  jelly:      { icon: '🪼', name: { th: 'โซนแมงกะพรุน', en: 'Jellyfish' }, species: ['jelly'] },
  eel:        { icon: '⚡', name: { th: 'ปลาน้ำจืด', en: 'Freshwater corner' }, species: ['eel'] },
  cylinder:   { icon: '🫧', name: { th: 'ตู้ทรงกระบอก · หอหินปะการัง', en: 'The round tank and its coral tower' }, species: ['parrotfish', 'clownfish', 'puffer'] },
  whale:      { icon: '🐋', name: { th: 'วาฬในอ่าวไทย', en: 'Whales of the Gulf of Thailand' }, species: ['brydesWhale'] },
  whaleShark: { icon: '🦈', name: { th: 'ฉลามวาฬ', en: 'Whale shark' }, species: ['whaleShark'] },
  shore:      { icon: '🦀', name: { th: 'ชายฝั่งหิน', en: 'Rocky shore' }, species: ['crab', 'starfish'] },
};

export const VISIT = {
  ticket: 40,                      // ฿, the real price for a Thai child (adults ฿80)
  reach: 2.4,                      // metres from a tank label to read it
  near: 80,                        // the tanks animate only while the kid is this close
};
