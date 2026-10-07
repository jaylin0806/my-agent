'use strict';

const $ = (s) => document.querySelector(s);
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

const state = {
  bank: null,       // 目前題庫的 JSON
  view: 'year',     // year | topic | shuffle
  expandAll: false,
  order: new Map(), // 隨機模式下每題的排序值
  progress: {},     // { 題目id: { k: 'B', ok: true, t: 時間 } }
};

// ---------- 小工具 ----------

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// 支援 **粗體** 與換行，其餘一律跳脫
function fmt(s) {
  return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
}

function answersOf(q) {
  return Array.isArray(q.answer) ? q.answer : [q.answer];
}

function yearLabel(y) {
  return (state.bank.yearPrefix || '') + y + '年';
}

async function loadJSON(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${url}（HTTP ${res.status}）`);
  return res.json();
}

// ---------- 作答進度（存在瀏覽器 localStorage） ----------

function progressKey() {
  return 'quiz:' + state.bank.id;
}

function loadProgress() {
  try {
    state.progress = JSON.parse(localStorage.getItem(progressKey())) || {};
  } catch {
    state.progress = {};
  }
}

function saveProgress() {
  try {
    localStorage.setItem(progressKey(), JSON.stringify(state.progress));
  } catch {
    // 無痕模式等情況下無法儲存，作答仍可進行
  }
}

// ---------- 初始化 ----------

async function init() {
  bindControls();
  try {
    const cfg = await loadJSON('data/banks.json');
    document.title = cfg.title || document.title;
    $('#title').textContent = cfg.title || '';
    $('#subtitle').textContent = cfg.subtitle || '';

    const sel = $('#bank');
    cfg.banks.forEach((b) => sel.add(new Option(b.name, b.id)));
    sel.hidden = cfg.banks.length < 2;

    const wanted = new URLSearchParams(location.search).get('bank');
    sel.value = cfg.banks.some((b) => b.id === wanted) ? wanted : cfg.banks[0].id;
    sel.onchange = () => {
      const url = new URL(location.href);
      url.searchParams.set('bank', sel.value);
      history.replaceState(null, '', url);
      loadBank(cfg.banks.find((b) => b.id === sel.value));
    };
    await loadBank(cfg.banks.find((b) => b.id === sel.value));
  } catch (err) {
    showError(err);
  }
}

async function loadBank(meta) {
  $('#list').innerHTML = '<div class="msg">載入中…</div>';
  try {
    const bank = await loadJSON('data/' + meta.file);
    bank.id = bank.id || meta.id;
    bank.topics = bank.topics || [...new Set(bank.questions.map((q) => q.topic))];
    state.bank = bank;
    state.order.clear();
    loadProgress();
    fillFilters();
    render();
  } catch (err) {
    showError(err);
  }
}

function showError(err) {
  const local = location.protocol === 'file:'
    ? '<br>直接雙擊 HTML 檔無法讀取題庫資料，請用本機伺服器開啟（見 README）。'
    : '';
  $('#list').innerHTML = `<div class="msg err">題庫載入失敗：${esc(err.message)}${local}</div>`;
}

function fillFilters() {
  const qs = state.bank.questions;
  const fYear = $('#fYear');
  const fTopic = $('#fTopic');
  fYear.length = 1;
  fTopic.length = 1;
  [...new Set(qs.map((q) => q.year))].sort((a, b) => a - b)
    .forEach((y) => fYear.add(new Option(yearLabel(y), y)));
  state.bank.topics
    .filter((t) => qs.some((q) => q.topic === t))
    .forEach((t) => fTopic.add(new Option(t, t)));
}

function bindControls() {
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.onclick = () => {
      document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x === tab));
      state.view = tab.dataset.view;
      if (state.view === 'shuffle') state.order.clear(); // 每次點「隨機」都重新洗牌
      render();
    };
  });
  ['#fYear', '#fTopic', '#fStatus'].forEach((s) => { $(s).onchange = render; });
  $('#fKw').oninput = render;

  $('#expandBtn').onclick = function () {
    state.expandAll = !state.expandAll;
    this.textContent = state.expandAll ? '全部收合詳解' : '全部展開詳解';
    document.querySelectorAll('.ans').forEach((a) => { a.hidden = !state.expandAll; });
    document.querySelectorAll('.toggle').forEach((b) => { b.textContent = toggleText(!state.expandAll); });
  };

  $('#resetBtn').onclick = () => {
    if (!state.bank) return;
    if (!confirm(`確定要清除「${state.bank.name}」的所有作答紀錄嗎？此動作無法復原。`)) return;
    state.progress = {};
    saveProgress();
    render();
  };

  $('#list').addEventListener('click', onListClick);
}

// ---------- 篩選與排序 ----------

function filtered() {
  const y = $('#fYear').value;
  const t = $('#fTopic').value;
  const st = $('#fStatus').value;
  const kw = $('#fKw').value.trim().toLowerCase();
  return state.bank.questions.filter((q) => {
    if (y && String(q.year) !== y) return false;
    if (t && q.topic !== t) return false;
    const p = state.progress[q.id];
    if (st === 'todo' && p) return false;
    if (st === 'wrong' && !(p && !p.ok)) return false;
    if (st === 'right' && !(p && p.ok)) return false;
    if (kw) {
      const text = (q.stem + ' ' + Object.values(q.options).join(' ')).toLowerCase();
      if (!text.includes(kw)) return false;
    }
    return true;
  });
}

function byYearNo(a, b) {
  return a.year - b.year || (a.no || 0) - (b.no || 0);
}

function groups(qs) {
  if (state.view === 'shuffle') {
    qs.forEach((q) => { if (!state.order.has(q.id)) state.order.set(q.id, Math.random()); });
    return [{ title: '隨機順序', items: [...qs].sort((a, b) => state.order.get(a.id) - state.order.get(b.id)) }];
  }
  if (state.view === 'topic') {
    return state.bank.topics
      .map((t) => ({ title: t, items: qs.filter((q) => q.topic === t).sort(byYearNo) }))
      .filter((g) => g.items.length);
  }
  return [...new Set(qs.map((q) => q.year))].sort((a, b) => a - b)
    .map((y) => ({ title: yearLabel(y), items: qs.filter((q) => q.year === y).sort(byYearNo) }));
}

// ---------- 畫面 ----------

function toggleText(closed) {
  return closed ? '看答案＋詳解 ▾' : '收合 ▴';
}

function explanationHtml(q) {
  const ex = q.explanation;
  if (!ex) return '<div class="pending">詳解撰寫中…</div>';
  const right = answersOf(q);
  let h = '';
  if (ex.quick) h += `<div class="box quick"><b>⚡ 快速解答：</b>${fmt(ex.quick)}</div>`;
  if (ex.background) h += `<div class="box bg"><h4>📖 背景知識</h4>${fmt(ex.background)}</div>`;
  if (ex.options && Object.keys(ex.options).length) {
    h += '<div class="box opts"><h4>🔍 逐選項解析</h4>';
    LETTERS.filter((k) => ex.options[k]).forEach((k) => {
      h += `<div class="oa${right.includes(k) ? ' correct' : ''}"><b>(${k})</b> ${fmt(ex.options[k])}</div>`;
    });
    h += '</div>';
  }
  if (ex.sources && ex.sources.length) {
    h += `<div class="sources">📚 參考來源：${ex.sources.map(esc).join('；')}</div>`;
  }
  return h;
}

function card(q) {
  const chips = [`<span class="chip year">${esc(yearLabel(q.year))}${q.exam ? ' ' + esc(q.exam) : ''}</span>`];
  if (q.topic) chips.push(`<span class="chip">${esc(q.topic)}</span>`);
  if (q.void) chips.push('<span class="chip void">送分</span>');

  const opts = LETTERS.filter((k) => q.options[k] !== undefined)
    .map((k) => `<button class="opt" data-k="${k}"><b>(${k})</b>${fmt(q.options[k])}</button>`)
    .join('');
  const img = q.image
    ? `<div class="figwrap"><img class="fig" loading="lazy" src="${esc(q.image)}" alt="第 ${esc(q.no)} 題附圖"></div>`
    : '';
  const ansText = q.void ? '本題送分' : '答案：' + answersOf(q).join('、');

  return `<article class="q" data-id="${esc(q.id)}">
    <div class="chips">${chips.join('')}</div>
    <div class="stem">${q.no ? `<span class="n">${esc(q.no)}.</span>` : ''}${fmt(q.stem)}</div>
    ${img}${opts}
    <div class="result" hidden></div>
    <div class="actions">
      <button class="btn toggle">${toggleText(!state.expandAll)}</button>
      <button class="btn redo" hidden>重做這題</button>
    </div>
    <div class="ans"${state.expandAll ? '' : ' hidden'}>
      <div class="ansline">${ansText}</div>
      ${explanationHtml(q)}
    </div>
  </article>`;
}

// 依作答紀錄把題目卡片塗上對錯顏色
function paint(el, q) {
  const p = state.progress[q.id];
  const right = answersOf(q);
  const result = el.querySelector('.result');
  el.classList.toggle('done', !!p);
  el.querySelector('.redo').hidden = !p;
  el.querySelectorAll('.opt').forEach((o) => {
    const k = o.dataset.k;
    o.classList.toggle('right', !!p && (q.void || right.includes(k)));
    o.classList.toggle('pick', !!p && p.k === k);
    o.classList.toggle('wrong', !!p && p.k === k && !p.ok);
  });
  result.hidden = !p;
  if (p) {
    result.className = 'result ' + (p.ok ? 'ok' : 'bad');
    result.textContent = p.ok
      ? (q.void ? '✓ 本題送分' : '✓ 正確！')
      : '✗ 錯誤，正確答案：' + right.join('、');
  }
}

function render() {
  if (!state.bank) return;
  const qs = filtered();
  $('#count').textContent = `共 ${qs.length} 題`;
  const html = groups(qs)
    .map((g) => `<h2 class="grp">${esc(g.title)}（${g.items.length} 題）</h2>` + g.items.map(card).join(''))
    .join('');
  $('#list').innerHTML = html || '<div class="msg">沒有符合條件的題目</div>';
  const byId = new Map(state.bank.questions.map((q) => [q.id, q]));
  document.querySelectorAll('.q').forEach((el) => paint(el, byId.get(el.dataset.id)));
  updateStats();
}

function updateStats() {
  const total = state.bank.questions.length;
  const done = state.bank.questions.filter((q) => state.progress[q.id]);
  const ok = done.filter((q) => state.progress[q.id].ok).length;
  const rate = done.length ? Math.round((ok / done.length) * 100) : 0;
  $('#stats').innerHTML = done.length
    ? `已作答 <b>${done.length}</b> / ${total} 題 ・ 答對 <b>${ok}</b> ・ 答錯 <b>${done.length - ok}</b> ・ 答對率 <b>${rate}%</b>`
      + `<div class="meter"><i style="width:${rate}%"></i></div>`
    : '點選選項即可作答，進度會自動保存在這台裝置的瀏覽器中';
}

function onListClick(e) {
  const el = e.target.closest('.q');
  if (!el) return;
  const q = state.bank.questions.find((x) => x.id === el.dataset.id);
  const opt = e.target.closest('.opt');

  if (opt && !state.progress[q.id]) {
    const k = opt.dataset.k;
    state.progress[q.id] = { k, ok: !!q.void || answersOf(q).includes(k), t: Date.now() };
    saveProgress();
    paint(el, q);
    const ans = el.querySelector('.ans');
    ans.hidden = false;
    el.querySelector('.toggle').textContent = toggleText(false);
    updateStats();
  } else if (e.target.closest('.toggle')) {
    const ans = el.querySelector('.ans');
    ans.hidden = !ans.hidden;
    e.target.closest('.toggle').textContent = toggleText(ans.hidden);
  } else if (e.target.closest('.redo')) {
    delete state.progress[q.id];
    saveProgress();
    paint(el, q);
    el.querySelector('.ans').hidden = !state.expandAll;
    el.querySelector('.toggle').textContent = toggleText(!state.expandAll);
    updateStats();
  } else if (e.target.matches('img.fig')) {
    e.target.classList.toggle('big');
  }
}

// ---------- 嵌入其他網站時，自動回報高度給外層頁面 ----------

if (window.parent !== window && 'ResizeObserver' in window) {
  let last = 0;
  new ResizeObserver(() => {
    const h = document.documentElement.scrollHeight;
    if (h !== last) {
      last = h;
      window.parent.postMessage({ type: 'quiz-height', height: h }, '*');
    }
  }).observe(document.body);
}

init();
