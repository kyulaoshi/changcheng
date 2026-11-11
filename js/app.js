// =====================================================================
//  长城竞速 — 학생용 게임 (서버 없음 · 각자 기기에서 플레이)
//  흐름: 시작(단원·연습 방식 선택) → 이름·캐릭터 → 3·2·1 → 제한 시간 동안 최대한 멀리 → 결과 카드
//  · 단원별 단어: js/units.js
//  · 연습 방식: ① 병음 따라 치기 ② 뜻 보고 병음+성조 ③ 뜻 보고 병음(성조 제외)
//  · 이 기기의 최고 기록이 '유령'으로 옆 레인에서 함께 달림 (브라우저에만 저장)
// =====================================================================
import { EndlessTrack, fmtMeters } from './endless.js';
import { CHARACTERS, CHAR_BY_ID, charSVG } from './characters.js';
import { UNITS, MODES } from './units.js';
import { normalizePinyin, prepareAnswer, hasHangul, numbersToMarks, gradeAnswer } from './pinyin.js';
import { sfx, setSound, isSoundOn, unlockAudioOnFirstGesture } from './sound.js';
import { $, $$, esc, fmtClock, accuracy, toast, openModal, wireModals, startFireworks } from './common.js';

const METER_PER_WORD = 100;
const DEFAULT_SECONDS = 300;   // 기본 제한 시간 5분
const LS_CHAR = 'ccjs-character';
const LS_UNIT = 'ccjs-unit';
const LS_MODE = 'ccjs-mode';
const LS_BEST = 'ccjs-best2-';  // + 단원·방식·단어 열쇠
const ALL_ID = 'all';

const S = {
  set: null,          // { title, seconds, shuffle, tones, mode, words }
  unitId: null,
  modeId: 'plain',
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
const fmtDist = n => fmtMeters(n * METER_PER_WORD);   // 정답 수 → '2,300m'
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

  track = new EndlessTrack($('#track'));
  renderPicker();
}

function renderSoundBtn() {
  $('#btn-sound').textContent = isSoundOn() ? '🔊' : '🔇';
  $('#btn-sound').setAttribute('aria-pressed', String(isSoundOn()));
}

// ---------------------------------------------------------------------
// 단원 · 연습 방식 선택
// ---------------------------------------------------------------------
const MODE_BY_ID = Object.fromEntries(MODES.map(m => [m.id, m]));
const unitLabel = u => (u.id === ALL_ID ? '전체 단원' : `${u.no}단원 ${u.title}`);
function getUnit(id) {
  if (id === ALL_ID) return { id: ALL_ID, no: '', title: '전체 단원', words: UNITS.flatMap(u => u.words) };
  return UNITS.find(u => u.id === id);
}

function renderPicker() {
  $('#unit-chips').innerHTML = UNITS.map(u => `
    <button type="button" class="chip" role="radio" aria-checked="false" data-unit="${u.id}"><b>${esc(u.no)}단원</b> <span${/[\u4e00-\u9fff]/.test(u.title) ? ' lang="zh"' : ''}>${esc(u.title)}</span> <small>${u.words.length}</small></button>`).join('')
    + `<button type="button" class="chip chip-all" role="radio" aria-checked="false" data-unit="${ALL_ID}">🌏 전체 단원 <small>${UNITS.reduce((n, u) => n + u.words.length, 0)}</small></button>`;
  $('#unit-chips').addEventListener('click', e => {
    const b = e.target.closest('[data-unit]');
    if (b) { S.unitId = b.dataset.unit; sfx.click(); applyChoice(); }
  });
  $('#mode-cards').innerHTML = MODES.map((m, i) => `
    <button type="button" class="mode-card" role="radio" aria-checked="false" data-mode="${m.id}">
      <span class="mc-ico">${m.icon}</span>
      <span class="mc-txt"><b><i>${i + 1}</i> ${esc(m.name)}</b><small>${esc(m.desc)}</small></span>
    </button>`).join('');
  $('#mode-cards').addEventListener('click', e => {
    const b = e.target.closest('[data-mode]');
    if (b) { S.modeId = b.dataset.mode; sfx.click(); applyChoice(); }
  });
  const su = lsGet(LS_UNIT), sm = lsGet(LS_MODE);
  S.unitId = getUnit(su) ? su : UNITS[0].id;
  S.modeId = MODE_BY_ID[sm] ? sm : 'plain';
  applyChoice();
}

function applyChoice() {
  const u = getUnit(S.unitId), m = MODE_BY_ID[S.modeId];
  $$('#unit-chips .chip').forEach(c => { const on = c.dataset.unit === u.id; c.classList.toggle('on', on); c.setAttribute('aria-checked', String(on)); });
  $$('#mode-cards .mode-card').forEach(c => { const on = c.dataset.mode === m.id; c.classList.toggle('on', on); c.setAttribute('aria-checked', String(on)); });
  S.set = { title: unitLabel(u), unitId: u.id, seconds: DEFAULT_SECONDS, shuffle: true, tones: m.tones, mode: m.id, modeName: m.name, modeIcon: m.icon, words: u.words };
  lsSet(LS_UNIT, u.id); lsSet(LS_MODE, m.id);
  $('#start-sub').textContent = `${unitLabel(u)} · ${m.name} · ${fmtTime(DEFAULT_SECONDS)}`;
}

/** 기록 저장용 열쇠 (같은 단원·같은 방식·같은 단어 = 같은 열쇠) */
function setKey(set) {
  const s = [set.unitId, set.mode, set.seconds, ...set.words.map(w => `${w.ko}|${w.py}`)].join('\n');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return `${set.unitId}-${set.mode}-${(h >>> 0).toString(36)}`;
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
  $('#join-set').innerHTML = `📚 <b>${esc(S.set.title)}</b> · 단어 ${S.set.words.length}개 · ⏱️ ${fmtTime(S.set.seconds)}<br>${S.set.modeIcon} <b>${esc(S.set.modeName)}</b>${S.set.tones ? ' · 성조까지 채점' : ' · 성조 채점 안 함'}`;
  $('#join-tip').innerHTML = S.set.tones
    ? '💡 한/영 키를 <b>영어</b>로! 성조는 숫자로 쳐요: <b>jia1ren2</b> → jiārén'
    : '💡 한/영 키를 <b>영어</b>로! 성조 없이 <b>pingguo</b>처럼 쳐요.';
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
    k: 0, correct: 0, wrong: 0, combo: 0, maxCombo: 0, lastT: -1000,
    times: [],                 // 정답 시각 (유령용)
    done: false, lastCount: null, ghostShown: 0,
    me: { id: 'me', name: S.name, character: S.character, joined_at: '0' },
  };
  S.run = run;
  $('#hud-mode').textContent = `${set.title} · ${set.modeName}`;
  $('#quiz').dataset.mode = set.mode;
  $('#hint-text').innerHTML = set.mode === 'copy'
    ? '⌨️ 보이는 병음을 <b>성조까지</b> 따라 쳐요 · 성조는 숫자로: <kbd>jia1ren2</kbd> → jiārén · <kbd>Enter</kbd>로 제출'
    : set.tones
      ? '🎵 <b>성조까지 채점!</b> 숫자로 입력하면 기호로 바뀌어요: <kbd>jia1ren2</kbd> → jiārén · <kbd>Enter</kbd>로 제출'
      : '성조는 채점하지 않아요 · 병음만 영어로 · 띄어쓰기 상관없음 · <kbd>Enter</kbd>로 제출';
  $('#answer').placeholder = set.tones ? '병음 + 성조 숫자 (예: jia1ren2)' : '중국어 병음을 입력하세요 (성조 없이)';
  $('#tone-tip').classList.add('hidden');
  $('#q-reveal').innerHTML = '';
  $('#quiz-done').classList.add('hidden');
  $('#answer').value = '';
  show('game');
  const lanes = [{ id: 'me', name: S.name, character: S.character }];
  if (best) lanes.push({ id: 'ghost', ghost: true, name: `👻 ${best.name || '최고 기록'}`, character: best.character || 'panda' });
  track.setPlayers(lanes);
  track.reset();
  renderHud();
  renderQuestion(true);
  lockInput(true);
  startTicker();
}

function ghostCorrect(run, t) {
  if (!run.best?.times) return 0;
  let n = 0;
  for (const x of run.best.times) { if (x <= t) n++; else break; }
  return n;
}

function renderHud() {
  const run = S.run;
  $('#hud-dist').textContent = fmtDist(run.correct);
  $('#hud-correct').textContent = run.correct;
  $('#hud-wrong').textContent = run.wrong;
  $('#hud-best').textContent = run.best ? fmtDist(run.best.correct) : '—';
}

function currentWord(run) { return run.words[run.seq[run.k % run.seq.length]]; }

function renderQuestion(force = false) {
  const run = S.run;
  const w = currentWord(run);
  $('#q-num').textContent = run.k + 1;
  const qw = $('#q-word');
  const copy = S.set.mode === 'copy';
  const main = copy ? w.py : w.ko;
  if (force || qw.textContent !== main || qw.dataset.k !== String(run.k)) {
    qw.textContent = main;
    qw.dataset.k = String(run.k);
    qw.classList.toggle('is-py', copy);
    qw.classList.remove('pop'); void qw.offsetWidth; qw.classList.add('pop');
    const sub = $('#q-sub');
    sub.classList.toggle('hidden', !copy);
    sub.innerHTML = copy ? `<span lang="zh">${esc(w.zh || '')}</span> <span>${esc(w.ko)}</span>` : '';
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
  if (run.best && toStart <= 0) {
    const g = ghostCorrect(run, now - run.startAt);
    if (g !== run.ghostShown) { run.ghostShown = g; track.setMeters('ghost', g * METER_PER_WORD); }
  }

  if (toStart <= 0 && remain <= 0) finishRun();
}

// ---------- 입력 ----------
function wireAnswerInput() {
  const inp = $('#answer');
  inp.addEventListener('input', e => {
    inp.classList.remove('wrong', 'right');
    if (!$('#tone-tip').classList.contains('hidden')) { $('#tone-tip').classList.add('hidden'); $('#hint-text').classList.remove('hidden'); }
    // 숫자 성조 → 기호: jia1ren2 → jiārén (한글 조합 중에는 건드리지 않음)
    if (!e.isComposing && /[A-Za-zÜüVv][0-5]/.test(inp.value)) {
      const pos = inp.selectionStart ?? inp.value.length;
      const before = numbersToMarks(inp.value.slice(0, pos));
      const after = numbersToMarks(inp.value.slice(pos));
      if (before + after !== inp.value) {
        inp.value = before + after;
        inp.setSelectionRange(before.length, before.length);
      }
    }
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
  let w = currentWord(run);
  let grade = gradeAnswer(text, w.py, !!S.set.tones);
  // 뜻이 같은 단어가 여럿이면(예: 미안합니다 → duìbuqǐ / bù hǎoyìsi) 어느 것이든 정답
  if (grade !== 'correct' && S.set.mode !== 'copy') {
    for (const o of S.set.words) {
      if (o === w || o.ko !== w.ko) continue;
      const g = gradeAnswer(text, o.py, !!S.set.tones);
      if (g === 'correct') { grade = g; w = o; break; }
      if (g === 'tone') grade = 'tone';
    }
  }
  if (grade === 'correct') {
    run.k++; run.correct++; run.combo++; run.maxCombo = Math.max(run.maxCombo, run.combo);
    run.times.push(t);
    sfx.correct();
    inp.value = '';
    inp.classList.remove('wrong'); inp.classList.add('right');
    setTimeout(() => inp.classList.remove('right'), 350);
    $('#ime-warn').classList.add('hidden'); $('#hint-text').classList.remove('hidden'); $('#tone-tip').classList.add('hidden');
    showReveal(w.zh, w.py);
    track.setMeters('me', run.correct * METER_PER_WORD);
    if (run.combo >= 5 && run.combo % 5 === 0) { track.boost('me', 'boost-l'); sfx.boostBig(); flashBoost(`⚡ ${run.combo}연속! 슈퍼 부스터!!`); }
    else if (run.combo === 3) { track.boost('me', 'boost-s'); sfx.boost(); flashBoost('🔥 3연속! 부스터!'); }
    else if (run.correct % 10 === 0) { sfx.finish(); flashBoost(`🏯 ${fmtDist(run.correct)} 돌파!`); }
  } else {
    run.wrong++; run.combo = 0;
    sfx.wrong();
    inp.classList.remove('right'); inp.classList.add('wrong');
    shake(inp);
    if (navigator.vibrate) navigator.vibrate(80);
    // 철자는 맞고 성조만 틀렸을 때 알려 줌
    $('#tone-tip').classList.toggle('hidden', grade !== 'tone');
    $('#hint-text').classList.toggle('hidden', grade === 'tone');
    if (grade === 'tone') inp.value = numbersToMarks(text);
    inp.select();
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
        <span>${S.set.modeIcon} ${esc(S.set.modeName)}</span>
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
      <div><small>총 입력</small><b>${run.correct + run.wrong}</b></div>
    </div>
    ${bestLine}`;
  $('#review-list').innerHTML = S.set.words.map(w => `
    <div class="rv-card"><span class="rv-ko">${esc(w.ko)}</span><span class="rv-zh" lang="zh">${esc(w.zh || '')}</span><span class="rv-py">${esc(w.py)}</span></div>`).join('');
  S.stopFireworks?.();
  S.stopFireworks = startFireworks($('#fireworks'), { duration: run.newBest ? 6000 : 3500, intensity: run.newBest ? 1.5 : 0.8 });
  sfx.victory();
}

init();
