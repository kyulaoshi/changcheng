// =====================================================================
//  끝없는 만리장성 트랙 (혼자 달리기용)
//  - 결승선·구간 없음: 맞힐수록 계속 앞으로. 화면(카메라)이 내 캐릭터를 따라감
//  - 100m마다 눈금, 500m마다 봉화대, 1,000m마다 큰 문
//  - 👻 유령(이 기기 최고 기록)은 두 번째 레인에서 같은 시간 기준으로 달림
// =====================================================================
import { charSVG } from './characters.js';
import { esc } from './common.js';

const TOWER = `<svg viewBox="0 0 40 46" aria-hidden="true">
  <path d="M6 16 L20 6 L34 16 Z" fill="#c0392b" stroke="#3a2412" stroke-width="2" stroke-linejoin="round"/>
  <path d="M3 17 Q20 12 37 17" fill="none" stroke="#3a2412" stroke-width="2.4" stroke-linecap="round"/>
  <rect x="9" y="17" width="22" height="27" fill="#d9b886" stroke="#3a2412" stroke-width="2"/>
  <path d="M9 24 H31 M9 31 H31 M9 38 H31 M16 17 V24 M24 24 V31 M16 31 V38 M24 38 V44" stroke="#b48a58" stroke-width="1.2"/>
  <rect x="17" y="34" width="6" height="10" rx="3" fill="#3a2412"/>
  <path d="M20 6 V1" stroke="#3a2412" stroke-width="2"/><path d="M20 1 L28 3 L20 5 Z" fill="#e63946"/>
</svg>`;

const GATE = `<svg viewBox="0 0 70 60" aria-hidden="true">
  <path d="M2 12 Q35 2 68 12 L64 18 Q35 10 6 18 Z" fill="#c0392b" stroke="#3a2412" stroke-width="2" stroke-linejoin="round"/>
  <rect x="9" y="17" width="7" height="42" fill="#e63946" stroke="#3a2412" stroke-width="2"/>
  <rect x="54" y="17" width="7" height="42" fill="#e63946" stroke="#3a2412" stroke-width="2"/>
  <path d="M12.5 17 V0" stroke="#3a2412" stroke-width="1.6"/><path class="flag-wave" d="M12.5 1 L24 4 L12.5 8 Z" fill="#ffd23f" stroke="#3a2412" stroke-width="1"/>
  <path d="M57.5 17 V0" stroke="#3a2412" stroke-width="1.6"/><path class="flag-wave" d="M57.5 1 L69 4 L57.5 8 Z" fill="#ffd23f" stroke="#3a2412" stroke-width="1"/>
</svg>`;

const SCENERY = `<svg viewBox="0 0 1600 140" preserveAspectRatio="none" aria-hidden="true">
  <path d="M0 140 L0 70 L80 40 L150 75 L240 25 L330 70 L420 35 L520 80 L610 30 L700 70 L800 20 L900 75 L990 40 L1080 78 L1180 28 L1280 72 L1370 38 L1460 80 L1540 45 L1600 70 L1600 140 Z" fill="var(--mtn-far)"/>
  <path d="M0 140 L0 96 L120 70 L220 100 L340 62 L460 102 L560 75 L680 105 L790 68 L900 100 L1010 72 L1130 104 L1240 70 L1360 100 L1480 74 L1600 96 L1600 140 Z" fill="var(--mtn-near)"/>
  <path d="M0 116 Q100 104 200 112 T400 108 T600 114 T800 104 T1000 112 T1200 106 T1400 114 T1600 116" fill="none" stroke="var(--wall-far)" stroke-width="6"/>
  <g fill="var(--wall-far)"><rect x="196" y="94" width="12" height="16"/><rect x="596" y="96" width="12" height="16"/><rect x="996" y="94" width="12" height="16"/><rect x="1396" y="96" width="12" height="16"/></g>
</svg>`;

export const fmtMeters = m => `${Math.round(m).toLocaleString('ko-KR')}m`;

export class EndlessTrack {
  constructor(el) {
    this.el = el;
    this.cam = 0;            // 화면 기준 거리(m)
    this.target = 0;         // 내 실제 거리(m)
    this.runners = new Map();// id → { node, shown, target, ... }
    this.marks = new Map();  // 거리(m) → 요소
    this.raf = 0;
    this.render();
    this.loop = this.loop.bind(this);
    if ('ResizeObserver' in window) new ResizeObserver(() => this.layout()).observe(this.el);
  }

  render() {
    this.el.classList.add('et');
    this.el.innerHTML = `
      <div class="et-sky">
        <div class="cloud c1"></div><div class="cloud c2"></div><div class="cloud c3"></div>
        <div class="et-mtn">${SCENERY}${SCENERY}</div>
      </div>
      <div class="et-lanes"></div>
      <div class="et-marks" aria-hidden="true"></div>`;
    this.sky = this.el.querySelector('.et-sky');
    this.mtn = this.el.querySelector('.et-mtn');
    this.lanes = this.el.querySelector('.et-lanes');
    this.marksEl = this.el.querySelector('.et-marks');
    this.layout();
  }

  layout() {
    const W = this.el.clientWidth || 800;
    const H = this.el.clientHeight || 260;
    const n = Math.max(1, this.runners.size);
    const skyH = this.sky.offsetHeight || 84;
    const laneH = Math.max(40, Math.min(96, Math.floor((H - skyH - 6) / n)));
    this.el.style.setProperty('--lane-h', `${laneH}px`);
    this.el.style.setProperty('--RW', `${Math.round(laneH * 0.78)}px`);
    this.W = W;
    this.meX = Math.round(W * (W < 600 ? 0.22 : 0.26));     // 내 캐릭터가 서 있는 화면 위치
    this.ppm = Math.max(0.32, Math.min(1.25, W / 1100));    // 1m = 몇 px
    this.drawMarks(true);
    this.place();
  }

  /** list: [{ id, name, character, ghost? }] — 첫 번째가 나 */
  setPlayers(list) {
    this.lanes.innerHTML = '';
    this.runners.clear();
    list.forEach((p, i) => {
      const lane = document.createElement('div');
      lane.className = `lane${i === 0 ? ' me' : ''}`;
      lane.dataset.id = p.id;
      lane.innerHTML = `
        <div class="lane-num">${p.ghost ? '👻' : '나'}</div>
        <div class="runner">
          <div class="tag"><span class="tag-name">${esc(p.name)}</span><span class="tag-gap"></span></div>
          <div class="trail"></div>
          <div class="char">${charSVG(p.character)}</div>
        </div>`;
      this.lanes.appendChild(lane);
      this.runners.set(p.id, {
        lane, node: lane.querySelector('.runner'), gap: lane.querySelector('.tag-gap'),
        shown: 0, target: 0, ghost: !!p.ghost, runT: 0, boostT: 0,
      });
    });
    this.layout();
  }

  reset() {
    this.cam = 0; this.target = 0;
    for (const r of this.runners.values()) { r.shown = 0; r.target = 0; }
    this.marks.forEach(m => m.remove()); this.marks.clear();
    this.layout();
  }

  setMeters(id, m) {
    const r = this.runners.get(id);
    if (!r) return;
    if (m > r.target) this.run(id);
    r.target = m;
    if (!r.ghost) this.target = m;
    this.start();
  }

  run(id) {
    const r = this.runners.get(id);
    if (!r) return;
    r.node.classList.add('running');
    clearTimeout(r.runT);
    r.runT = setTimeout(() => r.node.classList.remove('running'), 900);
  }

  boost(id, cls) {
    const r = this.runners.get(id);
    if (!r) return;
    r.node.classList.remove('boost-s', 'boost-l');
    void r.node.offsetWidth;
    r.node.classList.add(cls);
    clearTimeout(r.boostT);
    r.boostT = setTimeout(() => r.node.classList.remove(cls), cls === 'boost-l' ? 1600 : 1200);
  }

  start() { if (!this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame(this.loop); } }
  stop() { cancelAnimationFrame(this.raf); this.raf = 0; }

  loop(now) {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    let moving = false;
    const k = 1 - Math.exp(-dt * 7);              // 부드럽게 따라가기
    for (const r of this.runners.values()) {
      const d = r.target - r.shown;
      if (Math.abs(d) > 0.3) { r.shown += d * k; moving = true; } else r.shown = r.target;
    }
    const me = [...this.runners.values()].find(r => !r.ghost);
    if (me) this.cam = me.shown;
    this.place();
    this.drawMarks();
    this.raf = moving ? requestAnimationFrame(this.loop) : 0;
  }

  place() {
    const scrollPx = this.cam * this.ppm;
    this.el.style.setProperty('--scroll', `${-scrollPx}px`);
    this.marksEl.style.transform = `translateX(${this.meX - scrollPx}px)`;
    this.mtn.style.transform = `translateX(${-((scrollPx * 0.12) % (this.mtn.offsetWidth / 2 || 1))}px)`;
    const rw = parseFloat(getComputedStyle(this.el).getPropertyValue('--RW')) || 50;
    for (const r of this.runners.values()) {
      let x = this.meX + (r.shown - this.cam) * this.ppm;
      const min = 34, max = this.W - rw - 10;
      const off = x < min ? 'left' : x > max ? 'right' : '';
      x = Math.max(min, Math.min(max, x));
      r.node.style.left = `${x}px`;
      if (r.ghost) {
        const gap = Math.round((r.shown - this.cam) / 100) * 100;
        r.gap.textContent = off === 'right' ? ` ▶ +${fmtMeters(gap)}` : off === 'left' ? ` ◀ ${fmtMeters(gap)}` : '';
        r.lane.classList.toggle('far', !!off);
      }
    }
  }

  drawMarks(force = false) {
    const from = Math.floor((this.cam - this.meX / this.ppm) / 100) * 100 - 100;
    const to = this.cam + (this.W - this.meX) / this.ppm + 100;
    if (!force && this._range && from === this._range[0] && Math.abs(to - this._range[1]) < 100) return;
    this._range = [from, to];
    for (const [m, el] of this.marks) {
      if (m < from || m > to || force) { el.remove(); this.marks.delete(m); }
    }
    for (let m = Math.max(0, from); m <= to; m += 100) {
      if (this.marks.has(m)) continue;
      const el = document.createElement('div');
      const kind = m === 0 ? 'start' : m % 1000 === 0 ? 'gate' : m % 500 === 0 ? 'tower' : 'post';
      el.className = `et-mark mk-${kind}`;
      el.style.left = `${m * this.ppm}px`;
      el.innerHTML = kind === 'start' ? '<span class="mk-label">起点</span>'
        : kind === 'gate' ? `${GATE}<span class="mk-label">${fmtMeters(m)}</span>`
        : kind === 'tower' ? `${TOWER}<span class="mk-label">${fmtMeters(m)}</span>`
        : (this.ppm * 100 >= 70 ? `<span class="mk-label">${fmtMeters(m)}</span>` : '');   // 좁은 화면에서는 100m 글자 생략
      this.marksEl.appendChild(el);
      this.marks.set(m, el);
    }
  }
}
