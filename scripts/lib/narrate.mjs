// Turns briefing items into natural spoken sentences (used for the neural voice clips
// and for on-device speech). Each clip stands alone because users reorder their queue.
const ORD = ['', 'first', 'second', 'third', 'fourth'];
const FORM = {
  '10-K': 'its annual report', '10-Q': 'its quarterly report', '8-K': 'a current report', '4': 'an insider trading form',
  'SC 13G': 'a large-stake ownership filing', 'SC 13G/A': 'an updated ownership filing', 'SC 13D': 'an activist ownership filing',
  'DEF 14A': 'its proxy statement', 'S-3': 'a securities registration', 'S-8': 'an employee stock plan registration', '144': 'a notice of a planned insider sale'
};
export function spokenName(t, cfg, fallback) {
  const al = cfg?.companies?.[t]?.aliases;
  if (al && al.length) return al[0];
  return String(fallback || t).replace(/,? (Inc|Corp|Corporation|Co|Company|Ltd|Holdings|Incorporated|Platforms)\.?$/i, '').trim();
}
export function cleanForSpeech(s, tickerNames = {}) {
  let x = String(s)
    .replace(/\s*\((NASDAQ|NYSE|NYSEARCA|AMEX|OTC)\s*:\s*[A-Z.]+\)/gi, '')
    .replace(/\$([A-Z]{1,5})\b/g, (m, t) => tickerNames[t] || t)
    .replace(/\bQ([1-4])\b/g, (m, q) => ORD[+q] + '-quarter')
    .replace(/\bFY ?(\d{2,4})\b/g, 'fiscal $1')
    .replace(/\bYoY\b/gi, 'year over year').replace(/\bQoQ\b/gi, 'quarter over quarter')
    .replace(/\bEPS\b/g, 'earnings per share').replace(/\bAI\b/g, 'A.I.').replace(/\bCEO\b/g, 'C.E.O.').replace(/\bCFO\b/g, 'C.F.O.')
    .replace(/\bvs\.?\s/gi, 'versus ').replace(/&/g, ' and ').replace(/\s*\|\s*/g, '. ')
    .replace(/(\d)%/g, '$1 percent').replace(/→/g, ' to ')
    .replace(/[“”"]/g, '').replace(/\s+/g, ' ').trim();
  for (const [t, n] of Object.entries(tickerNames)) if (t.length >= 3) x = x.replace(new RegExp(`\\b${t}\\b`, 'g'), n);
  if (!/[.!?]$/.test(x)) x += '.';
  return x;
}
export function narrate(item, ctx) {
  const name = ctx.name(item.t);
  const clean = (s) => cleanForSpeech(s, ctx.tickerNames);
  switch (item.type) {
    case 'NEWS': {
      const src = item.source || 'the wires';
      const lead = /^(Reuters|Bloomberg|CNBC|The Wall Street Journal|Barron's|MarketWatch|Financial Times|AP News)$/i.test(src) ? `${src} reports` : `From ${src}`;
      let tone = '';
      if (item.sent > 0) tone = ' The tone on this one is positive.';
      else if (item.sent < 0) tone = ' This one reads negative.';
      const more = item.merged > 2 ? ` ${item.merged - 1} other outlets are carrying the same story.` : item.merged === 2 ? ' One other outlet has it too.' : '';
      return `On ${name}. ${lead}: ${clean(item.title)}${more}${tone}`;
    }
    case 'SEC FILING': {
      const form = FORM[item.form] || `a form ${item.form}`;
      const what = item.items ? `, covering ${item.items}` : '';
      return `${name} filed ${form} with the S.E.C.${what}.`;
    }
    case 'QUANT':
      return `${name}'s ${String(item.factor).toLowerCase()} grade moved from ${item.from} to ${item.to}. ${clean(item.v)}`;
    case 'DIVERGENCE':
      return `Here's one to watch on ${name}. ${clean(item.text)}`;
    default:
      return clean(item.title);
  }
}
export const INTRO = "Hi. Here's your Converge briefing, covering only the stocks you hold and watch.";
export const OUTRO = "That's your briefing. Have a good rest of your day.";
