// =====================================================================
//  단어장 링크: 서버 없이 단어 목록을 링크(주소) 안에 담습니다.
//  index.html#w=XXXX  ← XXXX에 제목·제한 시간·단어가 압축되어 들어 있음
//  (# 뒤는 서버로 전송되지 않으므로 GitHub Pages 같은 정적 호스팅에서 그대로 동작)
// =====================================================================

const clean = s => String(s ?? '').replace(/[\t\r\n]+/g, ' ').trim();

function toB64url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function pipe(bytes, stream) {
  const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

/** set = { title, seconds, shuffle, words: [{ko, zh, py}] } → 링크용 문자열 */
export async function encodeSet(set) {
  const lines = [['1', clean(set.title), String(set.seconds || 300), set.shuffle === false ? '0' : '1'].join('\t')];
  for (const w of set.words) lines.push([clean(w.ko), clean(w.zh), clean(w.py)].join('\t'));
  const raw = new TextEncoder().encode(lines.join('\n'));
  if (typeof CompressionStream === 'function') {
    try { return 'z' + toB64url(await pipe(raw, new CompressionStream('deflate-raw'))); } catch {}
  }
  return 'u' + toB64url(raw);
}

export async function decodeSet(code) {
  if (!code || code.length < 2) throw new Error('EMPTY');
  let bytes = fromB64url(code.slice(1));
  if (code[0] === 'z') {
    if (typeof DecompressionStream !== 'function') throw new Error('OLD_BROWSER');
    bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
  } else if (code[0] !== 'u') throw new Error('BAD_FORMAT');
  const [head, ...rows] = new TextDecoder().decode(bytes).split('\n');
  const [, title, seconds, shuffle] = head.split('\t');
  const words = rows.map(r => r.split('\t')).filter(c => c[0] && c[2]).map(([ko, zh, py]) => ({ ko, zh: zh || '', py }));
  if (!words.length) throw new Error('NO_WORDS');
  return {
    title: title || '선생님 단어장',
    seconds: Math.min(600, Math.max(30, parseInt(seconds, 10) || 300)),
    shuffle: shuffle !== '0',
    words,
  };
}

/** 주소의 #w= 부분에서 단어장 읽기 (없으면 null) */
export function codeFromLocation(loc = location) {
  const m = /[#&]w=([A-Za-z0-9_-]+)/.exec(loc.hash || '');
  return m ? m[1] : null;
}

/** 기록 저장용 짧은 열쇠 (같은 단어장 = 같은 열쇠) */
export function setKey(set) {
  const s = [set.title, set.seconds, ...set.words.map(w => `${w.ko}|${w.py}`)].join('\n');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
