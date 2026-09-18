/**
 * Find the date a policy states about itself ("Last updated: March 3, 2025").
 *
 * Must run on text BEFORE normalizePolicyText, which strips these lines so the
 * content hash ignores date-only bumps. Only a date sitting right next to a
 * label counts: a bare date elsewhere in the body (a statute year, "since
 * 2008") says nothing about the document's own version.
 */

export interface StatedDate {
  /** The label and date as written, whitespace-collapsed. */
  text: string;
  /** ISO YYYY-MM-DD when unambiguous; month-only dates use the 1st. */
  date: string | null;
}

const EN_MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const OTHER_MONTHS =
  'janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre'
  + '|januar|februar|märz|maerz|juni|juli|oktober|dezember'
  + '|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre'
  + '|janeiro|fevereiro|março|maio|junho|julho|setembro|outubro|dezembro'
  + '|gennaio|febbraio|aprile|maggio|giugno|luglio|settembre|ottobre|dicembre';
const MONTH = `(?:${EN_MONTHS.map(m => `${m}|${m.slice(0, 3)}`).join('|')}|sept|${OTHER_MONTHS})`;
const YEAR = '(?:19|20)\\d{2}';

// Order matters only for readability; every alternative is tried at each label.
const DATE_SRC = [
  `${MONTH}\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+${YEAR}`,                              // March 3, 2025
  `\\d{1,2}(?:st|nd|rd|th|er|\\.)?\\s+(?:de\\s+)?${MONTH}\\.?,?\\s+(?:de\\s+)?${YEAR}`, // 3 March 2025, 3 de marzo de 2025
  `${MONTH}\\.?,?\\s+(?:de\\s+)?${YEAR}`,                                                // March 2025
  `${YEAR}-\\d{1,2}-\\d{1,2}`,                                                           // 2025-03-03
  `${YEAR}[./]\\d{1,2}[./]\\d{1,2}`,                                                     // 2025.03.03
  `\\d{1,2}[./-]\\d{1,2}[./-]${YEAR}`,                                                   // 03/03/2025 (ambiguous, not parsed)
  `${YEAR}\\s*年\\s*\\d{1,2}\\s*月(?:\\s*\\d{1,2}\\s*日)?`,                               // 2025年3月3日
  `${YEAR}\\s*년\\s*\\d{1,2}\\s*월(?:\\s*\\d{1,2}\\s*일)?`,                               // 2025년 3월 3일
].join('|');

const LABEL_SRC = [
  'effective(?:\\s+date)?(?:\\s+as\\s+of)?',
  'last\\s+(?:updated|modified|revised|reviewed|amended|changed)(?:\\s+on)?',
  'date\\s+of\\s+last\\s+(?:revision|update)',
  '(?:updated|revised|amended)(?:\\s+(?:on|as\\s+of))?',
  'version\\s+date', 'dated', 'in\\s+effect\\s+(?:as\\s+of|from)',
  // "Version 16, June 2026" - Trustpilot numbers its policy and dates the number.
  'version\\s+\\d+', 'v\\d+(?:\\.\\d+)*',

  'stand', 'zuletzt\\s+(?:aktualisiert|geändert)(?:\\s+am)?', 'gültig\\s+ab', 'letzte\\s+aktualisierung',
  '(?:derni[èe]re\\s+)?mise?\\s+[àa]\\s+jour(?:\\s+le)?', 'en\\s+vigueur\\s+(?:le|depuis|au)', "date\\s+d['’]entrée\\s+en\\s+vigueur",
  '[úu]ltima\\s+(?:actualizaci[óo]n|modificaci[óo]n|atualiza[çc][ãa]o)', 'fecha\\s+de\\s+(?:entrada\\s+en\\s+vigor|vigencia|actualizaci[óo]n)',
  'vigente\\s+(?:desde|a\\s+partir\\s+de)', 'ultimo\\s+aggiornamento', 'laatst\\s+bijgewerkt(?:\\s+op)?',
  '最終(?:更新|改定|改訂)日?', '(?:制定|改定|改訂|施行|更新)日', '시행일(?:자)?', '개정일(?:자)?', '最后更新(?:日期)?', '生效日期',
].join('|');

// Label, up to 25 chars of punctuation / filler ("Effective Date of this Policy:"),
// then the date. The filler may cross one line break (label and date in separate
// elements) but no digits, so "updated 30 days after March 2025" doesn't match.
const LABEL_THEN_DATE = new RegExp(`(?<![\\p{L}])(${LABEL_SRC})[^\\d\\n]{0,25}?\\n?[^\\d\\n]{0,10}?(${DATE_SRC})`, 'giu');
// CJK documents often put the label after the date: "2024年4月1日 改定".
const DATE_THEN_LABEL = new RegExp(`(${YEAR}\\s*[年년]\\s*\\d{1,2}\\s*[月월](?:\\s*\\d{1,2}\\s*[日일])?)\\s*(?:制定|改定|改訂|施行|更新|시행|개정)`, 'gu');

export function parseStatedDate(raw: string): string | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  const iso = (y: number, m: number, d: number) => {
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    return dt.toISOString().slice(0, 10);
  };
  const month = (name: string) => {
    const i = EN_MONTHS.findIndex(m => name.replace('.', '').startsWith(m.slice(0, 3)));
    return i >= 0 ? i + 1 : null;
  };

  let m = s.match(/^([a-z]+)\.? (\d{1,2})(?:st|nd|rd|th)?,? (\d{4})$/);
  if (m && month(m[1]!)) return iso(+m[3]!, month(m[1]!)!, +m[2]!);
  m = s.match(/^(\d{1,2})(?:st|nd|rd|th)? ([a-z]+)\.?,? (\d{4})$/);
  if (m && month(m[2]!)) return iso(+m[3]!, month(m[2]!)!, +m[1]!);
  m = s.match(/^([a-z]+)\.?,? (\d{4})$/);
  if (m && month(m[1]!)) return iso(+m[2]!, month(m[1]!)!, 1);
  m = s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
  if (m) return iso(+m[1]!, +m[2]!, +m[3]!);
  m = s.match(/^(\d{4}) ?[年년] ?(\d{1,2}) ?[月월](?: ?(\d{1,2}) ?[日일])?$/);
  if (m) return iso(+m[1]!, +m[2]!, m[3] ? +m[3] : 1);
  // DD/MM vs MM/DD and non-English month names: keep the text, skip the date.
  return null;
}

/**
 * Returns the best stated date in `raw`, or null if the document states none.
 * An "effective" label beats an "updated" one when both appear; otherwise the
 * earliest match wins, since the version line is almost always at the top.
 */
export function extractStatedDate(raw: string): StatedDate | null {
  const found: { index: number; text: string; dateRaw: string; effective: boolean }[] = [];
  for (const match of raw.matchAll(LABEL_THEN_DATE)) {
    found.push({ index: match.index!, text: match[0], dateRaw: match[2]!, effective: /effective|vigueur|vigor|vigencia|vigente|施行|시행|生效|gültig/i.test(match[1]!) });
  }
  for (const match of raw.matchAll(DATE_THEN_LABEL)) {
    found.push({ index: match.index!, text: match[0], dateRaw: match[1]!, effective: /施行|시행/.test(match[0]) });
  }
  if (found.length === 0) return null;

  found.sort((a, b) => Number(b.effective) - Number(a.effective) || a.index - b.index);
  const best = found[0]!;
  return { text: best.text.replace(/\s+/g, ' ').trim(), date: parseStatedDate(best.dateRaw) };
}
