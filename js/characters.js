// =====================================================================
//  캐릭터 6종 (SVG 일러스트, 오른쪽을 보고 달림)
//  다리/팔/몸에 클래스가 붙어 있어 CSS로 달리기 애니메이션을 줍니다.
// =====================================================================

const O = '#2b1d14'; // 외곽선 색
const SW = 2.2;      // 외곽선 두께

function frame({ legs, body, belly = '', arms, tail = '', head, extra = '' }) {
  return `
<svg class="char-svg" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <ellipse class="c-shadow" cx="40" cy="76" rx="19" ry="3.5" fill="rgba(0,0,0,.22)"/>
  <g class="c-bob">
    ${tail}
    <g class="c-leg c-leg-b"><rect x="28" y="60" width="8" height="14" rx="4" fill="${legs}" stroke="${O}" stroke-width="${SW}"/></g>
    <rect class="c-arm c-arm-b" x="24" y="46" width="7" height="14" rx="3.5" fill="${arms}" stroke="${O}" stroke-width="${SW}"/>
    <ellipse cx="38" cy="55" rx="15" ry="13" fill="${body}" stroke="${O}" stroke-width="${SW}"/>
    ${belly}
    <g class="c-leg c-leg-a"><rect x="40" y="60" width="8" height="14" rx="4" fill="${legs}" stroke="${O}" stroke-width="${SW}"/></g>
    ${extra}
    <rect class="c-arm c-arm-a" x="44" y="46" width="7" height="14" rx="3.5" fill="${arms}" stroke="${O}" stroke-width="${SW}"/>
    <g class="c-head">${head}</g>
  </g>
</svg>`;
}

const eyes = (x1, x2, y, r = 3.2) => `
  <circle cx="${x1}" cy="${y}" r="${r}" fill="${O}"/><circle cx="${x1 + 1}" cy="${y - 1.2}" r="1.1" fill="#fff"/>
  <circle cx="${x2}" cy="${y}" r="${r}" fill="${O}"/><circle cx="${x2 + 1}" cy="${y - 1.2}" r="1.1" fill="#fff"/>`;
const blush = (x1, x2, y) => `
  <ellipse cx="${x1}" cy="${y}" rx="3.2" ry="2" fill="#ff8a8a" opacity=".7"/>
  <ellipse cx="${x2}" cy="${y}" rx="3.2" ry="2" fill="#ff8a8a" opacity=".7"/>`;

const SVGS = {
  panda: frame({
    legs: '#2a2a2a', body: '#ffffff', arms: '#2a2a2a',
    belly: `<path d="M27 46 Q38 52 50 46 L50 49 Q38 56 27 49 Z" fill="#e63946" stroke="${O}" stroke-width="1.6"/>
            <path d="M30 49 L26 58 L32 55 Z" fill="#e63946" stroke="${O}" stroke-width="1.4"/>`,
    head: `
      <circle cx="30" cy="15" r="6.5" fill="#2a2a2a" stroke="${O}" stroke-width="${SW}"/>
      <circle cx="57" cy="15" r="6.5" fill="#2a2a2a" stroke="${O}" stroke-width="${SW}"/>
      <circle cx="44" cy="30" r="19" fill="#ffffff" stroke="${O}" stroke-width="${SW}"/>
      <ellipse cx="38" cy="29" rx="5.5" ry="7" transform="rotate(25 38 29)" fill="#2a2a2a"/>
      <ellipse cx="53" cy="29" rx="5.5" ry="7" transform="rotate(-25 53 29)" fill="#2a2a2a"/>
      <circle cx="38.5" cy="28.5" r="2.4" fill="#fff"/><circle cx="39.2" cy="28.6" r="1.3" fill="${O}"/>
      <circle cx="53.5" cy="28.5" r="2.4" fill="#fff"/><circle cx="54.2" cy="28.6" r="1.3" fill="${O}"/>
      <ellipse cx="47" cy="37" rx="3.2" ry="2.2" fill="#2a2a2a"/>
      <path d="M44 40 Q47 43 50 40" fill="none" stroke="${O}" stroke-width="1.6" stroke-linecap="round"/>
      ${blush(33, 59, 37)}`,
  }),

  dragon: frame({
    legs: '#2e9e5b', body: '#3cc46f', arms: '#2e9e5b',
    tail: `<path d="M25 58 Q8 60 6 46 Q14 52 24 50 Z" fill="#3cc46f" stroke="${O}" stroke-width="${SW}" stroke-linejoin="round"/>
           <path d="M7 47 L3 41 L11 44 Z" fill="#ff4d4d" stroke="${O}" stroke-width="1.4"/>`,
    belly: `<ellipse cx="40" cy="57" rx="8.5" ry="8" fill="#ffe08a" stroke="${O}" stroke-width="1.4"/>
            <path d="M33 54 H47 M32.5 58 H47.5 M34 62 H46" stroke="#e0b94a" stroke-width="1.2"/>`,
    head: `
      <path d="M24 30 L18 22 L27 23 L22 14 L31 18 L30 8 L38 14 Z" fill="#ff4d4d" stroke="${O}" stroke-width="${SW}" stroke-linejoin="round"/>
      <path d="M36 13 Q33 3 27 2 Q36 0 40 11 Z" fill="#ffd23f" stroke="${O}" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M50 12 Q51 2 57 0 Q56 9 54 13 Z" fill="#ffd23f" stroke="${O}" stroke-width="1.8" stroke-linejoin="round"/>
      <circle cx="42" cy="28" r="17" fill="#3cc46f" stroke="${O}" stroke-width="${SW}"/>
      <ellipse cx="57" cy="35" rx="11" ry="8" fill="#7ee0a3" stroke="${O}" stroke-width="${SW}"/>
      <circle cx="61" cy="32.5" r="1.3" fill="${O}"/><circle cx="65" cy="33.5" r="1.3" fill="${O}"/>
      <path d="M52 39 Q58 42 64 39" fill="none" stroke="${O}" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M66 36 Q72 33 75 37 Q71 36 67 39" fill="none" stroke="#ffd23f" stroke-width="1.8" stroke-linecap="round"/>
      <ellipse cx="45" cy="24" rx="5" ry="5.5" fill="#fff" stroke="${O}" stroke-width="1.6"/>
      <circle cx="46.5" cy="24.5" r="2.6" fill="${O}"/><circle cx="47.3" cy="23.4" r="1" fill="#fff"/>`,
  }),

  tiger: frame({
    legs: '#ff9f1c', body: '#ff9f1c', arms: '#ff9f1c',
    tail: `<path d="M24 58 Q10 62 9 50 Q9 44 14 44" fill="none" stroke="${O}" stroke-width="7.5" stroke-linecap="round"/>
           <path d="M24 58 Q10 62 9 50 Q9 44 14 44" fill="none" stroke="#ff9f1c" stroke-width="4" stroke-linecap="round" stroke-dasharray="4 3"/>`,
    belly: `<ellipse cx="40" cy="58" rx="8" ry="7.5" fill="#fff6e6" stroke="${O}" stroke-width="1.4"/>
            <path d="M27 49 L31 51 M25 54 L30 55 M49 49 L45 51" stroke="${O}" stroke-width="2" stroke-linecap="round"/>`,
    head: `
      <circle cx="29" cy="15" r="6.5" fill="#ff9f1c" stroke="${O}" stroke-width="${SW}"/><circle cx="29" cy="15" r="3" fill="#ffc6a8"/>
      <circle cx="58" cy="15" r="6.5" fill="#ff9f1c" stroke="${O}" stroke-width="${SW}"/><circle cx="58" cy="15" r="3" fill="#ffc6a8"/>
      <circle cx="44" cy="30" r="19" fill="#ff9f1c" stroke="${O}" stroke-width="${SW}"/>
      <path d="M40 15 H48 M44 15 V22 M40.5 18.5 H47.5 M40 22 H48" stroke="${O}" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M26 27 L32 29 M26 32 L31 33 M62 27 L56 29 M62 32 L57 33" stroke="${O}" stroke-width="2" stroke-linecap="round"/>
      <ellipse cx="47" cy="38" rx="10" ry="7" fill="#fff6e6" stroke="${O}" stroke-width="1.4"/>
      ${eyes(38, 53, 29)}
      <path d="M44.5 34.5 L49.5 34.5 L47 37.5 Z" fill="#ff6b8b" stroke="${O}" stroke-width="1.2" stroke-linejoin="round"/>
      <path d="M43 40 Q45 42.5 47 40 Q49 42.5 51 40" fill="none" stroke="${O}" stroke-width="1.5" stroke-linecap="round"/>`,
  }),

  rabbit: frame({
    legs: '#ffffff', body: '#ffffff', arms: '#ffffff',
    tail: `<circle cx="23" cy="58" r="5" fill="#fff" stroke="${O}" stroke-width="${SW}"/>`,
    belly: `<g transform="translate(38 50)"><rect x="-3.5" y="-3.5" width="7" height="7" transform="rotate(45)" fill="#e63946" stroke="${O}" stroke-width="1.3"/>
            <path d="M-2 4 L-3 11 M2 4 L3 11" stroke="#e63946" stroke-width="1.8" stroke-linecap="round"/></g>`,
    head: `
      <g class="c-ears">
        <ellipse cx="36" cy="5" rx="5.5" ry="15" transform="rotate(-14 36 14)" fill="#fff" stroke="${O}" stroke-width="${SW}"/>
        <ellipse cx="36" cy="6" rx="2.6" ry="10" transform="rotate(-14 36 14)" fill="#ffb3c6"/>
        <ellipse cx="51" cy="4" rx="5.5" ry="15" transform="rotate(12 51 14)" fill="#fff" stroke="${O}" stroke-width="${SW}"/>
        <ellipse cx="51" cy="5" rx="2.6" ry="10" transform="rotate(12 51 14)" fill="#ffb3c6"/>
      </g>
      <circle cx="44" cy="32" r="17.5" fill="#fff" stroke="${O}" stroke-width="${SW}"/>
      ${eyes(39, 52, 30, 3)}
      <path d="M45 35.5 L49 35.5 L47 38 Z" fill="#ff7aa2"/>
      <path d="M44 39.5 Q47 42 50 39.5" fill="none" stroke="${O}" stroke-width="1.5" stroke-linecap="round"/>
      <rect x="45.4" y="40" width="3.2" height="3.3" rx=".8" fill="#fff" stroke="${O}" stroke-width="1"/>
      ${blush(34, 57, 37)}`,
  }),

  monkey: frame({
    legs: '#8b5a2b', body: '#9c6b3f', arms: '#8b5a2b',
    tail: `<path d="M24 60 Q8 62 10 48 Q12 40 19 43 Q22 47 17 48" fill="none" stroke="${O}" stroke-width="6.5" stroke-linecap="round"/>
           <path d="M24 60 Q8 62 10 48 Q12 40 19 43 Q22 47 17 48" fill="none" stroke="#9c6b3f" stroke-width="3.2" stroke-linecap="round"/>`,
    belly: `<ellipse cx="40" cy="57" rx="8" ry="8" fill="#f2cf9b" stroke="${O}" stroke-width="1.4"/>`,
    head: `
      <circle cx="25" cy="31" r="6.5" fill="#f2cf9b" stroke="${O}" stroke-width="${SW}"/>
      <circle cx="63" cy="31" r="6.5" fill="#f2cf9b" stroke="${O}" stroke-width="${SW}"/>
      <circle cx="44" cy="29" r="18.5" fill="#9c6b3f" stroke="${O}" stroke-width="${SW}"/>
      <path d="M44 23 C38 17 29 21 31 30 C32 38 38 44 46 44 C54 44 60 38 59 30 C59 21 50 17 44 23 Z" fill="#f2cf9b" stroke="${O}" stroke-width="1.6"/>
      <path d="M26.5 18 Q44 8 61.5 18" fill="none" stroke="#ffcc00" stroke-width="4.5" stroke-linecap="round"/>
      <path d="M26.5 18 Q44 8 61.5 18" fill="none" stroke="${O}" stroke-width="1" stroke-linecap="round" opacity=".55"/>
      <circle cx="44" cy="12.5" r="2.4" fill="#e63946" stroke="${O}" stroke-width="1"/>
      ${eyes(39, 51, 29, 2.9)}
      <ellipse cx="46" cy="35" rx="1.2" ry=".9" fill="${O}"/><ellipse cx="49" cy="35" rx="1.2" ry=".9" fill="${O}"/>
      <path d="M40 38.5 Q46 43.5 53 38.5" fill="#c0392b" stroke="${O}" stroke-width="1.5" stroke-linejoin="round"/>`,
  }),

  kungfu: frame({
    legs: '#262626', body: '#ffb000', arms: '#ffcf9e',
    belly: `<path d="M38 43 L44 53 L38 64" fill="none" stroke="#c97a00" stroke-width="1.6"/>
            <rect x="23.5" y="55" width="29" height="4.6" rx="2" fill="#262626"/>
            <path d="M28 59 L25 66 M31 59 L30 66" stroke="#262626" stroke-width="2.2" stroke-linecap="round"/>`,
    head: `
      <path d="M26 21 Q14 18 6 24 Q15 23 22 26 Q12 28 8 34 Q18 29 27 26 Z" fill="#e63946" stroke="${O}" stroke-width="1.6" stroke-linejoin="round" class="c-ribbon"/>
      <circle cx="40" cy="8" r="6.5" fill="#262626" stroke="${O}" stroke-width="${SW}"/>
      <circle cx="44" cy="29" r="18" fill="#ffd9b3" stroke="${O}" stroke-width="${SW}"/>
      <path d="M26 28 Q25 11 44 11 Q62 11 62 25 Q53 17 40 20 Q32 22 26 28 Z" fill="#262626" stroke="${O}" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M26.3 23.5 Q44 15 61.8 22" fill="none" stroke="#e63946" stroke-width="4.2" stroke-linecap="round"/>
      <path d="M41 27 L45 26.5 M51 26.5 L55 27" stroke="${O}" stroke-width="2" stroke-linecap="round"/>
      ${eyes(43, 53, 31, 2.6)}
      <path d="M45.5 38.5 Q49 40.5 52 38" fill="none" stroke="${O}" stroke-width="1.7" stroke-linecap="round"/>
      ${blush(39, 58, 36)}`,
    extra: `<circle cx="47.5" cy="61" r="4" fill="#ffd9b3" stroke="${O}" stroke-width="1.6"/>`,
  }),
};

export const CHARACTERS = [
  { id: 'panda',  name: '판다',   zh: '熊猫', color: '#2a2a2a', tagline: '느긋해 보여도 집중력 최강!' },
  { id: 'dragon', name: '용',     zh: '龙',   color: '#2fb463', tagline: '하늘을 나는 전설의 질주' },
  { id: 'tiger',  name: '호랑이', zh: '老虎', color: '#ff8c00', tagline: '이마의 王자는 왕의 증표' },
  { id: 'rabbit', name: '토끼',   zh: '兔子', color: '#ff7aa2', tagline: '깡총깡총 스피드 1등' },
  { id: 'monkey', name: '원숭이', zh: '猴子', color: '#9c6b3f', tagline: '장난꾸러기 재주꾼' },
  { id: 'kungfu', name: '쿵푸',   zh: '功夫', color: '#e63946', tagline: '손가락도 무술처럼 빠르게' },
];

export const CHAR_BY_ID = Object.fromEntries(CHARACTERS.map(c => [c.id, c]));

export function charSVG(id) {
  return SVGS[id] || SVGS.panda;
}
