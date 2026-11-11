// =====================================================================
//  병음 입력 처리
//  - 대소문자 무시, 성조 기호/숫자 무시, 공백·아포스트로피 무시, ü = v = u
//  - 한/영 전환을 깜빡하고 한글로 친 경우(예: ㅔㅑㅜㅎㅎㅕㅐ) 영문 자판으로 되돌림
//  ※ 서버(schema.sql의 normalize_pinyin)와 똑같은 규칙입니다.
// =====================================================================

export function normalizePinyin(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // 성조 기호, ü의 점 제거
    .toLowerCase()
    .replace(/v/g, 'u')
    .replace(/[\s'’:·0-9-]/g, '');
}

/** 화면 표시용: 앞뒤 공백 제거 + 중복 공백 하나로 */
export function tidyInput(s) {
  return String(s ?? '').trim().replace(/\s+/g, ' ');
}

export function isCorrect(input, answer) {
  const a = normalizePinyin(input);
  return a.length > 0 && a === normalizePinyin(answer);
}

// ---------- 성조: 숫자 → 기호 (jia1ren2 → jiārén) ----------
const TONE_MARK = ['', '̄', '́', '̌', '̀']; // 1성 ā · 2성 á · 3성 ǎ · 4성 à
const IS_VOWEL = /[aeiouüAEIOUÜ]/;

/** 글자 묶음(run)의 마지막 음절 모음에 성조 기호를 붙임. 0·5 = 경성(숫자만 지움) */
function markRun(run, tone) {
  const s = run.replace(/v/g, 'ü').replace(/V/g, 'Ü');
  if (!TONE_MARK[tone]) return s;
  let end = s.length - 1;
  while (end >= 0 && !IS_VOWEL.test(s[end])) end--;
  if (end < 0) return s;                       // 모음이 없으면 그대로
  let start = end;
  while (start > 0 && IS_VOWEL.test(s[start - 1])) start--;
  const cl = s.slice(start, end + 1).toLowerCase();
  // 표기 규칙: a·e가 있으면 그 위, ou는 o 위, 나머지는 마지막 모음 위 (iu → u, ui → i)
  const idx = cl.includes('a') ? cl.indexOf('a')
    : cl.includes('e') ? cl.indexOf('e')
    : cl.includes('ou') ? cl.indexOf('o')
    : cl.length - 1;
  const pos = start + idx;
  return s.slice(0, pos) + (s[pos] + TONE_MARK[tone]).normalize('NFC') + s.slice(pos + 1);
}

/** 'jia1ren2' → 'jiārén', 'lv4' → 'lǜ', 'ba4ba5' → 'bàba' */
export function numbersToMarks(text) {
  return String(text ?? '').replace(/([A-Za-zÜüVv]+)([0-5])(?![0-9])/g, (m, run, d) => markRun(run, Number(d)));
}

/** 성조 정보가 있는 병음인지 (기호 또는 1~4 숫자) */
export function hasToneInfo(py) {
  const s = String(py ?? '');
  return /[̀́̄̌]/.test(s.normalize('NFD')) || /[A-Za-zü][1-4]/.test(s);
}

function toneParts(s) {
  const t = numbersToMarks(String(s ?? '').toLowerCase().replace(/v/g, 'ü'))
    .normalize('NFD').replace(/[\s'’:·0-9-]/g, '');
  const base = [];
  const tone = [];
  for (const ch of t) {
    if (/[̀́̄̌]/.test(ch)) { if (base.length) tone[base.length - 1] = ch; }
    else if (ch === '̈') continue;          // ü의 두 점은 글자로 취급 안 함 (u와 같음)
    else base.push(ch);
  }
  return { base: base.join(''), tone };
}

/**
 * 채점: 'correct' | 'tone'(철자는 맞고 성조가 틀림) | 'wrong'
 * withTones=false → 성조 무시. true → 정답에 성조가 있는 음절은 성조까지 같아야 정답.
 * 정답에서 성조가 없는 음절(경성: bàba의 ba)은 학생이 어떤 성조를 붙여도 인정.
 */
export function gradeAnswer(input, answer, withTones = false) {
  const a = normalizePinyin(input);
  if (!a || a !== normalizePinyin(answer)) return 'wrong';
  if (!withTones) return 'correct';
  const x = toneParts(input), y = toneParts(answer);
  if (x.base !== y.base) return 'correct';
  for (let i = 0; i < y.base.length; i++) {
    if (y.tone[i] && x.tone[i] !== y.tone[i]) return 'tone';
  }
  return 'correct';
}

// ---------- 두벌식 한글 → 영문 자판 복원 ----------
const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const JUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
const JONG = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const KEY = {
  'ㅂ':'q','ㅈ':'w','ㄷ':'e','ㄱ':'r','ㅅ':'t','ㅛ':'y','ㅕ':'u','ㅑ':'i','ㅐ':'o','ㅔ':'p',
  'ㅁ':'a','ㄴ':'s','ㅇ':'d','ㄹ':'f','ㅎ':'g','ㅗ':'h','ㅓ':'j','ㅏ':'k','ㅣ':'l',
  'ㅋ':'z','ㅌ':'x','ㅊ':'c','ㅍ':'v','ㅠ':'b','ㅜ':'n','ㅡ':'m',
  'ㅃ':'q','ㅉ':'w','ㄸ':'e','ㄲ':'r','ㅆ':'t','ㅒ':'o','ㅖ':'p',
  'ㅘ':'hk','ㅙ':'ho','ㅚ':'hl','ㅝ':'nj','ㅞ':'np','ㅟ':'nl','ㅢ':'ml',
  'ㄳ':'rt','ㄵ':'sw','ㄶ':'sg','ㄺ':'fr','ㄻ':'fa','ㄼ':'fq','ㄽ':'ft','ㄾ':'fx','ㄿ':'fv','ㅀ':'fg','ㅄ':'qt',
};

export function hasHangul(s) {
  return /[ㄱ-ㆎ가-힣]/.test(String(s ?? ''));
}

export function hangulToQwerty(s) {
  let out = '';
  for (const ch of String(s ?? '')) {
    const code = ch.charCodeAt(0);
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const n = code - 0xAC00;
      const c = CHO[Math.floor(n / 588)];
      const j = JUNG[Math.floor((n % 588) / 28)];
      const f = JONG[n % 28];
      out += (KEY[c] || '') + (KEY[j] || '') + (f ? KEY[f] || '' : '');
    } else if (KEY[ch]) {
      out += KEY[ch];
    } else {
      out += ch;
    }
  }
  return out;
}

/** 제출 직전 처리: 한글이면 영문 자판으로 바꾸고 공백 정리 */
export function prepareAnswer(raw) {
  const converted = hasHangul(raw);
  const text = tidyInput(converted ? hangulToQwerty(raw) : raw);
  return { text, converted };
}
