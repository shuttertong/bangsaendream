// Online Go table. The player who opened the table (the lobby leader) is Black and moves first;
// the one who joined is White. Both games run the same rules, so a move is just its point
// index and move number: { k: 'mv', i, n } (i = −1 is a pass); { k: 'ev', e: 'resign' | 'bye' }.
// ctx.coop = { role, room (leader id), seats: [ids], myId, co: { send, on, off }, info }.
export function createGoNet(coop, handlers) {
  if (!coop || coop.seats.length < 2) return null;
  const leader = coop.role === 'leader', rival = coop.seats.find(id => id !== coop.myId);
  let here = true;
  const listener = (from, d) => {
    if (!d || from !== rival) return;
    if (d.k === 'gone' || (d.k === 'ev' && d.e === 'bye')) { if (here) { here = false; handlers.gone?.(); } }
    else if (d.k === 'ev' && d.e === 'resign') handlers.resign?.();
    else if (d.k === 'mv' && Number.isInteger(d.i) && Number.isInteger(d.n)) handlers.move?.(d.i, d.n);
  };
  coop.co.on(listener);
  return {
    leader, rival,
    rivalName: () => coop.info(rival)?.name || '…',
    myName: () => coop.info(coop.myId)?.name || '',
    move(i, n) { coop.co.send([rival], { k: 'mv', i, n }); },
    resign() { coop.co.send([rival], { k: 'ev', e: 'resign' }); },
    bye() { if (here) coop.co.send([rival], { k: 'ev', e: 'bye' }); },
    close() { coop.co.off(listener); },
  };
}
