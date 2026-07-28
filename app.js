const $ = (id) => document.getElementById(id);
const pick = (items) => items[Math.floor(Math.random() * items.length)];

const START_LIVES = 3;
const LEVELS = [
  { label: 'ERROR', icon: '🔴', keys: ['ERROR'], quota: 3, speed: 6200 },
  { label: 'WARN', icon: '🟡', keys: ['WARN'], quota: 4, speed: 5700 },
  { label: 'ERROR + payment', icon: '💳', keys: ['ERROR', 'payment'], quota: 4, speed: 5200 },
  { label: '500', icon: '💥', keys: ['500'], quota: 5, speed: 4700 },
  { label: 'timeout', icon: '⏱️', keys: ['timeout'], quota: 5, speed: 4300 },
  { label: 'ERROR + auth', icon: '🔐', keys: ['ERROR', 'auth'], quota: 6, speed: 3900 },
  { label: 'REQ=A82F', icon: '🧬', keys: ['A82F'], quota: 6, speed: 3500 },
  { label: 'payrnent', icon: '👁️', keys: ['payrnent'], quota: 7, speed: 3200 }
];

const SERVICES = ['auth', 'payment', 'cache', 'profile', 'order', 'search', 'mail', 'upload'];
const ACTIONS = ['success', 'failed', 'timeout', 'retry', 'ready', 'denied', 'slow', 'complete'];
const IDS = ['A82F', 'C91B', 'F10D', 'D44A', 'B77E', 'E09C'];
const NODES = ['api-01', 'api-02', 'worker-03', 'db-primary', 'edge-02'];

let state = null;
let spawnTimer = null;

function installRuntimeStyles() {
  if (document.getElementById('multiline-log-styles')) return;
  const style = document.createElement('style');
  style.id = 'multiline-log-styles';
  style.textContent = `
    .log-row.multi-line{top:-72px;min-height:64px;padding:6px 9px;white-space:normal;display:flex;flex-direction:column;justify-content:center;gap:3px}
    .log-main,.log-detail{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .log-detail{padding-left:12px;border-left:2px solid rgba(99,216,255,.28);color:var(--muted);font-size:.76em;line-height:1.25}
    .log-row.type-error .log-detail{border-left-color:rgba(255,95,120,.45)}
    .log-row.type-warn .log-detail{border-left-color:rgba(255,209,102,.45)}
    @media(max-width:360px){.log-row.multi-line{min-height:60px;padding-top:5px;padding-bottom:5px}.log-detail{font-size:.7em}}
  `;
  document.head.append(style);
}

function makeState() {
  return {
    score: 0,
    combo: 0,
    maxCombo: 0,
    lives: START_LIVES,
    level: 0,
    foundInLevel: 0,
    found: 0,
    taps: 0,
    correct: 0,
    running: true,
    paused: false,
    tutorial: true,
    rowId: 0,
    elapsed: 0,
    speedFactor: 1,
    lastSpeedNotice: 1
  };
}

function startGame() {
  clearTimeout(spawnTimer);
  state = makeState();
  hide('title-screen');
  hide('result-screen');
  show('game-screen');
  $('log-lane').innerHTML = '';
  document.body.classList.remove('human-grep', 'paused');
  renderAll();
  setTarget(true);
  scheduleSpawn(260);
  burst('SYSTEM MONITOR START', 'info');
  react('異常ログを探せ', '光った行をタップ');
}

function scheduleSpawn(delay) {
  clearTimeout(spawnTimer);
  spawnTimer = setTimeout(() => {
    if (!state?.running) return;
    if (!state.paused) {
      state.elapsed += delay / 1000;
      updateSpeed();
      spawnLog();
    }
    const density = Math.max(260, currentTravelTime() / 4.6);
    scheduleSpawn(density + Math.random() * 220);
  }, delay);
}

function currentLevel() {
  return LEVELS[Math.min(state.level, LEVELS.length - 1)];
}

function currentTravelTime() {
  return Math.max(1450, currentLevel().speed / state.speedFactor);
}

function updateSpeed() {
  const progressBoost = state.found / 22;
  const timeBoost = state.elapsed / 80;
  state.speedFactor = Math.min(3.2, 1 + progressBoost + timeBoost);
  const reached = [1.3, 1.6, 2, 2.5, 3].filter((value) => state.speedFactor >= value).pop();
  if (reached && reached > state.lastSpeedNotice) {
    state.lastSpeedNotice = reached;
    burst(`SPEED ${reached.toFixed(1)}x`, reached >= 2.5 ? 'danger' : 'info');
    restart($('game-screen'), 'combo-aura');
    react('ログ加速', `${reached.toFixed(1)}倍速`);
  }
}

function setTarget(initial = false) {
  const target = currentLevel();
  $('target-value').textContent = target.label;
  $('target-count').textContent = `${state.foundInLevel} / ${target.quota}`;
  document.querySelector('.target-icon').textContent = target.icon;
  restart($('target-panel'), initial ? 'target-enter' : 'target-swap');
  if (!initial) {
    burst('NEW TARGET', 'info');
    react(target.label, '同じ特徴を探せ');
  }
}

function makeLog(forceMatch = false) {
  const target = currentLevel();
  const shouldMatch = forceMatch || Math.random() < 0.26;
  let type = pick(['INFO', 'INFO', 'WARN', 'ERROR']);
  let service = pick(SERVICES);
  let action = pick(ACTIONS);
  let status = pick(['200', '200', '201', '404', '500', '503']);
  let id = pick(IDS);

  if (shouldMatch) {
    target.keys.forEach((key) => {
      if (key === 'ERROR' || key === 'WARN') type = key;
      else if (key === 'payment') service = 'payment';
      else if (key === 'auth') service = 'auth';
      else if (key === 'timeout') action = 'timeout';
      else if (key === '500') status = '500';
      else if (key === 'A82F') id = 'A82F';
      else if (key === 'payrnent') service = 'payrnent';
    });
  } else {
    const candidate = `${type} ${service} ${action} ${status} ${id}`;
    if (target.keys.every((key) => candidate.includes(key))) {
      service = service === 'payment' ? 'order' : service;
      type = type === 'ERROR' ? 'INFO' : type;
      status = status === '500' ? '200' : status;
      id = id === 'A82F' ? 'C91B' : id;
      action = action === 'timeout' ? 'complete' : action;
    }
  }

  const now = new Date();
  const time = [now.getHours(), now.getMinutes(), now.getSeconds()]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
  const multilineChance = Math.min(0.18 + state.level * 0.035, 0.46);
  const multiline = !forceMatch && Math.random() < multilineChance;
  const node = pick(NODES);
  const main = multiline
    ? `${time} ${type.padEnd(5)} ${service} ${status}`
    : `${time} ${type.padEnd(5)} ${service} ${action} ${status} REQ=${id}`;
  const detail = multiline
    ? pick([
        `↳ ${action} REQ=${id} node=${node}`,
        `↳ at ${service}.handler action=${action} REQ=${id}`,
        `↳ cause=${action} trace=${id} host=${node}`
      ])
    : '';
  const searchableText = `${main} ${detail}`;

  return {
    id: ++state.rowId,
    main,
    detail,
    multiline,
    match: target.keys.every((key) => searchableText.includes(key)),
    type
  };
}

function spawnLog() {
  const tutorialMatch = state.tutorial && state.rowId === 1;
  const log = makeLog(tutorialMatch);
  const row = document.createElement('button');
  row.type = 'button';
  row.className = `log-row type-${log.type.toLowerCase()}${log.multiline ? ' multi-line' : ''}${tutorialMatch ? ' tutorial-target' : ''}`;
  row.dataset.match = String(log.match);
  row.dataset.id = String(log.id);
  row.style.setProperty('--travel-time', `${currentTravelTime()}ms`);
  row.innerHTML = log.multiline
    ? `<span class="log-main">${tokenize(log.main)}</span><span class="log-detail">${tokenize(log.detail)}</span>`
    : `<span class="log-main">${tokenize(log.main)}</span>`;
  row.addEventListener('click', () => selectRow(row));
  row.addEventListener('animationend', (event) => {
    if (event.animationName !== 'log-travel') return;
    if (row.dataset.match === 'true' && row.dataset.handled !== 'true') missRow(row);
    row.remove();
  });
  $('log-lane').append(row);

  if (tutorialMatch) {
    $('tutorial-hand').classList.remove('hidden');
    requestAnimationFrame(() => positionHand(row));
  }
}

function tokenize(text) {
  return text.split(' ').map((token) => {
    let cls = '';
    if (token === 'ERROR') cls = 'token-error';
    else if (token === 'WARN') cls = 'token-warn';
    else if (token === '500' || token === '503') cls = 'token-status';
    else if (token.includes('timeout')) cls = 'token-timeout';
    return `<span class="${cls}">${token}</span>`;
  }).join(' ');
}

function positionHand(row) {
  const rowRect = row.getBoundingClientRect();
  const wrapRect = document.querySelector('.terminal-wrap').getBoundingClientRect();
  $('tutorial-hand').style.top = `${rowRect.top - wrapRect.top + rowRect.height / 2}px`;
}

function selectRow(row) {
  if (!state?.running || state.paused || row.dataset.handled === 'true') return;
  row.dataset.handled = 'true';
  state.taps += 1;
  if (row.dataset.match === 'true') correctRow(row);
  else wrongRow(row);
}

function correctRow(row) {
  state.correct += 1;
  state.found += 1;
  state.foundInLevel += 1;
  state.combo += 1;
  state.maxCombo = Math.max(state.maxCombo, state.combo);
  const gain = Math.round((100 + state.combo * 20 + state.level * 35) * state.speedFactor);
  state.score += gain;
  row.classList.add('matched');
  createFragments(row, 'good');
  popAt(row, `MATCH +${gain}`, 'good');
  restart($('combo-value'), 'metric-pop');
  restart($('operator-face'), state.combo >= 10 ? 'operator-awaken' : 'operator-win');
  if (state.combo === 5 || state.combo === 10 || state.combo % 20 === 0) comboBurst();
  if (state.tutorial) {
    state.tutorial = false;
    $('tutorial-hand').classList.add('hidden');
    burst('GOOD!', 'good');
  }
  react(`${state.combo} COMBO`, '次の異常を探せ');
  row.addEventListener('animationend', () => row.remove(), { once: true });
  advanceTarget();
  updateSpeed();
  renderAll();
}

function loseLife(reason, row) {
  state.combo = 0;
  state.lives = Math.max(0, state.lives - 1);
  if (row) createFragments(row, 'fire');
  burst(reason === '誤検知' ? 'FALSE POSITIVE' : 'MISSED!', 'danger');
  restart($('game-screen'), 'screen-hit');
  restart($('time-value'), 'metric-pop');
  restart($('operator-face'), state.lives ? 'operator-panic' : 'operator-miss');
  react(reason, `残りライフ ${state.lives}`);
  renderAll();
  if (state.lives <= 0) endGame('ライフが尽きた');
}

function wrongRow(row) {
  row.classList.add('wrong');
  popAt(row, 'FALSE POSITIVE', 'danger');
  noiseFlash();
  loseLife('誤検知', row);
}

function missRow(row) {
  if (!state?.running) return;
  loseLife('見落とした！', row);
}

function advanceTarget() {
  const target = currentLevel();
  if (state.foundInLevel < target.quota) return;
  state.foundInLevel = 0;
  if (state.level < LEVELS.length - 1) state.level += 1;
  setTarget();
  document.body.classList.toggle('human-grep', state.level >= 5);
}

function comboBurst() {
  const text = state.combo >= 20 ? 'HUMAN GREP MODE' : `${state.combo} COMBO`;
  burst(text, 'combo');
  createParticles(22);
  restart($('game-screen'), 'combo-aura');
}

function renderAll() {
  if (!state) return;
  $('score-value').textContent = state.score.toLocaleString('ja-JP');
  $('combo-value').textContent = state.combo;
  $('time-value').textContent = '♥'.repeat(Math.max(0, state.lives)) + '♡'.repeat(Math.max(0, START_LIVES - state.lives));
  $('fire-value').textContent = `${state.speedFactor.toFixed(1)}x`;
  $('fire-bar').style.width = `${Math.min(100, (state.speedFactor - 1) / 2.2 * 100)}%`;
  $('fire-bar').classList.toggle('danger', state.speedFactor >= 2.3);
  $('target-count').textContent = `${state.foundInLevel} / ${currentLevel().quota}`;
  const accuracy = state.taps ? Math.round(state.correct / state.taps * 100) : 100;
  $('accuracy-value').textContent = `${accuracy}%`;
}

function endGame(reason) {
  if (!state?.running) return;
  state.running = false;
  clearTimeout(spawnTimer);
  document.body.classList.remove('human-grep', 'paused');
  const accuracy = state.taps ? Math.round(state.correct / state.taps * 100) : 0;
  const record = { score: state.score, combo: state.maxCombo, found: state.found, accuracy, speed: state.speedFactor };
  const best = JSON.parse(localStorage.getItem('meGrepBest') || 'null');
  if (!best || record.score > best.score) localStorage.setItem('meGrepBest', JSON.stringify(record));
  burst('MONITOR END', 'danger');
  restart($('game-screen'), 'shutdown');
  setTimeout(() => {
    hide('game-screen');
    show('result-screen');
    $('result-score').textContent = record.score.toLocaleString('ja-JP');
    $('result-combo').textContent = record.combo;
    $('result-found').textContent = record.found;
    $('result-accuracy').textContent = `${record.accuracy}%`;
    $('result-comment').textContent = `最高速度 ${record.speed.toFixed(1)}x。${record.accuracy >= 95 ? '総評：grepを使えばもっと早かった。' : record.accuracy >= 75 ? '総評：人力としては許容範囲。' : '総評：検索コマンドの導入を推奨。'}`;
    $('result-title').textContent = reason;
    restart($('result-screen'), 'result-drop');
  }, 650);
}

function pauseGame() {
  if (!state?.running) return;
  state.paused = true;
  document.body.classList.add('paused');
  $('pause-dialog').showModal();
}

function resumeGame() {
  state.paused = false;
  document.body.classList.remove('paused');
  $('pause-dialog').close();
}

function react(main, sub) {
  $('operator-message').textContent = main;
  $('sub-message').textContent = sub;
}

function restart(element, className) {
  if (!element) return;
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
  element.addEventListener('animationend', () => element.classList.remove(className), { once: true });
}

const NOTICE_LABELS = {
  'SYSTEM MONITOR START': '▶ 監視開始',
  'NEW TARGET': '🔍 検索条件が変更',
  'GOOD!': '✓ 正解',
  'FALSE POSITIVE': '✕ 誤検知',
  'MISSED!': '⚠ 見落とし',
  'MONITOR END': '■ 監視終了'
};

function removeFxNode(node) {
  if (node?.isConnected) node.remove();
}

function burst(text, tone = 'info') {
  const node = document.createElement('div');
  node.className = `center-burst ${tone}`;
  node.textContent = NOTICE_LABELS[text] || text;
  $('fx-layer').append(node);
  node.addEventListener('animationend', () => removeFxNode(node), { once: true });
  setTimeout(() => removeFxNode(node), 1600);
}

function popAt(row, text, tone) {
  const rect = row.getBoundingClientRect();
  const node = document.createElement('div');
  node.className = `point-pop ${tone}`;
  node.textContent = text;
  node.style.left = `${rect.left + rect.width / 2}px`;
  node.style.top = `${rect.top + rect.height / 2}px`;
  $('fx-layer').append(node);
  node.addEventListener('animationend', () => removeFxNode(node), { once: true });
  setTimeout(() => removeFxNode(node), 1200);
}

function createFragments(row, tone) {
  const rect = row.getBoundingClientRect();
  for (let index = 0; index < 8; index += 1) {
    const node = document.createElement('i');
    node.className = `fragment ${tone}`;
    node.style.left = `${rect.left + rect.width / 2}px`;
    node.style.top = `${rect.top + rect.height / 2}px`;
    node.style.setProperty('--x', `${(Math.random() - 0.5) * 150}px`);
    node.style.setProperty('--y', `${(Math.random() - 0.5) * 90}px`);
    $('fx-layer').append(node);
    node.addEventListener('animationend', () => node.remove(), { once: true });
  }
}

function createParticles(count) {
  for (let index = 0; index < count; index += 1) {
    const node = document.createElement('i');
    node.className = 'combo-particle';
    node.style.left = `${20 + Math.random() * 60}%`;
    node.style.top = `${20 + Math.random() * 60}%`;
    $('fx-layer').append(node);
    node.addEventListener('animationend', () => node.remove(), { once: true });
  }
}

function noiseFlash() {
  restart($('game-screen'), 'noise-flash');
}

function renderBest() {
  const best = JSON.parse(localStorage.getItem('meGrepBest') || 'null');
  $('best-record').innerHTML = best
    ? `<span>最高記録</span><strong>${best.score.toLocaleString('ja-JP')}点</strong><small>${best.combo} COMBO ／ ${best.found}件発見</small>`
    : '<span>最高記録</span><strong>未記録</strong><small>監視を開始しよう</small>';
}

function show(id) { $(id).classList.remove('hidden'); }
function hide(id) { $(id).classList.add('hidden'); }

$('start-button').addEventListener('click', startGame);
$('retry-button').addEventListener('click', startGame);
$('back-button').addEventListener('click', () => {
  hide('result-screen');
  show('title-screen');
  renderBest();
});
$('pause-button').addEventListener('click', pauseGame);
$('resume-button').addEventListener('click', resumeGame);
$('quit-button').addEventListener('click', () => {
  $('pause-dialog').close();
  endGame('自主的に監視を終了した');
});

installRuntimeStyles();
renderBest();