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
