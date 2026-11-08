// =====================================================================
//  长城竞速 — 선생님용 단어장 링크 만들기 (서버 없음)
//  단어 → 링크(#w=...) + QR 코드. 이 컴퓨터에 단어장 저장(브라우저 저장소).
// =====================================================================
import { WORD_PRESETS, WORD_TEMPLATE_ROWS, parseWordText, wordsToText } from './words.js';
import { encodeSet, decodeSet, codeFromLocation } from './wordlink.js';
import { qrSVG } from './qr.js';
import { $, $$, esc, toast, openModal, closeModal, wireModals, downloadCSV } from './common.js';

const LS_SETS = 'ccjs-teacher-sets';
const MAX_QR_URL = 2300;
const M = { link: '', saved: [] };

const lsGet = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
const fmtTime = s => (s % 60 === 0 ? `${s / 60}분` : s > 60 ? `${Math.floor(s / 60)}분 ${s % 60}초` : `${s}초`);

function studentBase() {
  const base = location.href.replace(/[?#].*$/, '').replace(/teacher\.html$/, '');
  return `${base.endsWith('/') ? base : `${base}/`}index.html`;
}

// ---------------------------------------------------------------------
function init() {
  wireModals();
  M.saved = lsGet(LS_SETS) || [];
  renderLibrary();
  $('.wordlib').addEventListener('click', onLibraryClick);
  $('#words-text').addEventListener('input', onChange);
  $('#words-text').addEventListener('keydown', e => {
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      const ta = e.target;
      ta.setRangeText('\t', ta.selectionStart, ta.selectionEnd, 'end');
      onChange();
    }
  });
  $('#mk-title').addEventListener('input', onChange);
  $('#mk-time').addEventListener('change', onChange);
  $('#mk-shuffle').addEventListener('change', onChange);
  $('#words-file').addEventListener('change', importWordFile);
  $('#btn-template').addEventListener('click', () => downloadCSV('장성레이싱_단어장_양식.csv', WORD_TEMPLATE_ROWS));
  $('#btn-save-local').addEventListener('click', saveLocal);
  $('#mk-paste-link').addEventListener('change', e => loadFromLink(e.target.value));
  $('#mk-paste-link').addEventListener('paste', e => setTimeout(() => loadFromLink(e.target.value), 0));
  $('#btn-copy').addEventListener('click', copyLink);
  $('#btn-big').addEventListener('click', openBig);
  $('#btn-big-close').addEventListener('click', closeBig);
  $('#bigqr').addEventListener('click', e => { if (e.target.id === 'bigqr') closeBig(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeBig(); });
  $('#btn-preview').addEventListener('click', () => window.open(M.link, '_blank', 'noopener'));
  $('#btn-print').addEventListener('click', () => window.print());
  $('#mk-link').addEventListener('focus', e => e.target.select());

  // teacher.html#w=... 로 열면 그 단어장을 바로 편집
  const code = codeFromLocation();
  if (code) loadFromCode(code);
  else onChange();
}

// ---------------------------------------------------------------------
// 단어 목록 → 미리보기 → 링크/QR
// ---------------------------------------------------------------------
function currentSet() {
  const { words, errors } = parseWordText($('#words-text').value);
  return {
    set: {
      title: $('#mk-title').value.trim() || '선생님 단어장',
      seconds: parseInt($('#mk-time').value, 10) || 300,
      shuffle: $('#mk-shuffle').checked,
      words,
    },
    errors,
  };
}

let timer = 0;
function onChange() {
  const { set, errors } = currentSet();
  $('#words-count').textContent = `(${set.words.length}개)`;
  $('#words-preview').innerHTML = `
    <thead><tr><th>#</th><th>한국어 뜻</th><th>중국어</th><th>병음</th></tr></thead>
    <tbody>${set.words.map((w, i) => `<tr><td>${i + 1}</td><td>${esc(w.ko)}</td><td lang="zh">${esc(w.zh)}</td><td>${esc(w.py)}</td></tr>`).join('')}</tbody>`;
  $('#words-errors').innerHTML = errors.map(e => `<li>${esc(e)}</li>`).join('');
  $('#words-msg').textContent = set.words.length && set.words.length < 8
    ? `💡 단어가 ${set.words.length}개뿐이라 같은 단어가 자주 반복돼요. 10개 이상을 추천해요.` : '';
  clearTimeout(timer);
  timer = setTimeout(() => makeLink(set), 250);
}

async function makeLink(set) {
  const ready = set.words.length > 0;
  $('#mk-empty').classList.toggle('hidden', ready);
  $('#mk-ready').classList.toggle('hidden', !ready);
  $$('#mk-actions button').forEach(b => { b.disabled = !ready; });
  if (!ready) { M.link = ''; return; }
  const code = await encodeSet(set);
  M.link = `${studentBase()}#w=${code}`;
  M.set = set;
  $('#mk-link').value = M.link;
  $('#mk-time-label').textContent = fmtTime(set.seconds);
  if (M.link.length <= MAX_QR_URL) {
    $('#mk-qr').innerHTML = qrSVG(M.link, { size: 320 });
    $('#mk-qr-note').textContent = set.words.length > 60 ? '💡 단어가 많아 QR 코드가 촘촘해요. 멀리서 찍기 어려우면 링크로 나눠 주세요.' : '';
    $('#btn-big').disabled = false;
  } else {
    $('#mk-qr').innerHTML = '<div class="qr-too-long">단어가 너무 많아<br>QR 코드를 만들 수 없어요.<br><small>링크로 나눠 주거나<br>단어장을 나눠 주세요.</small></div>';
    $('#mk-qr-note').textContent = '';
    $('#btn-big').disabled = true;
  }
}

async function copyLink() {
  try { await navigator.clipboard.writeText(M.link); toast('학생용 링크를 복사했어요! 클래스룸·메신저에 붙여넣으세요.', 'ok'); }
  catch { $('#mk-link').focus(); $('#mk-link').select(); toast('링크 칸이 선택됐어요. Ctrl+C로 복사하세요.', 'info'); }
}

function openBig() {
  if (!M.link) return;
  $('#bq-name').textContent = M.set.title;
  $('#bq-time').textContent = fmtTime(M.set.seconds);
  $('#bq-qr').innerHTML = qrSVG(M.link, { size: 600 });
  $('#bigqr').classList.remove('hidden');
  document.documentElement.requestFullscreen?.().catch(() => {});
}
function closeBig() {
  if ($('#bigqr').classList.contains('hidden')) return;
  $('#bigqr').classList.add('hidden');
  if (document.fullscreenElement) document.exitFullscreen?.();
}

// ---------------------------------------------------------------------
// 보관함 (기본 주제 + 이 컴퓨터에 저장한 단어장)
// ---------------------------------------------------------------------
function renderLibrary() {
  const item = (attrs, name, meta, del = '') => `<li><button type="button" class="lib-item" ${attrs}><span>${esc(name)}</span><small>${meta}</small></button>${del}</li>`;
  $('#lib-presets').innerHTML = WORD_PRESETS.map(p => item(`data-preset="${p.id}"`, p.name, `${p.words.length}개`)).join('');
  $('#lib-mine').innerHTML = M.saved.map((w, i) => item(`data-saved="${i}"`, w.title, `${w.words.length}개`,
    `<button type="button" class="lib-del" data-del="${i}" title="삭제" aria-label="${esc(w.title)} 삭제">✕</button>`)).join('')
    || '<li class="help">아직 없어요. 💾 이 컴퓨터에 저장을 눌러 보세요.</li>';
}

async function onLibraryClick(e) {
  const del = e.target.closest('[data-del]');
  if (del) {
    const w = M.saved[Number(del.dataset.del)];
    if (!w || !confirm(`“${w.title}” 단어장을 지울까요?`)) return;
    M.saved.splice(Number(del.dataset.del), 1);
    lsSet(LS_SETS, M.saved);
    renderLibrary();
    return;
  }
  const b = e.target.closest('.lib-item');
  if (!b) return;
  const set = b.dataset.preset
    ? (p => ({ title: p.name, words: p.words }))(WORD_PRESETS.find(x => x.id === b.dataset.preset))
    : M.saved[Number(b.dataset.saved)];
  if (set) await applySet(set, true);
}

async function applySet(set, ask) {
  const cur = $('#words-text').value.trim();
  let mode = 'replace';
  if (cur && ask) {
    mode = await askLoadMode(`“${set.title}” (${set.words.length}개)를 불러올게요. 지금 입력된 단어는 어떻게 할까요?`);
    if (!mode) return;
  }
  $('#words-text').value = mode === 'append' ? `${cur}\n${wordsToText(set.words)}` : wordsToText(set.words);
  if (mode === 'replace' || !$('#mk-title').value.trim()) $('#mk-title').value = set.title || '';
  if (set.seconds) $('#mk-time').value = String(set.seconds);
  if (typeof set.shuffle === 'boolean') $('#mk-shuffle').checked = set.shuffle;
  onChange();
  toast(`“${set.title}”를 불러왔어요. 고친 내용은 링크에 바로 반영돼요.`, 'ok');
}

function saveLocal() {
  const { set } = currentSet();
  if (!set.words.length) { toast('저장할 단어가 없어요.', 'bad'); return; }
  const i = M.saved.findIndex(s => s.title === set.title);
  if (i >= 0 && !confirm(`“${set.title}” 단어장이 이미 있어요. 덮어쓸까요?`)) return;
  if (i >= 0) M.saved[i] = set; else M.saved.unshift(set);
  if (!lsSet(LS_SETS, M.saved)) { toast('저장하지 못했어요. (브라우저 저장 공간을 확인해 주세요)', 'bad'); return; }
  renderLibrary();
  toast('이 컴퓨터에 저장했어요. 다른 컴퓨터에서는 학생용 링크를 붙여넣어 고칠 수 있어요.', 'ok', 3500);
}

async function loadFromLink(text) {
  const m = /[#&]w=([A-Za-z0-9_-]+)/.exec(String(text || ''));
  if (!m) { if (String(text).trim()) toast('단어장 링크가 아니에요. 학생용 링크 전체를 붙여넣어 주세요.', 'bad'); return; }
  $('#mk-paste-link').value = '';
  await loadFromCode(m[1]);
}

async function loadFromCode(code) {
  try {
    const set = await decodeSet(code);
    await applySet(set, !!$('#words-text').value.trim());
  } catch {
    toast('링크에서 단어장을 읽지 못했어요. 링크가 잘리지 않았는지 확인해 주세요.', 'bad', 4000);
    onChange();
  }
}

async function importWordFile(e) {
  const f = e.target.files?.[0];
  e.target.value = '';
  if (!f) return;
  if (/\.xlsx?$/i.test(f.name)) {
    toast('엑셀 파일(.xlsx)은 바로 못 읽어요. 엑셀에서 칸을 복사해 붙여넣거나 “CSV UTF-8”로 저장해 주세요.', 'bad', 5000);
    return;
  }
  const buf = await f.arrayBuffer();
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); }
  catch { text = new TextDecoder('euc-kr').decode(buf); } // 한글 윈도우 엑셀 기본 CSV
  const { words } = parseWordText(text.replace(/^﻿/, ''));
  if (!words.length) { toast('파일에서 단어를 찾지 못했어요. 양식을 확인해 주세요.', 'bad'); return; }
  await applySet({ title: $('#mk-title').value.trim() || f.name.replace(/\.[^.]+$/, ''), words }, true);
}

function askLoadMode(text) {
  return new Promise(resolve => {
    $('#load-text').textContent = text;
    const modal = $('#modal-load');
    let settled = false;
    const finish = v => { if (settled) return; settled = true; modal.removeEventListener('click', onClick); obs.disconnect(); closeModal('modal-load'); resolve(v); };
    const onClick = e => { const b = e.target.closest('[data-load]'); if (b) finish(b.dataset.load); };
    const obs = new MutationObserver(() => { if (!modal.classList.contains('open')) finish(null); });
    modal.addEventListener('click', onClick);
    openModal('modal-load');
    obs.observe(modal, { attributes: true, attributeFilter: ['class'] });
  });
}

init();
