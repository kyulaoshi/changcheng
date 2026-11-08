// =====================================================================
//  공용 도우미: 순위 계산, 시간 표시, 토스트, 모달, 오류 메시지, 폭죽
// =====================================================================

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** 서버(_finalize_room)와 똑같은 기준으로 순위를 매깁니다 */
export function rankPlayers(players, total) {
  const arr = players.slice().sort((a, b) => {
    const fa = a.correct >= total ? 1 : 0, fb = b.correct >= total ? 1 : 0;
    if (fa !== fb) return fb - fa;                                   // 1) 완주 여부
    if (a.correct !== b.correct) return b.correct - a.correct;       // 2) 정답 수
    const ma = a.finish_ms ?? Infinity, mb = b.finish_ms ?? Infinity;
    if (ma !== mb) return ma - mb;                                   // 3) 완주 시간
    if (a.wrong !== b.wrong) return a.wrong - b.wrong;               // 4) 오답 수
    return String(a.joined_at || '').localeCompare(String(b.joined_at || ''));
  });
  arr.forEach((p, i) => { p.rank = i + 1; });
  return arr;
}

export function fmtClock(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtFinish(ms) {
  if (ms == null) return '—';
  return `${(ms / 1000).toFixed(1)}초`;
}

export function accuracy(correct, wrong) {
  const t = correct + wrong;
  return t ? Math.round((correct / t) * 1000) / 10 : 0;
}

// ---------- 토스트 ----------
export function toast(msg, type = 'info', ms = 2600) {
  let wrap = $('#toast-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'toast-wrap';
    document.body.appendChild(wrap);
  }
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.classList.add('out'), ms);
  setTimeout(() => el.remove(), ms + 400);
}

// ---------- 모달 ----------
export function openModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.add('open');
  m.setAttribute('aria-hidden', 'false');
  const focusable = m.querySelector('[data-autofocus], button, input, textarea');
  focusable?.focus();
}
export function closeModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.remove('open');
  m.setAttribute('aria-hidden', 'true');
}
export function wireModals() {
  document.addEventListener('click', e => {
    const close = e.target.closest('[data-close]');
    if (close) closeModal(close.closest('.modal').id);
    if (e.target.classList?.contains('modal')) closeModal(e.target.id);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') $$('.modal.open').forEach(m => closeModal(m.id));
  });
}

// ---------- 서버 오류 → 친절한 한국어 ----------
const ERR = {
  ROOM_NOT_FOUND: '학급 코드를 찾을 수 없어요. 선생님이 알려준 코드를 다시 확인해 주세요.',
  NAME_TAKEN: '같은 이름이 이미 있어요! 이름 뒤에 번호나 별명을 붙여 주세요. (예: 민준2, 민준_3반)',
  BAD_NAME: '이름은 1~12자로 입력해 주세요.',
  BAD_CHARACTER: '캐릭터를 골라 주세요.',
  ROOM_FULL: '방이 꽉 찼어요 (최대 60명).',
  NOT_SIGNED_IN: '접속 준비 중이에요. 잠시 후 다시 시도해 주세요.',
  TEACHER_ONLY: '선생님만 할 수 있는 기능이에요.',
  TOO_MANY_ROOMS: '방이 너무 많아요. 안 쓰는 방을 삭제해 주세요.',
  NO_WORDS: '단어장이 비어 있어요. 단어를 먼저 저장해 주세요.',
  ALREADY_PLAYING: '이미 게임이 진행 중이에요.',
  NOT_PLAYING: '지금은 게임 중이 아니에요.',
  NOT_STARTED: '아직 출발 전이에요!',
  TIME_UP: '시간이 끝났어요!',
  NOT_IN_ROOM: '방에서 나가졌어요. 다시 입장해 주세요.',
  NOT_IN_ROUND: '이번 판이 시작된 뒤에 들어왔어요. 다음 판을 기다려 주세요.',
  FORBIDDEN: '권한이 없어요.',
  NOT_FINISHED: '게임이 끝난 뒤에 볼 수 있어요.',
  NOT_TEACHER: '교사 등록이 필요해요. 교사 가입 코드를 입력하거나 관리자 선생님께 문의해 주세요.',
  BAD_TEACHER_CODE: '교사 가입 코드가 맞지 않아요.',
  ADMIN_ONLY: '관리자만 할 수 있는 기능이에요.',
  CANNOT_REMOVE_SELF: '자기 자신의 권한은 해제할 수 없어요.',
  WEAK_PASSWORD: '비밀번호는 6자 이상이어야 해요.',
  TOO_MANY_WORDS: '단어장 하나에는 500개까지 넣을 수 있어요.',
  TOO_MANY_SETS: '보관함이 가득 찼어요. 안 쓰는 단어장을 지워 주세요.',
  NOT_FOUND: '찾을 수 없어요. 이미 지워졌을 수 있어요.',
  NOT_OPEN: '아직 레이스가 열리지 않았어요.',
  ALREADY_DONE: '이번 레이스는 이미 달렸어요.',
  BAD_ANSWERS: '기록 형식이 올바르지 않아요.',
};
export function errCode(err) {
  const m = String(err?.message || err || '');
  const k = Object.keys(ERR).sort((a, b) => b.length - a.length).find(code => m.includes(code));
  return k || (/fetch|network|Failed to|timeout|ERR_/i.test(m) ? 'NETWORK' : 'UNKNOWN');
}
export function errMessage(err) {
  const code = errCode(err);
  if (code === 'NETWORK') return '인터넷 연결이 불안정해요. 잠시 후 다시 시도해 주세요.';
  return ERR[code] || `문제가 생겼어요: ${String(err?.message || err).slice(0, 80)}`;
}

// ---------- 폭죽 ----------
export function startFireworks(canvas, { duration = 6000, intensity = 1 } = {}) {
  if (!canvas) return () => {};
  const g = canvas.getContext('2d');
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let w, h, raf, stopped = false;
  const parts = [];
  const colors = ['#ffd23f', '#ff4d4d', '#ff9f1c', '#ffe9a8', '#e63946', '#3cc46f', '#ffffff'];
  const resize = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize);
  const burst = () => {
    const x = w * (0.15 + Math.random() * 0.7), y = h * (0.12 + Math.random() * 0.35);
    const col = colors[Math.floor(Math.random() * colors.length)];
    const n = reduce ? 20 : 60;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n, sp = 2 + Math.random() * 4.5;
      parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, col, r: 1.5 + Math.random() * 2 });
    }
  };
  const confetti = () => {
    parts.push({ x: Math.random() * w, y: -10, vx: (Math.random() - .5) * 1.5, vy: 1.5 + Math.random() * 2, life: 1.6, col: colors[Math.floor(Math.random() * colors.length)], r: 3 + Math.random() * 3, rect: true, rot: Math.random() * 6 });
  };
  const t0 = performance.now();
  let lastBurst = 0;
  const loop = (t) => {
    if (stopped) return;
    g.clearRect(0, 0, w, h);
    const running = t - t0 < duration;
    if (running && t - lastBurst > (reduce ? 900 : 380 / intensity)) { burst(); lastBurst = t; }
    if (running && !reduce && Math.random() < 0.5 * intensity) confetti();
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.x += p.vx; p.y += p.vy;
      if (p.rect) { p.rot += 0.1; p.life -= 0.004; } else { p.vy += 0.06; p.vx *= 0.985; p.life -= 0.014; }
      if (p.life <= 0 || p.y > h + 20) { parts.splice(i, 1); continue; }
      g.globalAlpha = Math.min(1, p.life);
      g.fillStyle = p.col;
      if (p.rect) {
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); g.restore();
      } else {
        g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill();
      }
    }
    g.globalAlpha = 1;
    if (running || parts.length) raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => { stopped = true; cancelAnimationFrame(raf); window.removeEventListener('resize', resize); g.clearRect(0, 0, w, h); };
}

export function downloadCSV(filename, rows) {
  const csv = rows.map(r => r.map(v => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }); // BOM: 엑셀 한글 깨짐 방지
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
