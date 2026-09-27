// Advisory publication budget, not Netlify's live credit balance.
export function publicationBudget(ledger = [], now = new Date()) {
  const local = new Intl.DateTimeFormat('sv-SE', {timeZone:'Europe/Vienna'}).format(now);
  const [y,m,d] = local.split('-').map(Number);
  const start = new Date(Date.UTC(y,m-1-(d<10?1:0),10));
  const end = new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,10));
  const cycle = start.toISOString().slice(0,10);
  const used = (cycle === '2026-09-10' ? 5 : 0) + new Set(ledger.filter(e => e.cycle === cycle).map(e=>e.commit)).size;
  return {cycle, reset:end.toISOString().slice(0,10), limit:15, used, remaining:Math.max(0,15-used), estimated:true};
}
