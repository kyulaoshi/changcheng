// =====================================================================
//  QR 코드 생성기 (외부 라이브러리 없음 · 학교 방화벽에서도 동작)
//  바이트 모드 · 오류정정 M · 버전 1~40 (최대 약 2,300바이트)
//  사용: qrSVG('https://...', { size: 240 })  → <svg> 문자열
// =====================================================================

// 오류정정 M 기준 표 (버전 1~40)
const ECC_PER_BLOCK = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28];
const NUM_BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49];
function rawDataModules(v) {
  let r = (16 * v + 128) * v + 64;
  if (v >= 2) {
    const na = Math.floor(v / 7) + 2;
    r -= (25 * na - 10) * na - 55;
    if (v >= 7) r -= 36;
  }
  return r;
}
function alignPositions(v) {
  if (v === 1) return [];
  const na = Math.floor(v / 7) + 2;
  const size = v * 4 + 17;
  const step = v === 32 ? 26 : Math.ceil((v * 4 + 4) / (na * 2 - 2)) * 2;
  const res = [6];
  for (let pos = size - 7; res.length < na; pos -= step) res.splice(1, 0, pos);
  return res;
}

// ---------- GF(256) ----------
const EXP = new Array(512), LOG = new Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
const gmul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

function rsGenerator(n) {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) { next[j] ^= g[j]; next[j + 1] ^= gmul(g[j], EXP[i]); }
    g = next;
  }
  return g;
}
function rsRemainder(data, n) {
  const gen = rsGenerator(n);
  const r = new Array(n).fill(0);
  for (const b of data) {
    const f = b ^ r.shift();
    r.push(0);
    for (let i = 0; i < n; i++) r[i] ^= gmul(gen[i + 1], f);
  }
  return r;
}

function utf8(str) { return [...new TextEncoder().encode(str)]; }

function encodeData(bytes) {
  for (let v = 1; v <= 40; v++) {
    const ecc = ECC_PER_BLOCK[v], nb = NUM_BLOCKS[v];
    const rawCw = Math.floor(rawDataModules(v) / 8);
    const dataCap = rawCw - ecc * nb;
    const cntBits = v <= 9 ? 8 : 16;
    if (4 + cntBits + bytes.length * 8 > dataCap * 8) continue;
    const bits = [];
    const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    put(0b0100, 4); put(bytes.length, cntBits);
    bytes.forEach(b => put(b, 8));
    put(0, Math.min(4, dataCap * 8 - bits.length));
    while (bits.length % 8) bits.push(0);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
    for (let pad = 0xec; data.length < dataCap; pad ^= 0xec ^ 0x11) data.push(pad);
    // 블록 나누기 (짧은 블록 먼저) + RS
    const numShort = nb - (rawCw % nb);
    const shortLen = Math.floor(rawCw / nb) - ecc;
    const blocks = [];
    let k = 0;
    for (let i = 0; i < nb; i++) {
      const len = shortLen + (i < numShort ? 0 : 1);
      const d = data.slice(k, k + len); k += len;
      blocks.push({ d, e: rsRemainder(d, ecc) });
    }
    const out = [];
    for (let i = 0; i <= shortLen; i++) blocks.forEach(b => { if (i < b.d.length) out.push(b.d[i]); });
    for (let i = 0; i < ecc; i++) blocks.forEach(b => out.push(b.e[i]));
    return { version: v, codewords: out };
  }
  throw new Error('QR: 내용이 너무 깁니다');
}

function bch(value, poly, polyDeg) {
  let v = value << polyDeg;
  const top = 31 - Math.clz32(poly);
  while (v && 31 - Math.clz32(v) >= top) v ^= poly << (31 - Math.clz32(v) - top);
  return (value << polyDeg) | v;
}

function buildMatrix(version, codewords, mask) {
  const n = version * 4 + 17;
  const m = Array.from({ length: n }, () => new Array(n).fill(null));
  const fn = Array.from({ length: n }, () => new Array(n).fill(false));
  const set = (r, c, v) => { m[r][c] = v; fn[r][c] = true; };

  const finder = (r0, c0) => {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
      const rr = r0 + r, cc = c0 + c;
      if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
      const on = r >= 0 && r <= 6 && c >= 0 && c <= 6 &&
        (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
      set(rr, cc, on);
    }
  };
  finder(0, 0); finder(0, n - 7); finder(n - 7, 0);
  for (let i = 8; i < n - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  const al = alignPositions(version);
  for (const r of al) for (const c of al) {
    if ((r === 6 && c === 6) || (r === 6 && c === al[al.length - 1]) || (r === al[al.length - 1] && c === 6)) continue;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
    }
  }
  set(n - 8, 8, true); // dark module

  // 형식 정보 (ECC M = 00)
  const fmt = bch((0b00 << 3) | mask, 0x537, 10) ^ 0x5412;
  const fbit = i => ((fmt >>> i) & 1) === 1;
  for (let i = 0; i <= 5; i++) set(i, 8, fbit(i));
  set(7, 8, fbit(6)); set(8, 8, fbit(7)); set(8, 7, fbit(8));
  for (let i = 9; i < 15; i++) set(8, 14 - i, fbit(i));
  for (let i = 0; i < 8; i++) set(8, n - 1 - i, fbit(i));
  for (let i = 8; i < 15; i++) set(n - 15 + i, 8, fbit(i));

  // 버전 정보 (7 이상)
  if (version >= 7) {
    const vb = bch(version, 0x1f25, 12);
    for (let i = 0; i < 18; i++) {
      const bit = ((vb >>> i) & 1) === 1;
      const a = n - 11 + (i % 3), b = Math.floor(i / 3);
      set(a, b, bit); set(b, a, bit);
    }
  }

  // 데이터 배치 (지그재그)
  const bits = [];
  codewords.forEach(cw => { for (let i = 7; i >= 0; i--) bits.push((cw >>> i) & 1); });
  let bi = 0;
  for (let right = n - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < n; vert++) {
      for (let j = 0; j < 2; j++) {
        const c = right - j;
        const upward = ((right + 1) & 2) === 0;
        const r = upward ? n - 1 - vert : vert;
        if (fn[r][c]) continue;
        let dark = bi < bits.length ? bits[bi] === 1 : false;
        bi++;
        if (maskFn(mask, r, c)) dark = !dark;
        m[r][c] = dark;
      }
    }
  }
  return m;
}

function maskFn(mask, r, c) {
  switch (mask) {
    case 0: return (r + c) % 2 === 0;
    case 1: return r % 2 === 0;
    case 2: return c % 3 === 0;
    case 3: return (r + c) % 3 === 0;
    case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
    case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
    default: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
  }
}

function penalty(m) {
  const n = m.length;
  let p = 0;
  // 규칙 1: 같은 색 5개 이상 연속
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < n; i++) {
      let run = 1;
      for (let j = 1; j < n; j++) {
        const a = pass ? m[j][i] : m[i][j], b = pass ? m[j - 1][i] : m[i][j - 1];
        if (a === b) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1;
      }
    }
  }
  // 규칙 2: 2x2 블록
  for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) {
    const v = m[r][c];
    if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) p += 3;
  }
  // 규칙 3: 파인더 비슷한 패턴
  const pat1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], pat2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  for (let i = 0; i < n; i++) for (let j = 0; j + 11 <= n; j++) {
    let h1 = true, h2 = true, v1 = true, v2 = true;
    for (let k = 0; k < 11; k++) {
      const h = m[i][j + k] ? 1 : 0, v = m[j + k][i] ? 1 : 0;
      if (h !== pat1[k]) h1 = false; if (h !== pat2[k]) h2 = false;
      if (v !== pat1[k]) v1 = false; if (v !== pat2[k]) v2 = false;
    }
    p += 40 * (h1 + h2 + v1 + v2);
  }
  // 규칙 4: 어두운 칸 비율
  let dark = 0;
  m.forEach(row => row.forEach(v => { if (v) dark++; }));
  p += Math.floor(Math.abs(dark * 20 - n * n * 10) / (n * n)) * 10;
  return p;
}

export function qrMatrix(text) {
  const { version, codewords } = encodeData(utf8(text));
  let best = null, bestP = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const m = buildMatrix(version, codewords, mask);
    const p = penalty(m);
    if (p < bestP) { bestP = p; best = m; }
  }
  return best;
}

export function qrSVG(text, { size = 240, margin = 4, dark = '#2b1d14', light = '#ffffff' } = {}) {
  const m = qrMatrix(text);
  const n = m.length + margin * 2;
  let d = '';
  m.forEach((row, r) => row.forEach((v, c) => { if (v) d += `M${c + margin} ${r + margin}h1v1h-1z`; }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${size}" height="${size}" shape-rendering="crispEdges" role="img" aria-label="QR 코드"><rect width="${n}" height="${n}" fill="${light}"/><path d="${d}" fill="${dark}"/></svg>`;
}
