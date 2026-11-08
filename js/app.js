// =====================================================================
//  长城竞速 — 학생용 게임 (서버 없음 · 각자 기기에서 플레이)
//  흐름: 시작(단어장 확인/주제 선택) → 이름·캐릭터 → 3·2·1 → 제한 시간 동안 최대한 멀리 → 결과 카드
//  · 단어장: 선생님이 만든 링크(#w=...) 안에 들어 있거나, 기본 주제별 단어장
//  · 이 기기의 최고 기록이 '유령'으로 옆 레인에서 함께 달림 (브라우저에만 저장)
// =====================================================================
import { RaceTrack } from './race.js';
import { CHARACTERS, CHAR_BY_ID, charSVG } from './characters.js';
import { WORD_PRESETS } from './words.js';
import { normalizePinyin, prepareAnswer, hasHangul } from './pinyin.js';
import { decodeSet, codeFromLocation, setKey } from './wordlink.js';
import { sfx, setSound, isSoundOn, unlockAudioOnFirstGesture } from './sound.js';
import { $, $$, esc, fmtClock, accuracy, toast, openModal, wireModals, startFireworks } from './common.js';

const LAP = 20;                 // 한 구간 = 정답 20개 = 2km
const METER_PER_WORD = 100;
const DEFAULT_SECONDS = 300;   // 기본 제한 시간 5분
const LS_CHAR = 'ccjs-character';
const LS_PRESET = 'ccjs-preset';
const LS_BEST = 'ccjs-best-';   // + 단어장 열쇠

const S = {
  set: null,          // { title, seconds, shuffle, words, fromLink }
  name: '',
  character: 'panda',
  run: null,
  screen: 'home',
  stopFireworks: null,
  ticker: 0,
  imeHintShown: false,
  pendingSubmit: false,
};
let track = null;

const lsGet = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const fmtDist = n => { const m = n * METER_PER_WORD; return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${m}m`; };
const fmtTime = s => (s % 60 === 0 ? `${s / 60}분` : s > 60 ? `${Math.floor(s / 60)}분 ${s % 60}초` : `${s}초`);

function show(name) {
  S.screen = name;
  $$('.screen').forEach(s => s.classList.toggle('active', s.id === `screen-${name}`));
  document.body.dataset.screen = name;
  if (name !== 'result' && S.stopFireworks) { S.stopFireworks(); S.stopFireworks = null; }
  window.scrollTo(0, 0);
}

// ---------------------------------------------------------------------
// 초기화
// ---------------------------------------------------------------------
async function init() {
  wireModals();
  unlockAudioOnFirstGesture();
  renderSoundBtn();
  renderCharGrid();
  $$('.cast').forEach(el => { el.innerHTML = charSVG(el.dataset.char); });
  selectChar(lsGet(LS_CHAR) || 'panda');

  $('#btn-sound').addEventListener('click', () => { setSound(!isSoundOn()); renderSoundBtn(); sfx.click(); });
  $('#btn-howto').addEventListener('click', () => openModal('modal-howto'));
  $('#btn-start').addEventListener('click', () => { sfx.click(); goJoin(); });
  $$('[data-go="home"]').forEach(b => b.addEventListener('click', () => show('home')));
  $('#join-form').addEventListener('submit', onJoin);
  $('#answer-form').addEventListener('submit', e => { e.preventDefault(); submitAnswer(); });
  wireAnswerInput();
  $('#btn-retry').addEventListener('click', () => startRun());
  $('#btn-home').addEventListener('click', () => show('home'));
  $('#btn-quit').addEventListener('click', quitRun);
  window.addEventListener('hashchange', () => location.reload());

  track = new RaceTrack($('#track'), { meId: 'me', total: LAP, big: true });
  track.onEvent = (type, p) => {
    if (p.id !== 'me') return;
    if (type === 'boost-s') { sfx.boost(); flashBoost('🔥 3연속! 부스터!'); }
    if (type === 'boost-l') { sfx.boostBig(); flashBoost(`⚡ ${p.combo}연속! 슈퍼 부스터!!`); }
  };

  await loadWordSet();
}

function renderSoundBtn() {
  $('#btn-sound').textContent = isSoundOn() ? '🔊' : '🔇';
  $('#btn-sound').setAttribute('aria-pressed', String(isSoundOn()));
}

// ---------------------------------------------------------------------
// 단어장: 링크 → 없으면 주제 선택
// ---------------------------------------------------------------------
async function loadWordSet() {
  const code = codeFromLocation();
  if (code) {
    try {
      const set = await decodeSet(code);
      S.set = { ...set, fromLink: true };
      $('#set-picker').classList.add('hidden');
      const b = $('#set-banner');
      b.classList.remove('hidden');
      b.innerHTML = `<span class="sb-label">📚 선생님 단어장</span><b>${esc(set.title)}</b><span class="sb-meta">단어 ${set.words.length}개 · ⏱️ ${fmtTime(set.seconds)}</span>`;
      $('#start-sub').textContent = `“${set.title}” 단어로 ${fmtTime(set.seconds)} 레이스!`;
      return;
    } catch (err) {
      const e = $('#link-error');
      e.classList.remove('hidden');
      e.textContent = String(err.message) === 'OLD_BROWSER'
        ? '이 브라우저는 선생님 단어장 링크를 열 수 없어요. 크롬·엣지·사파리 최신 버전으로 열어 주세요. (지금은 기본 단어장으로 할 수 있어요)'
        : '단어장 링크가 잘렸거나 잘못됐어요. 선생님께 링크를 다시 받아 주세요. (지금은 기본 단어장으로 할 수 있어요)';
    }
  }
  renderPresetChips();
}

function renderPresetChips() {
  const saved = lsGet(LS_PRESET);
  $('#preset-chips').innerHTML = WORD_PRESETS.map(p => `
    <button type="button" class="chip" role="radio" aria-checked="false" data-preset="${p.id}">${esc(p.name)} <small>${p.words.length}</small></button>`).join('');
  $('#preset-chips').addEventListener('click', e => {
    const b = e.target.closest('[data-preset]');
    if (b) { choosePreset(b.dataset.preset); sfx.click(); }
  });
  choosePreset(WORD_PRESETS.some(p => p.id === saved) ? saved : WORD_PRESETS[0].id);
}

function choosePreset(id) {
  const p = WORD_PRESETS.find(x => x.id === id);
  $$('#preset-chips .chip').forEach(c => {
    const on = c.dataset.preset === id;
    c.classList.toggle('on', on);
    c.setAttribute('aria-checked', String(on));
  });
  S.set = { title: p.name, seconds: DEFAULT_SECONDS, shuffle: true, words: p.words, fromLink: false };
  lsSet(LS_PRESET, id);
  $('#start-sub').textContent = `“${p.name}” 단어로 ${fmtTime(DEFAULT_SECONDS)} 레이스!`;
}

// ---------------------------------------------------------------------
// 이름 · 캐릭터
// ---------------------------------------------------------------------
function renderCharGrid() {
  $('#char-grid').innerHTML = CHARACTERS.map((c, i) => `
    <button type="button" class="char-card" role="radio" aria-checked="false" data-char="${c.id}" style="--c:${c.color}">
      <span class="char-num">${i + 1}</span>
      <span class="char-art">${charSVG(c.id)}</span>
      <span class="char-name">${c.name} <small lang="zh">${c.zh}</small></span>
      <span class="char-tag">${c.tagline}</span>
    </button>`).join('');
  $('#char-grid').addEventListener('click', e => {
    const b = e.target.closest('.char-card');
    if (b) { selectChar(b.dataset.char); sfx.click(); }
  });
  $('#screen-join').addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    const n = Number(e.key);
    if (n >= 1 && n <= 6) selectChar(CHARACTERS[n - 1].id);
  });
}
function selectChar(id) {
  $$('.char-card').forEach(b => {
    const on = b.dataset.char === id;
    b.classList.toggle('selected', on);
    b.setAttribute('aria-checked', String(on));
  });
  S.character = id;
}

function goJoin() {
  if (!S.set) return;
  $('#join-set').innerHTML = `📚 <b>${esc(S.set.title)}</b> · 단어 ${S.set.words.length}개 · ⏱️ ${fmtTime(S.set.seconds)}`;
  show('join');
  setTimeout(() => $('#join-name').focus(), 50);
}

function onJoin(e) {
  e.preventDefault();
  const name = $('#join-name').value.trim().replace(/\s+/g, ' ');
  if (!name) { $('#join-error').textContent = '이름 또는 별명을 입력해 주세요. 결과 카드에 나와요!'; $('#join-name').focus(); return; }
  $('#join-error').textContent = '';
  S.name = name;
  lsSet(LS_CHAR, S.character);
  startRun();
}

// ---------------------------------------------------------------------
// 달리기
// ---------------------------------------------------------------------
function makeSeq(n, shuffle, len) {
  const seq = [];
  while (seq.length < len) {
    const cyc = [...Array(n).keys()];
    if (shuffle) {
      for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cyc[i], cyc[j]] = [cyc[j], cyc[i]]; }
      if (n > 1 && seq.length && cyc[0] === seq[seq.length - 1]) cyc.push(cyc.shift());
    }
    seq.push(...cyc);
  }
  return seq;
}

function startRun() {
  const set = S.set;
  const key = setKey(set);
  const best = lsGet(LS_BEST + key);
  const run = {
    key, best,
    words: set.words,
    seq: makeSeq(set.words.length, set.shuffle, Math.max(200, set.seconds * 3)),
    limitMs: set.seconds * 1000,
    startAt: Date.now() + 3200,
    k: 0, correct: 0, wrong: 0, combo: 0, maxCombo: 0, lastT: -1000, lap: 0,
    times: [],                 // 정답 시각 (유령용)
    done: false, lastCount: null, ghostShown: -1,
    me: { id: 'me', name: S.name, character: S.character, joined_at: '0' },
  };
  S.run = run;
  $('#hud-mode').textContent = set.fromLink ? '선생님 단어장' : set.title;
  $('#q-reveal').innerHTML = '';
  $('#quiz-done').classList.add('hidden');
  $('#answer').value = '';
  show('game');
  track.reset();
  track.setTotal(LAP);
  updateTrack(true);
  renderHud();
  renderQuestion(true);
  lockInput(true);
  startTicker();
}

function lapPos(run) { return run.correct - run.lap * LAP; }

function ghostCorrect(run, t) {
  if (!run.best?.times) return 0;
  let n = 0;
  for (const x of run.best.times) { if (x <= t) n++; else break; }
  return n;
}

function playersFor(run, t) {
  const list = [{ ...run.me, correct: lapPos(run), wrong: run.wrong, combo: run.combo, finish_ms: null }];
  if (run.best) {
    const g = ghostCorrect(run, t);
    run.ghostShown = g;
    list.push({
      id: 'ghost', name: `👻 ${run.best.name || '최고 기록'}`, character: run.best.character || 'panda', joined_at: '1',
      correct: Math.max(0, Math.min(LAP, g - run.lap * LAP)), wrong: 0, combo: 0, finish_ms: null,
    });
  }
  return list;
}

function updateTrack(instant = false) {
  const run = S.run;
  const t = Math.max(0, Date.now() - run.startAt);
  const ps = playersFor(run, t);
  if (instant) ps.forEach(p => track.jump(p.id, p.correct));
  track.update(ps);
}

function renderHud() {
  const run = S.run;
  $('#hud-dist').textContent = fmtDist(run.correct);
  $('#hud-correct').textContent = run.correct;
  $('#hud-wrong').textContent = run.wrong;
  $('#hud-lap').textContent = run.lap + 1;
}

function currentWord(run) { return run.words[run.seq[run.k % run.seq.length]]; }

function renderQuestion(force = false) {
  const run = S.run;
  const w = currentWord(run);
  $('#q-num').textContent = run.k + 1;
  const qw = $('#q-word');
  if (force || qw.textContent !== w.ko) {
    qw.textContent = w.ko;
    qw.classList.remove('pop'); void qw.offsetWidth; qw.classList.add('pop');
  }
  const combo = $('#q-combo');
  combo.classList.toggle('hidden', run.combo < 2);
  combo.querySelector('b').textContent = run.combo;
  combo.classList.toggle('hot', run.combo >= 5);
}

function lockInput(locked) {
  if (S.run) S.run.locked = locked;
  $('#answer').disabled = locked;
  $('#btn-answer').disabled = locked;
  if (!locked) setTimeout(() => $('#answer').focus(), 0);
}

function startTicker() {
  stopTicker();
  const loop = () => { tick(); S.ticker = requestAnimationFrame(loop); };
  S.ticker = requestAnimationFrame(loop);
}
function stopTicker() {
  cancelAnimationFrame(S.ticker);
  S.ticker = 0;
  $('#countdown').classList.add('hidden');
}

let lastTimerText = '';
function tick() {
  const run = S.run;
  if (!run || run.done) return;
  const now = Date.now();
  const toStart = run.startAt - now;
  const cd = $('#countdown'), num = $('#countdown-num');
  if (toStart > 0) {
    const label = String(Math.min(3, Math.ceil(toStart / 1000)));
    if (run.lastCount !== label) {
      run.lastCount = label;
      cd.classList.remove('hidden');
      num.textContent = label;
      num.classList.remove('bump', 'go'); void cd.offsetWidth; num.classList.add('bump');
      sfx.count();
    }
  } else if (run.lastCount !== 'GO') {
    run.lastCount = 'GO';
    num.textContent = '出发!';
    num.classList.remove('bump'); void cd.offsetWidth; num.classList.add('bump', 'go');
    cd.classList.remove('hidden');
    sfx.go();
    setTimeout(() => { cd.classList.add('hidden'); num.classList.remove('go'); }, 800);
    lockInput(false);
  }

  const remain = Math.max(0, Math.min(run.limitMs, run.startAt + run.limitMs - Math.max(now, run.startAt)));
  const txt = fmtClock(remain);
  if (txt !== lastTimerText) {
    lastTimerText = txt;
    $('#hud-timer').textContent = txt;
    $('#hud-timer-box').classList.toggle('low', remain <= 15000 && remain > 0);
    if (remain <= 5000 && remain > 0) sfx.count();
  }
  $('#hud-timebar').style.transform = `scaleX(${(remain / run.limitMs).toFixed(4)})`;

  // 유령은 시간에 따라 움직임
  if (run.best && toStart <= 0 && ghostCorrect(run, now - run.startAt) !== run.ghostShown) updateTrack();

  if (toStart <= 0 && remain <= 0) finishRun();
}

// ---------- 입력 ----------
function wireAnswerInput() {
  const inp = $('#answer');
  inp.addEventListener('input', () => {
    inp.classList.remove('wrong', 'right');
    const h = hasHangul(inp.value);
    $('#ime-warn').classList.toggle('hidden', !h);
    $('#hint-text').classList.toggle('hidden', h);
  });
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.isComposing || e.keyCode === 229)) { e.preventDefault(); S.pendingSubmit = true; }
  });
  inp.addEventListener('compositionend', () => {
    if (S.pendingSubmit) { S.pendingSubmit = false; setTimeout(submitAnswer, 0); }
  });
}

function submitAnswer() {
  const run = S.run;
  if (!run || run.locked || run.done) return;
  const inp = $('#answer');
  const { text, converted } = prepareAnswer(inp.value);
  const norm = normalizePinyin(text);
  if (!norm) { shake(inp); return; }
  const t = Date.now() - run.startAt;
  if (t < 0 || t > run.limitMs) return;
  if (t - run.lastT < 200) return; // Enter 연타 방지
  run.lastT = t;
  if (converted && !S.imeHintShown) {
    S.imeHintShown = true;
    toast(`한글로 입력돼서 영어(${text})로 바꿔 채점했어요. 한/영 키를 눌러 주세요!`, 'info', 3500);
  }
  const w = currentWord(run);
  if (norm === normalizePinyin(w.py)) {
    run.k++; run.correct++; run.combo++; run.maxCombo = Math.max(run.maxCombo, run.combo);
    run.times.push(t);
    sfx.correct();
    inp.value = '';
    inp.classList.remove('wrong'); inp.classList.add('right');
    setTimeout(() => inp.classList.remove('right'), 350);
    $('#ime-warn').classList.add('hidden'); $('#hint-text').classList.remove('hidden');
    showReveal(w.zh, w.py);
    track.nudge('me', lapPos(run), run.combo);
    if (lapPos(run) >= LAP) {
      sfx.finish();
      flashBoost(`🏯 ${run.lap + 1}구간 돌파! ${fmtDist(run.correct)}`);
      setTimeout(() => {
        if (S.run !== run || run.done) return;
        run.lap = Math.floor(run.correct / LAP);
        updateTrack(true);
        renderHud();
      }, 650);
    }
  } else {
    run.wrong++; run.combo = 0;
    sfx.wrong();
    inp.classList.remove('right'); inp.classList.add('wrong');
    shake(inp);
    if (navigator.vibrate) navigator.vibrate(80);
    inp.select();
    updateTrack();
  }
  renderQuestion();
  renderHud();
}

function showReveal(zh, py) {
  const el = $('#q-reveal');
  el.innerHTML = `<span class="rv-ok">✔</span> <span class="rv-zh" lang="zh">${esc(zh || '')}</span> <span class="rv-py">${esc(py || '')}</span>`;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}
function shake(el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }

let boostTimer = 0;
function flashBoost(text) {
  const b = $('#boost-banner');
  b.textContent = text;
  b.classList.remove('hidden', 'show'); void b.offsetWidth; b.classList.add('show');
  clearTimeout(boostTimer);
  boostTimer = setTimeout(() => b.classList.add('hidden'), 1500);
}

function quitRun() {
  if (!S.run || S.run.done) return;
  if (!confirm('그만할까요? 이번 기록은 남지 않아요.')) return;
  S.run.done = true;
  stopTicker();
  show('home');
}

// ---------------------------------------------------------------------
// 끝 → 결과 카드
// ---------------------------------------------------------------------
function finishRun() {
  const run = S.run;
  if (!run || run.done) return;
  run.done = true;
  run.endedAt = new Date();
  stopTicker();
  lockInput(true);
  $('#quiz-done').innerHTML = '⏱️ <b>시간 종료!</b>';
  $('#quiz-done').classList.remove('hidden');
  sfx.finish();
  // 이 기기 최고 기록 갱신
  const prev = run.best;
  run.newBest = !prev || run.correct > prev.correct || (run.correct === prev.correct && run.wrong < (prev.wrong ?? 1e9));
  if (run.newBest && run.correct > 0) {
    lsSet(LS_BEST + run.key, {
      correct: run.correct, wrong: run.wrong, times: run.times, name: S.name, character: S.character, at: Date.now(),
    });
  }
  setTimeout(() => showResult(run), 900);
}

function showResult(run) {
  show('result');
  const acc = accuracy(run.correct, run.wrong);
  const d = run.endedAt;
  const when = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const prev = run.best;
  const bestLine = run.newBest && run.correct > 0
    ? `<div class="cert-best new">🎉 이 기기 최고 기록!${prev ? ` <small>(이전 ${fmtDist(prev.correct)})</small>` : ''}</div>`
    : prev ? `<div class="cert-best">👻 이 기기 최고 기록: ${fmtDist(prev.correct)} <small>(${esc(prev.name || '')})</small></div>` : '';
  $('#cert').innerHTML = `
    <div class="cert-head">
      <div class="cert-art">${charSVG(S.character)}</div>
      <div class="cert-who">
        <b>${esc(S.name)}</b>
        <span>📚 ${esc(S.set.title)} · ⏱️ ${fmtTime(S.set.seconds)}</span>
        <span>🗓️ ${when}</span>
      </div>
      <div class="cert-seal" lang="zh">完成</div>
    </div>
    <div class="cert-dist"><small>만리장성을 달린 거리</small><b>${fmtDist(run.correct)}</b></div>
    <div class="mr-stats">
      <div><small>정답</small><b>${run.correct}</b></div>
      <div><small>오답</small><b>${run.wrong}</b></div>
      <div><small>정확도</small><b>${acc.toFixed(1)}%</b></div>
      <div><small>최고 연속</small><b>${run.maxCombo}</b></div>
      <div><small>구간</small><b>${Math.floor(run.correct / LAP) + 1}</b></div>
    </div>
    ${bestLine}`;
  $('#review-list').innerHTML = S.set.words.map(w => `
    <div class="rv-card"><span class="rv-ko">${esc(w.ko)}</span><span class="rv-zh" lang="zh">${esc(w.zh || '')}</span><span class="rv-py">${esc(w.py)}</span></div>`).join('');
  S.stopFireworks?.();
  S.stopFireworks = startFireworks($('#fireworks'), { duration: run.newBest ? 6000 : 3500, intensity: run.newBest ? 1.5 : 0.8 });
  sfx.victory();
}

init();
