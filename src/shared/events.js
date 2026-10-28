// Town events on the real calendar: what is on right now, and what it changes. Local time.
export const EVENTS = [
  // the real walking street market runs at weekends: Saturday and Sunday evenings pay double
  { id: 'weekend', icon: '🎪', name: { th: 'ตลาดนัดสุดสัปดาห์', en: 'Weekend market' }, line: { th: 'เสาร์-อาทิตย์ตอนเย็น ภารกิจและตะกร้อจ่ายสองเท่า', en: 'Weekend evenings: tasks and takraw pay double' },
    pay: 2, when: d => (d.getDay() === 0 || d.getDay() === 6) && d.getHours() >= 16 },
];
/** The event on now, or null. */
export const activeEvent = (d = new Date()) => EVENTS.find(e => e.when(d)) || null;
/** The pay multiplier on now. */
export const payNow = (d = new Date()) => activeEvent(d)?.pay || 1;
