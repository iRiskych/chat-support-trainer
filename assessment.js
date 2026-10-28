/* Job Assessment Mode — Етап 2 (Trainer 2.0). Окремий модуль:
   не змінює режим тренування, XP не нараховує, стан зберігає в localStorage
   і переживає перезавантаження вкладки (таймер на фіксованих мітках часу). */
(function(){
"use strict";
var LS_KEY = "technodimAssessment.v1";
var DURATION_MIN = 40;
var TICKETS = 10;
var CAT_CAP = 2;
var LEVELS = [
  { id:"junior", label:"Junior", hint:"складність 1–2 ★", dfn:[1,2] },
  { id:"intermediate", label:"Intermediate", hint:"складність 3 ★", dfn:[3] },
  { id:"advanced", label:"Advanced", hint:"складність 4–5 ★", dfn:[4,5] },
  { id:"english", label:"English", hint:"англомовні тікети", eng:true }
];

function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
function fmtMs(ms){ ms = Math.max(0, ms); var m = Math.floor(ms/60000), s = Math.floor((ms%60000)/1000); return (m<10?"0":"")+m+":"+(s<10?"0":"")+s; }

function load(){ try { var raw = localStorage.getItem(LS_KEY); if (raw) { var o = JSON.parse(raw); if (o && o.v === 1) return o; } } catch(e){} return null; }
function save(){ if (st) { try { localStorage.setItem(LS_KEY, JSON.stringify(st)); } catch(e){} } }
function wipe(){ try { localStorage.removeItem(LS_KEY); } catch(e){} st = null; }

var st = load();

function scenOf(t){ return (window.SCENARIOS || []).filter(function(x){ return x.id === t.sid; })[0] || null; }
function remainingMs(){ return st && !st.finished ? st.endsAt - Date.now() : 0; }

function levelById(levelId){
  var lv = LEVELS[0];
  LEVELS.forEach(function(l){ if (l.id === levelId) lv = l; });
  return lv;
}
function poolFor(levelId){
  var lv = levelById(levelId);
  var pool = (window.SCENARIOS || []).filter(function(s){
    if (lv.eng) return s.cat === "англомовний клієнт";
    return lv.dfn.indexOf(s.dfn) !== -1;
  });
  if (pool.length < TICKETS) {
    (window.SCENARIOS || []).forEach(function(s){
      if (pool.indexOf(s) === -1 && Math.abs(lv.dfn[0] - s.dfn) <= 1) pool.push(s);
    });
  }
  return pool;
}
function pick(levelId){
  var lv = levelById(levelId);
  var pool = poolFor(levelId);
  for (var i = pool.length - 1; i > 0; i--){ var j = Math.floor(Math.random()*(i+1)); var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp; }
  var chosen = [], catCount = {};
  /* для English-рівня всі тікети однієї категорії — ліміт категорій не застосовується */
  var cap = lv.eng ? TICKETS : CAT_CAP;
  for (var k = 0; k < pool.length && chosen.length < TICKETS; k++){
    var s = pool[k];
    if ((catCount[s.cat] || 0) >= cap) continue;
    catCount[s.cat] = (catCount[s.cat] || 0) + 1;
    chosen.push(s);
  }
  return chosen.slice(0, TICKETS);
}
function start(levelId){
  var list = pick(levelId);
  st = { v:1, level: levelId, startedAt: Date.now(), endsAt: Date.now() + DURATION_MIN*60*1000,
    tickets: list.map(function(s){ return { sid: s.id, answers: [], clientStep: 0, done: false,
      openedAt: null, closedAt: null, orderCheckedEarly: false, orderChecked: false, result: null }; }),
    openIdx: 0, finished: false, reason: null };
  openTicket(0);
  save(); render();
}
function openTicket(idx){
  if (!st || st.finished) return;
  var t = st.tickets[idx];
  if (!t) return;
  if (t.openedAt == null) t.openedAt = Date.now();
  st.openIdx = idx;
  save(); render();
}
function sendAnswer(text){
  if (!st || st.finished) return;
  var t = st.tickets[st.openIdx];
  var sc = scenOf(t);
  if (!t || !sc || t.done) return;
  text = String(text || "").trim();
  if (!text) return;
  t.answers.push(text);
  if (t.clientStep < 1 + (sc.follows ? sc.follows.length : 0)) t.clientStep++;
  save(); render();
}
function pressAdmin(){
  if (!st || st.finished) return;
  var t = st.tickets[st.openIdx];
  if (!t || t.done) return;
  if (t.answers.length === 0) t.orderCheckedEarly = true;
  else t.orderChecked = true;
  save(); render();
}
function closeTicket(){
  if (!st || st.finished) return;
  var t = st.tickets[st.openIdx];
  if (!t || t.done) return;
  t.closedAt = Date.now();
  t.done = true;
  t.result = evaluateTicket(t);
  var next = -1;
  for (var i = 0; i < st.tickets.length; i++){ if (!st.tickets[i].done) { next = i; break; } }
  if (next === -1) finish("all-done");
  else { st.openIdx = next; openTicket(next); }
}
function finish(reason){
  if (!st || st.finished) return;
  st.tickets.forEach(function(t){
    if (!t.done) { t.closedAt = Date.now(); t.done = true; t.result = evaluateTicket(t); }
  });
  st.finished = true;
  st.reason = reason;
  var sum = 0, doneCount = 0;
  st.tickets.forEach(function(t){ sum += (t.result && t.result.qa100) || 0; if (t.result && t.result.factPct > 0) doneCount++; });
  st.report = { avg: Math.round(sum / st.tickets.length) };
  /* Етап 5: архів завершених тестів — для статистики і експорту */
  try {
    var arch = getArchive();
    arch.unshift({ ts: Date.now(), level: st.level, avg: st.report.avg, reason: reason, doneCount: doneCount });
    if (arch.length > 50) arch.length = 50;
    setArchive(arch);
  } catch(e){}
  save(); render();
}
function evaluateTicket(t){
  var sc = scenOf(t);
  if (!sc) return { qa100: 0, score10: 0, factPct: 0, forb: [], garbage: true, contradictions: 0, keys: "0/0", timeSec: 0 };
  var answers = t.answers;
  var refNorm = normalizeAnswerText(String(sc.ref || "").toLowerCase());
  var b = checkBasics(answers);
  var low = answers.join(" ").toLowerCase();
  var norm = normalizeAnswerText(low);
  var kf = sc.keys.filter(function(k){ return stemEvidence(k, norm).pos > 0; });
  var an = { facts: analyzeFacts(sc, answers, refNorm), forb: checkForbidden(answers) };
  an.engIssues = (sc.cat === "англомовний клієнт") ? englishIssues(answers) : [];
  var garbage = isGarbage(answers);
  var gr = garbage ? [] : grammarIssues(answers);
  var om = orderFactsMentioned(sc, answers);
  var c = { low: low, text: answers.join(" "), greeting: b.greeting, capsOk: b.caps, empathy: b.empathy,
    lastLow: (answers[answers.length-1] || "").toLowerCase(),
    anyStep: low.indexOf("?") !== -1 || NEXTSTEP.some(function(m){ return low.indexOf(m) !== -1; }),
    factsHits: an.facts.list.filter(function(f){ return f.hit; }).length, keysFound: kf.length,
    orderCheckedEarly: !!t.orderCheckedEarly, orderChecked: !!t.orderChecked,
    orderDataUsed: !!(om.num || om.sum || om.ttn),
    forbiddenRude: an.forb.some(function(f){ return f.l.indexOf("Грубість") !== -1; }) };
  var au = autoChecklist(sc, c);
  var escAss = (window.Escalation && window.Escalation.assess) ? window.Escalation.assess(sc, t.escalation, answers) : null;
  var score = scoreAnswers(b, an, gr, escAss);
  if (garbage) { score = {polite:0, accuracy:0, security:0, clarity:0, literacy:0, empathy:0, score:1, qa100:0}; }
  return { qa100: score.qa100 || 0, score10: score.score || 0, factPct: an.facts.pct,
    forb: an.forb.map(function(f){ return f.l; }), garbage: garbage,
    contradictions: an.facts.contradictions, keys: kf.length + "/" + sc.keys.length,
    clPassed: au.passed + "/" + sc.checks.length, engCount: (an.engIssues || []).length,
    esc: escAss ? { required: escAss.required, dept: escAss.dept, why: escAss.why,
      escalated: escAss.escalated, deptOk: escAss.deptOk, missed: escAss.missed,
      unnecessary: escAss.unnecessary, noteMissing: escAss.noteMissing, notifyMissing: escAss.notifyMissing,
      note: t.escalation ? t.escalation.note : null } : null,
    timeSec: t.closedAt && t.openedAt ? Math.round((t.closedAt - t.openedAt)/1000) : 0 };
}

/* ===== Рендер ===== */
var root = null;
function ensureTimer(){
  if (window.__asTimer) return;
  window.__asTimer = setInterval(function(){
    if (!st || st.finished) return;
    var el = document.getElementById("asTimer");
    if (el) el.textContent = fmtMs(remainingMs());
    if (remainingMs() <= 0) finish("time");
  }, 500);
}
function ticketStatus(t){
  if (t.done) return '<span class="chip ok">зданий</span>';
  if (t.openedAt != null) return '<span class="chip">у роботі</span>';
  return '<span class="chip dim">новий</span>';
}
function render(){
  if (!root) root = document.getElementById("tab-assess");
  if (!root) return;
  ensureTimer();
  if (!window.SCENARIOS || window.SCENARIOS.length < 100){ root.innerHTML = '<div class="card"><p class="muted">Завантаження сценаріїв…</p></div>'; return; }
  st = load();
  if (!st){ renderPicker(); return; }
  if (!st.finished && remainingMs() <= 0){ finish("time"); return; }
  if (st.finished) renderReport();
  else renderRun();
}
function renderPicker(){
  var html = '<div class="card"><h3>🧪 Тестове завдання (Job Assessment)</h3>' +
    '<p class="muted small">10 випадкових тікетів · 40 хвилин · без підказок і еталонів під час проходження · адмінка та база знань доступні · оцінювання і QA Score / 100 — лише після завершення. XP у цьому режимі не нараховується, режим тренування не змінюється. Стан зберігається: можна перезавантажити сторінку.</p>' +
    '<div class="chiprow">';
  LEVELS.forEach(function(l){
    html += '<button class="btn" data-level="' + l.id + '">▶ ' + l.label + ' <small class="muted">(' + l.hint + ')</small></button>';
  });
  html += '</div><p class="small muted">Категорії тікетів перемішані, одна категорія — не більше 2 тікетів. Таймер фіксований за часом: перемикання вкладок і перезавантаження сторінки не ламають тест.</p></div>';
  root.innerHTML = html;
  root.querySelectorAll("[data-level]").forEach(function(b){
    b.addEventListener("click", function(){ start(b.dataset.level); });
  });
}
function renderRun(){
  var cur = st.tickets[st.openIdx];
  var sc = scenOf(cur);
  var html = '<div class="card">' +
    '<div class="row between"><h3>🧪 Тестове завдання</h3><div><span id="asTimer" style="font-size:22px;font-weight:800">' + fmtMs(remainingMs()) + '</span> <span class="muted small">залишилось</span></div></div>' +
    '<p class="small muted">Рівень: <b>' + esc((LEVELS.filter(function(l){return l.id===st.level;})[0]||{}).label || st.level) + '</b> · Здано тікетів: <b>' + st.tickets.filter(function(t){return t.done;}).length + ' / ' + st.tickets.length + '</b> · підказки та еталони приховані до завершення · XP не нараховується.</p>' +
    '<div class="chiprow">';
  st.tickets.forEach(function(t, i){
    var label = "№" + (i+1);
    var cls = t.done ? "ok" : (i === st.openIdx ? "" : "dim");
    html += '<button class="chip ' + cls + '" data-open="' + i + '">' + label + " · " + ticketStatus(t) + '</button>';
  });
  html += '</div></div>';

  html += '<div class="card"><h3>💬 Тікет №' + (st.openIdx + 1) + ' — ' + esc(sc.cat) + ' (' + stars(sc.dfn) + ')</h3>';
  html += '<div class="chatlog" style="margin:8px 0">';
  html += '<div class="factrow"><b>Клієнт:</b> ' + esc(sc.first) + '</div>';
  for (var f = 0; f < cur.clientStep && f < (sc.follows || []).length; f++){
    html += '<div class="factrow"><b>Клієнт:</b> ' + esc(sc.follows[f]) + '</div>';
  }
  cur.answers.forEach(function(a){
    html += '<div class="factrow" style="color:var(--accent)"><b>Ви:</b> ' + esc(a) + '</div>';
  });
  html += '</div>';
  if (!cur.done){
    html += '<textarea id="asInput" rows="3" style="width:100%" placeholder="Ваша відповідь клієнту…"></textarea>' +
      '<div class="row end" style="margin-top:8px">' +
      '<button class="btn" id="asAdmin">🛠 Адмінка' + (cur.orderCheckedEarly ? " ✓" : (cur.orderChecked ? " ✓(після)" : "")) + '</button>' +
      '<button class="btn" id="asKb">📚 База знань</button>' +
      '<button class="btn" id="asEsc">⬆ Ескалювати' + (cur.escalation ? ": " + esc(cur.escalation.dept) : "") + '</button>' +
      '<button class="btn" id="asSend">Надіслати</button>' +
      '<button class="btn primary" id="asClose">Закрити тікет</button></div>' +
      '<div id="asAdminBox" style="display:none"></div>' +
      '<div id="asKbBox" style="display:none"></div>' +
      '<div id="asEscBox" style="display:none"></div>' +
      '<p class="small muted">Клієнт очікує відповіді' + (cur.clientStep >= 1 + (sc.follows || []).length ? " (усі його повідомлення показано)" : "") + '. Після «Закрити тікет» оцінка буде видима лише у фінальному звіті.</p>';
  } else {
    html += '<p class="small muted">✅ Тікет зданий. Оцінку буде показано у фінальному звіті.</p>';
  }
  html += '</div>';
  html += '<div class="row end"><button class="btn" id="asFinish">Завершити тест достроково (незакриті тікети = 0 балів за зміст)</button></div>';
  root.innerHTML = html;

  root.querySelectorAll("[data-open]").forEach(function(b){
    b.addEventListener("click", function(){ openTicket(+b.dataset.open); });
  });
  var send = document.getElementById("asSend");
  if (send) send.addEventListener("click", function(){
    var inp = document.getElementById("asInput");
    sendAnswer(inp ? inp.value : "");
  });
  var adm = document.getElementById("asAdmin");
  if (adm) adm.addEventListener("click", function(){
    var box = document.getElementById("asAdminBox");
    if (!box) return;
    if (box.style.display === "none"){
      var o = sc.order;
      box.innerHTML = o ?
        '<table class="scoretab" style="width:100%">' +
        '<tr><td>№ замовлення</td><td>' + esc(o.num) + '</td></tr>' +
        '<tr><td>Статус</td><td>' + esc(o.status) + '</td></tr>' +
        '<tr><td>Дата</td><td>' + esc(o.date) + '</td></tr>' +
        '<tr><td>Товари</td><td>' + esc(o.items) + '</td></tr>' +
        '<tr><td>Сума</td><td>' + esc(o.sum) + '</td></tr>' +
        '<tr><td>Оплата</td><td>' + esc(o.pay) + '</td></tr>' +
        '<tr><td>Доставка</td><td>' + esc(o.deliv) + '</td></tr>' +
        (o.ttn ? '<tr><td>ТТН</td><td>' + esc(o.ttn) + '</td></tr>' : '') +
        '<tr><td>Місто</td><td>' + esc(o.city) + '</td></tr></table>' +
        '<p class="small muted">Відкрито ' + (cur.answers.length === 0 ? "до першої відповіді" : "після відповідей") + '. +10 XP-еквівалент у QA — лише якщо дані використані у відповіді.</p>'
        : '<p class="muted small">У цього тікета немає даних замовлення.</p>';
      box.style.display = "";
      pressAdmin();
    } else { box.style.display = "none"; }
  });
  var kb = document.getElementById("asKb");
  if (kb) kb.addEventListener("click", function(){
    var box = document.getElementById("asKbBox");
    if (!box) return;
    if (box.style.display === "none"){
      box.innerHTML = '<div class="factgrid">' + (window.KB || []).map(function(k){
        return '<div class="factrow"><b>' + esc(k.t) + '</b> — ' + esc(k.d) + '</div>';
      }).join("") + '</div>';
      box.style.display = "";
    } else { box.style.display = "none"; }
  });
  var escBtn = document.getElementById("asEsc");
  if (escBtn) escBtn.addEventListener("click", function(){
    var box = document.getElementById("asEscBox");
    if (!box) return;
    if (box.style.display === "none"){
      var depts = (window.Escalation && window.Escalation.DEPTS) || [];
      var prios = (window.Escalation && window.Escalation.PRIORITIES) || [];
      box.innerHTML = '<div class="row"><select id="asEscDept" style="flex:1">' +
        depts.map(function(d){ return '<option value="' + esc(d) + '"' + (cur.escalation && cur.escalation.dept === d ? " selected" : "") + '>' + esc(d) + '</option>'; }).join("") +
        '</select><select id="asEscPrio" style="width:170px">' +
        prios.map(function(p){ return '<option value="' + esc(p) + '"' + (cur.escalation && cur.escalation.priority === p ? " selected" : "") + '>пріоритет: ' + esc(p) + '</option>'; }).join("") +
        '</select></div>' +
        '<textarea id="asEscNote" rows="3" style="width:100%;margin-top:6px" placeholder="Внутрішня нотатка для відділу: № замовлення, суть проблеми, що вже зроблено. Клієнт її не бачить.">' + esc(cur.escalation ? cur.escalation.note : "") + '</textarea>' +
        '<div class="row end" style="margin-top:6px"><button class="btn primary" id="asEscConfirm">Підтвердити ескалацію</button></div>' +
        '<p class="small muted">Нотатка службова — клієнт її не бачить. Після ескалації напишіть клієнту, що питання передано і коли чекати відповідь.</p>';
      box.style.display = "";
      document.getElementById("asEscConfirm").addEventListener("click", function(){
        cur.escalation = { dept: document.getElementById("asEscDept").value,
          priority: document.getElementById("asEscPrio").value,
          note: document.getElementById("asEscNote").value,
          atAnswerIndex: cur.answers.length };
        save(); render();
      });
    } else { box.style.display = "none"; }
  });
  var close = document.getElementById("asClose");
  if (close) close.addEventListener("click", closeTicket);
  var fin = document.getElementById("asFinish");
  if (fin) fin.addEventListener("click", function(){ if (confirm("Завершити тест достроково? Незакриті тікети отримають 0 за зміст.")) finish("early"); });
}
function renderReport(){
  var sum = 0;
  st.tickets.forEach(function(t){ sum += (t.result && t.result.qa100) || 0; });
  var avg = Math.round(sum / st.tickets.length);
  var html = '<div class="card"><h3>🧪 Результат тестового завдання</h3>' +
    '<p class="muted small">Рівень: ' + esc((LEVELS.filter(function(l){return l.id===st.level;})[0]||{}).label || st.level) +
    ' · причина завершення: ' + (st.reason === "time" ? "час вийшов" : st.reason === "early" ? "достроково" : "усі тікети здано") +
    ' · метрики отримані з навчальної симуляції, а не з реальної роботи.</p>' +
    '<div class="scorewrap"><div class="scorebig">' + avg + '<span>/100</span></div><div><b>Середній QA Score</b><br><span class="muted small">10 тікетів · XP не нараховувався</span></div></div>' +
    '<table class="scoretab" style="width:100%;margin-top:10px"><tr><th>№</th><th>Категорія</th><th>Сценарій</th><th>Факти</th><th>QA /100</th><th>Час</th><th>Зауваження</th></tr>';
  st.tickets.forEach(function(t, i){
    var sc = scenOf(t);
    var r = t.result || {};
    var notes = [];
    if (r.garbage) notes.push("порожньо/сміття");
    if (r.contradictions > 0) notes.push("суперечить еталону (" + r.contradictions + ")");
    if ((r.forb || []).length) notes.push("критичні помилки: " + r.forb.join("; "));
    if (r.engCount > 0) notes.push("🇬🇧 типових помилок: " + r.engCount);
    if (r.esc) {
      if (r.esc.required && r.esc.missed) notes.push("пропущена ескалація у «" + r.esc.dept + "»");
      else if (r.esc.escalated && r.esc.required && !r.esc.deptOk) notes.push("ескалація не в той відділ (потрібен: " + r.esc.dept + ")");
      else if (r.esc.escalated && r.esc.unnecessary) notes.push("ескалація зайва — оператор мав вирішити сам");
      else if (r.esc.escalated && r.esc.deptOk) notes.push("ескалація: " + r.esc.dept + " ✓");
      if (r.esc.noteMissing) notes.push("нотатка без суті");
      if (r.esc.notifyMissing) notes.push("клієнта не поінформовано");
    }
    html += '<tr><td>' + (i+1) + '</td><td>' + esc(sc ? sc.cat : "?") + '</td><td>' + esc(t.sid) + '</td><td>' + (r.factPct || 0) + '%</td><td><b>' + (r.qa100 || 0) + '</b></td><td>' + (r.timeSec || 0) + ' с</td><td class="small">' + (notes.length ? esc(notes.join(" · ")) : "—") + '</td></tr>';
  });
  html += '</table>';
  html += '<h4>Еталонні відповіді (після завершення)</h4>';
  st.tickets.forEach(function(t, i){
    var sc = scenOf(t);
    var escBlock = (t.result && t.result.esc) ?
      '<p class="small muted">⬆ Ескалація: очікувалось — ' + (t.result.esc.required ? esc(t.result.esc.dept) : "самостійне рішення") +
      '; зроблено — ' + (t.result.esc.escalated ? esc(t.result.esc.dept) : "не ескальовано") +
      (t.result.esc.why ? '; чому: ' + esc(t.result.esc.why) : '') + '</p>' : '';
    html += '<details class="card"><summary>№' + (i+1) + ' · ' + esc(t.sid) + ' — ' + (t.result ? t.result.qa100 : 0) + '/100</summary>' +
      '<p class="small"><b>Клієнт:</b> ' + esc(sc ? sc.first : "") + '</p>' +
      (t.answers || []).map(function(a){ return '<p class="small" style="color:var(--accent)"><b>Ви:</b> ' + esc(a) + '</p>'; }).join("") +
      '<p class="small"><b>Еталон сильного оператора:</b> ' + esc(sc ? sc.ref : "") + '</p>' + escBlock + '</details>';
  });
  html += '<div class="row end" style="margin-top:10px"><button class="btn primary" id="asAgain">Почати новий тест</button></div></div>';
  root.innerHTML = html;
  var again = document.getElementById("asAgain");
  if (again) again.addEventListener("click", function(){ wipe(); render(); });
}
function stars(d){ var r = ""; for (var i = 1; i <= 5; i++) r += i <= d ? "★" : "☆"; return r; }

var ARCHIVE_KEY = "technodimAssessment.history.v1";
function getArchive(){ try { var raw = localStorage.getItem(ARCHIVE_KEY); var a = raw ? JSON.parse(raw) : []; return (a && a.push) ? a : []; } catch(e){ return []; } }
function setArchive(a){ try { localStorage.setItem(ARCHIVE_KEY, JSON.stringify(a || [])); } catch(e){} }

window.Assessment = { render: render, isActive: function(){ return !!st && !st.finished; },
  getArchive: getArchive, setArchive: setArchive };
})();
