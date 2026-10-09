// Story goals shown in the HUD. Data-driven: each quest has a title (with optional
// {n}/{of} progress), a check against the save, a reward, what comes next, and `who`:
// the people (roster ids) the goal sends you to — the goal marker (guide.js) points at the nearest.
import * as P from '../shared/progress.js';
import { tr, t } from '../shared/i18n.js';

const FRIENDS = ['tonkla', 'daeng', 'piak', 'chai', 'fon', 'nuan'];
// who runs which mini-game (roster ids)
const HOSTS = { khaolam: 'grandma', crab: 'daeng', squid: 'piak', monkey: 'chai', tube: 'fon', stall: 'nuan', banana: 'tom', sofa: 'tom', jetski: 'tom', go: 'kru' };
const hostsOf = games => [...new Set(games.map(g => HOSTS[g]))];
const hasSeafood = s => Object.keys(s.bag).some(k => (k.startsWith('squid_') || k.startsWith('crab_')) && s.bag[k] > 0);

export const QUESTS = {
  visitGrandma: {
    title: { th: 'ไปหายายที่บ้าน', en: 'Go see Grandma at her house' },
    who: () => ['grandma'],
    walk: true,              // the first walk teaches the controls: no fast travel there until it is done
    // completed by grandma's script
  },
  meetFriends: {
    title: { th: 'ทักทายคนแถวหาด ({n}/{of})', en: 'Say hello to the locals ({n}/{of})' },
    of: FRIENDS.length,
    count: s => FRIENDS.filter(id => s.met[id]).length,
    who: s => FRIENDS.filter(id => !s.met[id]),
    reward: { baht: 60 },
    next: 'tryGame',
  },
  tryGame: {
    title: { th: 'ลองเล่นมินิเกมกับเพื่อนบ้าน', en: 'Try a mini-game with a neighbour' },
    check: s => Object.keys(s.best).length > 0,
    who: () => hostsOf(Object.keys(HOSTS)),
    reward: { baht: 40 },
    next: 'playAll',
  },
  playAll: {
    title: { th: 'ลองทำให้ครบทุกอย่างในบางแสน ({n}/{of})', en: 'Try everything in Bang Saen ({n}/{of})' },
    of: 9,
    count: s => Object.keys(s.best).length,
    who: s => hostsOf(Object.keys(HOSTS).filter(g => !s.best[g])),
    reward: { baht: 100 },
    next: 'dinner',
  },
  dinner: {
    title: { th: 'เอาหมึกหรือปูไปให้ยายทำกับข้าวเย็น', en: 'Bring Grandma a squid or crab for dinner' },
    who: s => (hasSeafood(s) ? ['grandma'] : ['piak', 'daeng']),
    check: s => !!s.flags.gaveDinner,
    reward: { baht: 50 },
    next: 'ending',
  },
  ending: {
    title: { th: 'กลับไปกินข้าวเย็นกับยาย', en: 'Go home for dinner with Grandma' },
    who: () => ['grandma'],
    check: s => !!s.flags.ending,
  },
};

/** Keep quest state consistent with the save; returns the active quest id or null. */
export function updateQuests(onToast) {
  const s = P.get();
  if (!s.quests.visitGrandma) P.setQuest('visitGrandma', 'active');
  // saves from before a quest was added: open the follow-up of any finished quest
  for (const [id, q] of Object.entries(QUESTS)) if (s.quests[id] === 'done' && q.next && !s.quests[q.next]) P.setQuest(q.next, 'active');
  for (const [id, q] of Object.entries(QUESTS)) {
    if (s.quests[id] !== 'active') continue;
    const done = q.count ? q.count(s) >= q.of : q.check ? q.check(s) : false;
    if (!done) continue;
    P.setQuest(id, 'done');
    if (q.reward?.baht) { P.addBaht(q.reward.baht); onToast?.(t('gotBaht', { n: q.reward.baht })); }
    if (q.next && !s.quests[q.next]) P.setQuest(q.next, 'active');
  }
  return Object.keys(QUESTS).find(id => s.quests[id] === 'active') || null;
}

/** HUD text for a quest. */
export function questText(id) {
  const q = QUESTS[id];
  if (!q) return '';
  const s = P.get();
  return tr(q.title, { n: q.count ? q.count(s) : 0, of: q.of ?? '' });
}

/** Roster ids the quest sends the player to (empty when it has no particular person). */
export const questPeople = id => QUESTS[id]?.who?.(P.get()) || [];
/** Roster ids the player must walk to: fast travel to them stays closed while their quest is active. */
export function walkOnly() {
  const s = P.get();
  return Object.entries(QUESTS).filter(([id, q]) => q.walk && s.quests[id] === 'active').flatMap(([id]) => questPeople(id));
}
