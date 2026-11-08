// =====================================================================
//  만리장성 레이싱 트랙
//  - 참가자마다 레인 1줄 (겹침 없음), 인원이 많으면 레인 높이를 자동 축소
//  - 줌(＋/－) · 세로 스크롤 · 내 레인 고정(맨 위)
//  - 위치 = 정답 수 / 전체 문제 수  (20문제 기준 1개 = 5%)
// =====================================================================
import { charSVG } from './characters.js';
import { esc, rankPlayers } from './common.js';

const ZOOMS = [30, 38, 46, 56, 68, 84];
const MEDAL = ['🥇', '🥈', '🥉'];

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
  <rect x="20" y="17" width="30" height="11" rx="2" fill="#ffd23f" stroke="#3a2412" stroke-width="1.6"/>
  <text x="35" y="26" text-anchor="middle" font-size="9" font-weight="900" fill="#8a1c12" font-family="'ZCOOL KuaiLe','Noto Sans SC',sans-serif">终点</text>
  <rect x="9" y="17" width="7" height="42" fill="#e63946" stroke="#3a2412" stroke-width="2"/>
  <rect x="54" y="17" width="7" height="42" fill="#e63946" stroke="#3a2412" stroke-width="2"/>
  <path d="M12.5 17 V0" stroke="#3a2412" stroke-width="1.6"/><path class="flag-wave" d="M12.5 1 L24 4 L12.5 8 Z" fill="#ffd23f" stroke="#3a2412" stroke-width="1"/>
  <path d="M57.5 17 V0" stroke="#3a2412" stroke-width="1.6"/><path class="flag-wave" d="M57.5 1 L69 4 L57.5 8 Z" fill="#ffd23f" stroke="#3a2412" stroke-width="1"/>
</svg>`;

const SCENERY = `<svg class="sky-mtn" viewBox="0 0 1600 140" preserveAspectRatio="none" aria-hidden="true">
  <path d="M0 140 L0 70 L80 40 L150 75 L240 25 L330 70 L420 35 L520 80 L610 30 L700 70 L800 20 L900 75 L990 40 L1080 78 L1180 28 L1280 72 L1370 38 L1460 80 L1540 45 L1600 60 L1600 140 Z" fill="var(--mtn-far)"/>
  <path d="M0 140 L0 95 L120 70 L220 100 L340 62 L460 102 L560 75 L680 105 L790 68 L900 100 L1010 72 L1130 104 L1240 70 L1360 100 L1480 74 L1600 96 L1600 140 Z" fill="var(--mtn-near)"/>
  <path d="M0 118 Q100 104 200 112 T400 108 T600 114 T800 104 T1000 112 T1200 106 T1400 114 T1600 108" fill="none" stroke="var(--wall-far)" stroke-width="6"/>
  <path d="M0 112 Q100 98 200 106 T400 102 T600 108 T800 98 T1000 106 T1200 100 T1400 108 T1600 102" fill="none" stroke="var(--wall-far)" stroke-width="5" stroke-dasharray="5 5"/>
  <g fill="var(--wall-far)"><rect x="196" y="94" width="12" height="16"/><rect x="596" y="96" width="12" height="16"/><rect x="996" y="94" width="12" height="16"/><rect x="1396" y="96" width="12" height="16"/></g>
</svg>`;

export class RaceTrack {
  /**
   * @param {HTMLElement} el   트랙을 그릴 요소
   * @param {object} opts      { meId, total, big(교사 화면용) }
   */
  constructor(el, { meId = null, total = 20, big = false } = {}) {
    this.el = el;
    this.meId = meId;
    this.total = total;
    this.big = big;
    this.nodes = new Map();      // id → {lane, runner, ...}
    this.prev = new Map();       // id → {correct, combo}
    this.userZoom = null;
    this.onEvent = null;         // (type, player) => void   type: 'boost-s'|'boost-l'|'finish'
    this.render();
  }

  render() {
    this.el.classList.add('race');
    if (this.big) this.el.classList.add('race-big');
    this.el.innerHTML = `
      <div class="race-scroll">
        <div class="race-inner">
          <div class="race-sky">
            <div class="cloud c1"></div><div class="cloud c2"></div><div class="cloud c3"></div>
            <div class="sky-parallax">${SCENERY}</div>
            <div class="sky-start pos" style="--p:0"><span>起点</span></div>
            ${[0.25, 0.5, 0.75].map((p, i) => `
              <div class="sky-tower pos" style="--p:${p}">${TOWER}<b>${['烽火台 25%', '烽火台 50%', '烽火台 75%'][i]}</b></div>`).join('')}
            <div class="sky-gate">${GATE}</div>
          </div>
          <div class="race-lanes">
            <div class="lane-guides">
              ${[0.25, 0.5, 0.75].map(p => `<i class="guide pos" style="--p:${p}"></i>`).join('')}
              <i class="finish-line"></i>
            </div>
            <div class="lanes"></div>
            <div class="race-empty">참가자를 기다리는 중…</div>
          </div>
        </div>
      </div>
      <div class="race-tools">
        <span class="race-count">0명</span>
        <button type="button" class="rt-btn" data-zoom="-" title="레인 작게" aria-label="레인 작게">－</button>
        <button type="button" class="rt-btn" data-zoom="+" title="레인 크게" aria-label="레인 크게">＋</button>
        <button type="button" class="rt-btn rt-wide" data-zoom="auto" title="자동 맞춤">자동</button>
      </div>`;
    this.lanesEl = this.el.querySelector('.lanes');
    this.scrollEl = this.el.querySelector('.race-scroll');
    this.parallax = this.el.querySelector('.sky-parallax');
    this.countEl = this.el.querySelector('.race-count');
    this.emptyEl = this.el.querySelector('.race-empty');
    if ('ResizeObserver' in window) {
      let raf = 0;
      new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => this.applyZoom()); }).observe(this.scrollEl);
    }
    this.el.querySelector('.race-tools').addEventListener('click', e => {
      const b = e.target.closest('[data-zoom]');
      if (!b) return;
      const cur = this.currentZoom();
      const i = ZOOMS.indexOf(cur);
      if (b.dataset.zoom === '+') this.userZoom = ZOOMS[Math.min(ZOOMS.length - 1, (i < 0 ? 2 : i) + 1)];
      else if (b.dataset.zoom === '-') this.userZoom = ZOOMS[Math.max(0, (i < 0 ? 2 : i) - 1)];
      else this.userZoom = null;
      this.applyZoom();
    });
  }

  /** 화면 높이에 레인이 모두 들어가도록 가장 큰 레인 높이를 고름 (너무 작으면 스크롤) */
  autoZoom(n) {
    const sky = this.el.querySelector('.race-sky')?.offsetHeight || 84;
    const avail = (this.scrollEl?.clientHeight || 300) - sky - 14;
    const per = n ? avail / (n + 0.24) : avail; // +0.24 = 첫 레인 이름표 여백
    const max = this.big ? ZOOMS[ZOOMS.length - 1] : ZOOMS[ZOOMS.length - 2];
    const fit = ZOOMS.filter(z => z <= Math.min(per, max)).pop();
    return fit ?? ZOOMS[0];
  }
  currentZoom() { return this.userZoom ?? this.autoZoom(this.nodes.size); }
  applyZoom() {
    const z = this.currentZoom();
    if (z === this._z) return;
    this._z = z;
    this.el.style.setProperty('--lane-h', `${z}px`);
    this.el.classList.toggle('race-compact', z <= 38);
  }

  setTotal(n) { this.total = Math.max(1, n || 20); }
  setMe(id) { this.meId = id; }

  reset() {
    this.prev.clear();
    for (const n of this.nodes.values()) {
      n.runner.style.setProperty('--p', 0);
      n.runner.classList.remove('finished', 'boost-s', 'boost-l', 'running');
    }
  }

  /** players: [{id,name,character,correct,wrong,combo,finish_ms,joined_at}] */
  update(players) {
    const total = this.total;
    const ranked = rankPlayers(players.map(p => ({ ...p })), total);
    const rankOf = new Map(ranked.map(p => [p.id, p.rank]));
    const seen = new Set();

    // 레인 순서: 나 → 입장 순서 (순위가 바뀌어도 레인은 고정 → 화면이 덜 어지러움)
    const order = players.slice().sort((a, b) => {
      if (a.id === this.meId) return -1;
      if (b.id === this.meId) return 1;
      return String(a.joined_at || '').localeCompare(String(b.joined_at || ''));
    });

    order.forEach((p, idx) => {
      seen.add(p.id);
      let n = this.nodes.get(p.id);
      if (!n) n = this.createLane(p);
      if (this.lanesEl.children[idx] !== n.lane) this.lanesEl.insertBefore(n.lane, this.lanesEl.children[idx] || null);

      if (n.char !== p.character) { n.charEl.innerHTML = charSVG(p.character); n.char = p.character; }
      if (n.name !== p.name) { n.nameEl.textContent = p.name; n.name = p.name; }
      const rank = rankOf.get(p.id);
      n.rankEl.textContent = rank <= 3 && p.correct > 0 ? MEDAL[rank - 1] : rank;
      n.laneNum.textContent = rank;
      n.lane.classList.toggle('me', p.id === this.meId);

      const prog = Math.min(1, (p.correct || 0) / total);
      const prev = this.prev.get(p.id);
      if (!prev || prev.correct !== p.correct) {
        n.runner.style.setProperty('--p', prog.toFixed(4));
        if (prev && p.correct > prev.correct) this.run(n);
      }
      // 부스터: 3연속 = 작은 부스터, 5연속(그리고 5의 배수) = 강력한 부스터
      if (prev && p.combo > prev.combo) {
        if (p.combo >= 5 && p.combo % 5 === 0) this.boost(n, 'boost-l', p);
        else if (p.combo === 3) this.boost(n, 'boost-s', p);
      }
      const finished = p.correct >= total;
      if (finished && !n.runner.classList.contains('finished')) {
        n.runner.classList.add('finished');
        if (prev && prev.correct < total) this.onEvent?.('finish', p);
      } else if (!finished) {
        n.runner.classList.remove('finished');
      }
      n.lane.title = `${p.name} · 정답 ${p.correct}/${total} · 오답 ${p.wrong || 0}`;
      this.prev.set(p.id, { correct: p.correct, combo: p.combo });
    });

    for (const [id, n] of this.nodes) {
      if (!seen.has(id)) { n.lane.remove(); this.nodes.delete(id); this.prev.delete(id); }
    }
    this.countEl.textContent = `${players.length}명 참가`;
    this.emptyEl.style.display = players.length ? 'none' : '';
    this.applyZoom();

    // 배경 원근감: 내 진행도(교사 화면은 선두 기준)에 따라 산이 천천히 흘러감
    const lead = this.meId ? (players.find(p => p.id === this.meId)?.correct || 0)
                           : Math.max(0, ...players.map(p => p.correct || 0));
    this.parallax.style.setProperty('--px', (Math.min(1, lead / total)).toFixed(3));
    return ranked;
  }

  createLane(p) {
    const lane = document.createElement('div');
    lane.className = 'lane';
    lane.dataset.id = p.id;
    lane.innerHTML = `
      <div class="lane-num"></div>
      <div class="runner pos" style="--p:0">
        <div class="tag"><span class="tag-rank"></span><span class="tag-name"></span></div>
        <div class="trail"></div>
        <div class="char"></div>
        <div class="win-flag"><svg viewBox="0 0 24 30"><path d="M3 2 V29" stroke="#3a2412" stroke-width="2.2"/><path class="flag-wave" d="M4 3 L22 7 L4 13 Z" fill="#e63946" stroke="#3a2412" stroke-width="1.2"/></svg></div>
      </div>`;
    const n = {
      lane,
      runner: lane.querySelector('.runner'),
      charEl: lane.querySelector('.char'),
      nameEl: lane.querySelector('.tag-name'),
      rankEl: lane.querySelector('.tag-rank'),
      laneNum: lane.querySelector('.lane-num'),
      char: null, name: null, runT: 0, boostT: 0,
    };
    this.nodes.set(p.id, n);
    this.lanesEl.appendChild(lane);
    return n;
  }

  run(n) {
    n.runner.classList.add('running');
    clearTimeout(n.runT);
    n.runT = setTimeout(() => n.runner.classList.remove('running'), 900);
  }

  boost(n, cls, p) {
    n.runner.classList.remove('boost-s', 'boost-l');
    void n.runner.offsetWidth; // 애니메이션 재시작
    n.runner.classList.add(cls);
    clearTimeout(n.boostT);
    n.boostT = setTimeout(() => n.runner.classList.remove(cls), cls === 'boost-l' ? 1600 : 1200);
    this.onEvent?.(cls, p);
  }

  /** 애니메이션 없이 순간 이동 (구간 넘어갈 때 출발선으로) */
  jump(id, correct) {
    const n = this.nodes.get(id);
    const prev = this.prev.get(id) || { correct: 0, combo: 0 };
    this.prev.set(id, { ...prev, correct });
    if (!n) return;
    n.runner.style.transition = 'none';
    n.runner.classList.remove('finished');
    n.runner.style.setProperty('--p', Math.min(1, correct / this.total).toFixed(4));
    void n.runner.offsetWidth;
    n.runner.style.transition = '';
  }

  /** 정답 직후 내 캐릭터를 서버 응답보다 먼저 움직이기 위한 즉시 반영 */
  nudge(id, correct, combo) {
    const n = this.nodes.get(id);
    if (!n) return;
    const prev = this.prev.get(id) || { correct: 0, combo: 0 };
    if (correct <= prev.correct) return;
    n.runner.style.setProperty('--p', Math.min(1, correct / this.total).toFixed(4));
    this.run(n);
    if (combo > prev.combo) {
      if (combo >= 5 && combo % 5 === 0) this.boost(n, 'boost-l', { id, combo });
      else if (combo === 3) this.boost(n, 'boost-s', { id, combo });
    }
    if (correct >= this.total) n.runner.classList.add('finished');
    this.prev.set(id, { correct, combo });
    if (id === this.meId) this.parallax.style.setProperty('--px', Math.min(1, correct / this.total).toFixed(3));
  }
}
