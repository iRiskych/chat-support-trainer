/* Live Shift Mode — Етап 6 (Trainer 2.0). Окремий модуль:
   зміна 15/30/45 хв, черга клієнтів, паралельні чати, терпіння, FRT/AHT/Resolution,
   QA тим самим конвеєром, звіт зміни, XP-бонус (середній QA ≥ 70 і без FORBIDDEN).
   Стан у localStorage «technodimShift.v1», переживає перезавантаження.
   Керований годинник і seeded RNG — лише для тестів (window.ShiftTest). */
(function(){
"use strict";
var LS_KEY = "technodimShift.v1";
var ARCHIVE_KEY = "technodimShift.history.v1";
var PATIENCE_IMP = 90 * 1000, PATIENCE_ABANDON = 180 * 1000;
var LEVELS = { junior:{ label:"Junior", chats:2 }, advanced:{ label:"Advanced", chats:3 } };
var XP_BONUS = 50;

/* --- керований годинник і seeded RNG (тестовий режим) --- */
var testClockFn = null;
function now(){ return testClockFn ? testClockFn() : Date.now(); }
function mulberry32(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
var rng = Math.random;

function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
function fmtMs(ms){ ms = Math.max(0, ms); var m = Math.floor(ms/60000), s = Math.floor((ms%60000)/1000); return (m<10?"0":"")+m+":"+(s<10?"0":"")+s; }

var st = null;
function load(){ try { var raw = localStorage.getItem(LS_KEY); if (raw) { var o = JSON.parse(raw); if (o && o.v === 1) return o; } } catch(e){} return null; }
function save(){ if (st) { try { localStorage.setItem(LS_KEY, JSON.stringify(st)); } catch(e){} } }
function wipe(){ try { localStorage.removeItem(LS_KEY); } catch(e){} st = null; }
function scenOf(chat){ return (window.SCENARIOS || []).filter(function(x){ return x.id === chat.sid; })[0] || null; }
function activeChats(){ return (st ? st.chats : []).filter(function(c){ return c.status !== "closed" && !c.abandoned; }); }
function selectedChat(){
  if (!st) return null;
  var c = chatByNo(st.selectedNo);
  if (c && c.status !== "closed" && !c.abandoned) return c;
  return activeChats()[0] || st.chats[st.chats.length - 1] || null;
}

function start(levelId, minutes){
  var cfg = LEVELS[levelId] || LEVELS.junior;
  var t0 = now();
  var arrivals = [];
  var t = t0 + (15 + Math.floor(rng()*16)) * 1000;
  while (t < t0 + minutes * 60 * 1000 - 90 * 1000 && arrivals.length < 12){
    arrivals.push(t);
    t += (20 + Math.floor(rng()*31)) * 1000;
  }
  st = { v:1, level: levelId, maxChats: cfg.chats, minutes: minutes,
    startedAt: t0, endsAt: t0 + minutes * 60 * 1000, operatorReady: true,
    arrivals: arrivals, nextArrival: 0, ticketSeq: 0,
    chats: [], queue: [], abandonedCount: 0, selectedNo: null,
    finished: false, reason: null, report: null };
  save(); render();
}
function total(minutes){ return minutes * 60 * 1000; }
function finish(reason){
  if (!st || st.finished) return;
  st.chats.forEach(function(c){
    if (c.status !== "closed" && !c.abandoned){
      c.closedAt = now(); c.status = "closed";
      c.result = evaluateChat(c);
    }
  });
  st.finished = true;
  st.reason = reason;
  var closed = st.chats.filter(function(c){ return !c.abandoned; });
  var frts = closed.filter(function(c){ return c.firstReplyAt != null; })
    .map(function(c){ return c.firstReplyAt - c.openedAt; });
  var ahts = closed.filter(function(c){ return c.openedAt != null; }).map(function(c){ return c.closedAt - c.openedAt; });
  var qaSum = 0, forbCount = 0;
  st.chats.forEach(function(c){ qaSum += (c.result && c.result.qa100) || 0; if (c.result && c.result.forb && c.result.forb.length) forbCount++; });
  var report = {
    total: st.chats.length,
    resolved: closed.length,
    abandoned: st.chats.filter(function(c){ return c.abandoned; }).length,
    avgFrt: frts.length ? Math.round(frts.reduce(function(a,b){ return a+b; },0) / frts.length / 1000) : null,
    aht: ahts.length ? Math.round(ahts.reduce(function(a,b){ return a+b; },0) / ahts.length / 1000) : null,
    resolution: st.chats.length ? Math.round(closed.length / st.chats.length * 100) : 0,
    avgQa: Math.round(qaSum / st.chats.length),
    forbCount: forbCount, xpBonus: 0
  };
  /* XP: бонус за зміну лише при середньому QA ≥ 70 і жодному FORBIDDEN */
  var corrupt = false;
  try { corrupt = !!(window.LOAD_INFO && window.LOAD_INFO.corrupt); } catch(e){}
  if (report.avgQa >= 70 && forbCount === 0 && !corrupt && window.S && typeof window.S.xp === "number"){
    report.xpBonus = XP_BONUS;
    window.S.xp += XP_BONUS;
    if (window.save) window.save();
  }
  report.tips = buildTips(report);
  st.report = report;
  st.finished = true;
  try {
    var arch = getArchive();
    arch.unshift({ ts: now(), minutes: st.minutes, level: st.level, avgQa: report.avgQa,
      frt: report.avgFrt, aht: report.aht, resolution: report.resolution,
      abandoned: report.abandoned, total: report.total, xpBonus: report.xpBonus });
    if (arch.length > 50) arch.length = 50;
    setArchive(arch);
  } catch(e){}
  save(); render();
}
function buildTips(report){
  var tips = [];
  if (report.abandoned > 0) tips.push("Головне: " + report.abandoned + " клієнт(ів) пішли без відповіді — беріть нові чати першими, навіть коротке «Перевіряю» втримує клієнта.");
  if (report.avgFrt != null && report.avgFrt > 45) tips.push("Перша відповідь у межах 30 секунд — коротке привітання з уточненням швидше за мовчання.");
  if (report.avgQa < 70) tips.push("Більше фактів з еталона: номер замовлення, конкретні строки, наступний крок — це основна маса QA.");
  if (report.forbCount > 0) tips.push("Критичні помилки (FORBIDDEN) обнуляють довіру — перевірте, чого не можна писати.");
  if (report.resolution < 80 && report.total > 0) tips.push("Закривайте вирішені тікети сам — відкриті чати займають слоти і знижують Resolution Rate.");
  tips.push("Тримайте статус «Готовий» під час потоку: «Не готовий» зупиняє нові призначення, але зміна триває.");
  return tips.slice(0, 3);
}
/* --- Оцінка чату тим самим конвеєром, що й у тренуванні --- */
function evaluateChat(c){
  var sc = scenOf(c);
  if (!sc) return { qa100: 0, score10: 0, factPct: 0, forb: [], garbage: true, contradictions: 0, keys: "0/0" };
  var answers = c.answers;
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
  var c2 = { low: low, text: answers.join(" "), greeting: b.greeting, capsOk: b.caps, empathy: b.empathy,
    lastLow: (answers[answers.length-1] || "").toLowerCase(),
    anyStep: low.indexOf("?") !== -1 || NEXTSTEP.some(function(m){ return low.indexOf(m) !== -1; }),
    factsHits: an.facts.list.filter(function(f){ return f.hit; }).length, keysFound: kf.length,
    orderCheckedEarly: !!c.orderCheckedEarly, orderChecked: !!c.orderChecked,
    orderDataUsed: !!(om.num || om.sum || om.ttn),
    forbiddenRude: an.forb.some(function(f){ return f.l.indexOf("Грубість") !== -1; }) };
  var au = autoChecklist(sc, c2);
  var escAss = (window.Escalation && window.Escalation.assess) ? window.Escalation.assess(sc, c.escalation, answers) : null;
  var score = scoreAnswers(b, an, gr, escAss);
  if (garbage) { score = {polite:0, accuracy:0, security:0, clarity:0, literacy:0, empathy:0, score:1, qa100:0}; }
  return { qa100: score.qa100 || 0, score10: score.score || 0, factPct: an.facts.pct,
    forb: an.forb.map(function(f){ return f.l; }), garbage: garbage,
    contradictions: an.facts.contradictions, keys: kf.length + "/" + sc.keys.length,
    esc: escAss ? { dept: escAss.dept, required: escAss.required, why: escAss.why,
      escalated: escAss.escalated, deptOk: escAss.deptOk, missed: escAss.missed,
      unnecessary: escAss.unnecessary, noteMissing: escAss.noteMissing, notifyMissing: escAss.notifyMissing } : null };
}
/* --- Прибуття, черга, призначення, терпіння --- */
function tick(){
  if (!st || st.finished) return;
  var t = now();
  var changed = false;
  if (t >= st.endsAt){ finish("time"); return; }
  while (st.nextArrival < st.arrivals.length && t >= st.arrivals[st.nextArrival]){
    st.ticketSeq++;
    st.queue.push({ no: st.ticketSeq, queuedAt: t });
    st.nextArrival++;
    changed = true;
  }
  while (st.operatorReady && activeChats().length < st.maxChats && st.queue.length){
    var q = st.queue.shift();
    st.chats.push({ no: q.no, sid: pickSid(), status: "new", openedAt: null, assignedAt: t,
      lastClientMsgAt: t, firstReplyAt: null, answers: [], clientMsgs: [], clientStep: 0, draft: "",
      impatient: false, holdUsed: false, awaitingReply: true, abandoned: false,
      escalation: null, orderCheckedEarly: false, orderChecked: false, result: null, closedAt: null });
    if (st.selectedNo == null) st.selectedNo = q.no;
    changed = true;
  }
  st.chats.forEach(function(c){
    if (c.status === "closed" || c.abandoned || !c.awaitingReply) return;
    var elapsed = t - c.lastClientMsgAt;
    if (elapsed >= PATIENCE_ABANDON){
      c.abandoned = true; c.status = "closed"; c.closedAt = t;
      c.result = evaluateChat(c);
      st.abandonedCount++;
      changed = true;
    } else if (elapsed >= PATIENCE_IMP && !c.impatient){
      c.impatient = true;
      c.clientMsgs.push("Ало? Ви там?");
      changed = true;
    }
  });
  if (changed) save();
  if (changed) render(); else updateTimerOnly();
}
function pickSid(){
  var pool = (window.SCENARIOS || []).filter(function(s){ return st.englishShift ? s.cat === "англомовний клієнт" : true; });
  if (!pool.length) pool = window.SCENARIOS;
  return pool[Math.floor(rng() * pool.length)].id;
}
function holdChat(){
  var c = selectedChat();
  if (!c || c.status === "closed" || c.abandoned || c.holdUsed) return;
  c.holdUsed = true;                       /* скидання терпіння — один раз */
  c.clientMsgs.push("Добре, чекаю.");
  c.lastClientMsgAt = now();
  save(); render();
}
function chatByNo(no){ return (st ? st.chats : []).filter(function(c){ return c.no === no; })[0] || null; }
function queueWaitMs(q){ return now() - q.queuedAt; }

/* ===== Рендер ===== */
var root = null;
var timerId = null;
function ensureTimer(){
  if (window.__shiftTimer) return;
  window.__shiftTimer = setInterval(function(){ try { tick(); } catch(e){} }, 500);
}
function render(){
  if (!root) root = document.getElementById("tab-shift");
  if (!root) return;
  ensureTimer();
  st = load();
  if (!st){ renderSetup(); return; }
  if (!st.finished && now() >= st.endsAt){ finish("time"); return; }
  if (st.finished) renderReport();
  else renderShift();
}
function renderSetup(){
  var html = '<div class="card"><h3>🕹 Live Shift — робоча зміна</h3>' +
    '<p class="muted small">Клієнти приходять за розкладом, паралельні чати, терпіння клієнта (90 с — «Ало?», 3 хв — пішов), FRT/AHT/Resolution. Стан у localStorage — перезавантаження не ламає зміну. XP: бонус за зміну (середній QA ≥ 70 і без FORBIDDEN); тікети зміни streak-множників не дають.</p>' +
    '<div class="chiprow">';
  [15,30,45].forEach(function(m){
    html += '<button class="btn" data-sh-level="junior" data-sh-min="' + m + '">▶ Junior · ' + m + ' хв <small class="muted">(до 2 чатів)</small></button>';
  });
  html += '</div><div class="chiprow">';
  [15,30,45].forEach(function(m){
    html += '<button class="btn" data-sh-level="advanced" data-sh-min="' + m + '">▶ Advanced · ' + m + ' хв <small class="muted">(до 3 чатів)</small></button>';
  });
  html += '</div></div>';
  root.innerHTML = html;
  root.querySelectorAll("[data-sh-level]").forEach(function(b){
    b.addEventListener("click", function(){ start(b.dataset.shLevel, +b.dataset.shMin); });
  });
}
function statusText(c){ return { "new":"новий", "active":"в роботі", "waiting":"чекає клієнта", "escalated":"ескальовано", "closed":"закрито" }[c.status] || c.status; }
function renderShift(){
  var sel = selectedChat();
  var html = '<div class="card">' +
    '<div class="row between"><h3>🕹 Зміна · ' + esc((st.level || "").toUpperCase()) + ' · ' + st.minutes + ' хв</h3>' +
    '<div><span id="shTimer" style="font-size:22px;font-weight:800">' + fmtMs(st.endsAt - now()) + '</span> <span class="muted small">до кінця</span></div></div>' +
    '<div class="chiprow"><span class="chip">Черга: <b id="shQueue">' + st.queue.length + '</b></span>' +
    '<span class="chip">Чекають відповіді: <b id="shWait">' + st.chats.filter(function(c){ return c.awaitingReply && !c.abandoned && c.status !== "closed"; }).length + '</b></span>' +
    '<span class="chip">Abandoned: <b>' + st.abandonedCount + '</b></span>' +
    '<button class="btn' + (st.operatorReady ? " primary" : "") + '" id="shReadyBtn">Оператор: ' + (st.operatorReady ? "Готовий ✓" : "Не готовий ✗") + '</button>' +
    '<button class="btn danger ghost" id="shFinishBtn">⏹ Завершити зміну</button></div>' +
    '<p class="small muted">«Не готовий» зупиняє нові призначення, але таймер зміни триває.</p></div>';
  html += '<div class="grid3">';
  /* ліва колонка — тікети і черга */
  html += '<div class="card"><h4>🎫 Тікети</h4>';
  if (!st.chats.length && !st.queue.length) html += '<p class="muted small">Черга порожня — очікуємо клієнтів…</p>';
  st.queue.forEach(function(q){
    html += '<div class="factrow">⏳ Черга №' + q.no + ' <span class="muted small">чекає ' + Math.round(queueWaitMs(q)/1000) + ' с</span></div>';
  });
  st.chats.slice().reverse().forEach(function(c){
    html += '<div class="factrow' + (sel && c.no === sel.no ? '" style="font-weight:700' : '') + '">' +
      '<a href="#" data-open-chat="' + c.no + '">№' + c.no + ' · ' + esc(c.sid) + '</a> · ' + statusText(c) +
      (c.abandoned ? ' 🚪' : '') + '</div>';
  });
  html += '</div>';
  /* центр — чат */
  html += '<div class="card" style="flex:1"><h4>💬 Чат' + (sel ? ' №' + sel.no : '') + '</h4>';
  if (sel && sel.status !== "closed" && !sel.abandoned){
    var sc = scenOf(sel);
    html += '<div style="max-height:260px;overflow:auto;border:1px solid var(--border);padding:8px;border-radius:8px;margin:8px 0">';
    html += '<div class="factrow"><b>Клієнт:</b> ' + esc(sc ? sc.first : "") + '</div>';
    for (var f = 0; f < sel.clientStep && f < (sc.follows || []).length; f++){
      html += '<div class="factrow"><b>Клієнт:</b> ' + esc(sc.follows[f]) + '</div>';
    }
    (sel.clientMsgs || []).forEach(function(m){ html += '<div class="factrow"><b>Клієнт:</b> ' + esc(m) + '</div>'; });
    sel.answers.forEach(function(a){ html += '<div class="factrow" style="color:var(--accent)"><b>Ви:</b> ' + esc(a) + '</div>'; });
    html += '</div>';
    html += '<textarea id="shInput" rows="3" style="width:100%" placeholder="Відповідь клієнту… (Ctrl+Enter — відправити)">' + esc(sel.draft || "") + '</textarea>' +
      '<div class="row end" style="margin-top:6px">' +
      '<button class="btn" id="shHold"' + (sel.holdUsed ? " disabled" : "") + '>⏸ Холд</button>' +
      '<button class="btn" id="shEscBtn">⬆ Ескалювати' + (sel.escalation ? ": " + esc(sel.escalation.dept) : "") + '</button>' +
      '<button class="btn" id="shSend">Надіслати</button>' +
      '<button class="btn primary" id="shClose">🔒 Закрити тікет</button></div>' +
      '<div id="shEscBox" style="display:none"></div>' +
      '<p class="small muted">Статус: ' + statusText(sel) + ' · FRT: ' + (sel.firstReplyAt ? Math.round((sel.firstReplyAt - sel.openedAt)/1000) + " с" : "—") +
      ' · холд: ' + (sel.holdUsed ? "використано" : "доступний") + '</p>';
  } else if (sel) {
    html += '<p class="small muted">Тікет №' + sel.no + ' закрито' + (sel.abandoned ? " — клієнт пішов (abandoned)" : "") + '. Оцінка — у звіті зміни.</p>';
  } else {
    html += '<p class="muted small">Активних чатів немає — клієнти прибудуть за розкладом.</p>';
  }
  html += '</div>';
  /* права колонка — адмінка + база знань */
  html += '<div class="card"><h4>🗂 Адмінка · 📚 База</h4>';
  if (sel){
    var sc = scenOf(sel);
    var o = sc ? sc.order : null;
    html += o ? '<div class="factrow"><b>' + esc(o.num) + '</b> · ' + esc(o.status) + '<br>' + esc(o.items) + '<br>' + esc(o.sum) + ' · ' + esc(o.pay) + '<br>' + esc(o.deliv) + (o.ttn ? '<br>ТТН: ' + esc(o.ttn) : '') + '<br>' + esc(o.city) + '</div>'
      : '<p class="muted small">Без даних замовлення.</p>';
    html += '<hr>';
    (window.KB || []).slice(0, 8).forEach(function(k){ html += '<div class="factrow small"><b>' + esc(k.t) + '</b> — ' + esc(k.d) + '</div>'; });
  } else html += '<p class="muted small">Відкрийте тікет.</p>';
  html += '</div></div>';
  root.innerHTML = html;

  root.querySelectorAll("[data-open-chat]").forEach(function(b){
    b.addEventListener("click", function(e){ e.preventDefault(); openChat(+b.dataset.openChat); });
  });
  var ready = document.getElementById("shReadyBtn");
  if (ready) ready.addEventListener("click", function(){ st.operatorReady = !st.operatorReady; save(); render(); });
  var fin = document.getElementById("shFinishBtn");
  if (fin) fin.addEventListener("click", function(){ if (confirm("Завершити зміну зараз? Незакриті чати буде оцінено як є.")) finish("early"); });
  var inp = document.getElementById("shInput");
  if (inp){
    inp.addEventListener("input", function(){ var c = selectedChat(); if (c){ c.draft = inp.value; save(); } });
    inp.addEventListener("keydown", function(e){ if ((e.ctrlKey||e.metaKey) && e.key === "Enter") sendAnswer(); });
  }
  var send = document.getElementById("shSend");
  if (send) send.addEventListener("click", sendAnswer);
  var hold = document.getElementById("shHold");
  if (hold) hold.addEventListener("click", holdChat);
  var cl = document.getElementById("shClose");
  if (cl) cl.addEventListener("click", function(){ var c = selectedChat(); if (c){ closeChat(c.no); } });
  var escb = document.getElementById("shEscBtn");
  if (escb) escb.addEventListener("click", function(){
    var box = document.getElementById("shEscBox");
    if (!box || !sel) return;
    if (box.style.display === "none"){
      var depts = (window.Escalation && window.Escalation.DEPTS) || [];
      var prios = (window.Escalation && window.Escalation.PRIORITIES) || [];
      box.innerHTML = '<div class="row"><select id="shEscDept" style="flex:1">' +
        depts.map(function(d){ return '<option value="' + esc(d) + '"' + (sel.escalation && sel.escalation.dept === d ? " selected" : "") + '>' + esc(d) + '</option>'; }).join("") +
        '</select><select id="shEscPrio" style="width:170px">' +
        prios.map(function(p){ return '<option value="' + esc(p) + '"' + (sel.escalation && sel.escalation.priority === p ? " selected" : "") + '>пріоритет: ' + esc(p) + '</option>'; }).join("") +
        '</select></div>' +
        '<textarea id="shEscNote" rows="2" style="width:100%;margin-top:6px" placeholder="Внутрішня нотатка: № замовлення, суть проблеми, що зроблено. Клієнт її не бачить.">' + esc(sel.escalation ? sel.escalation.note : "") + '</textarea>' +
        '<div class="row end" style="margin-top:6px"><button class="btn primary" id="shEscConfirm">Підтвердити ескалацію</button></div>';
      box.style.display = "";
      document.getElementById("shEscConfirm").addEventListener("click", function(){
        var c = selectedChat();
        c.escalation = { dept: document.getElementById("shEscDept").value,
          priority: document.getElementById("shEscPrio").value,
          note: document.getElementById("shEscNote").value,
          atAnswerIndex: c.answers.length };
        c.status = "escalated";
        save(); render();
      });
    } else { box.style.display = "none"; }
  });
}
function renderReport(){
  var r = st.report || {};
  var html = '<div class="card"><h3>🕹 Звіт зміни</h3>' +
    '<p class="muted small">' + st.minutes + ' хв · ' + esc((st.level || "").toUpperCase()) +
    ' · причина: ' + (st.reason === "time" ? "час вийшов" : st.reason === "early" ? "завершено достроково" : "усі чати закрито") +
    ' · метрики з навчальної симуляції, не з реальної роботи.</p>' +
    '<div class="statcards">' +
    '<div class="statcard"><div class="v">' + (r.avgFrt != null ? r.avgFrt + " с" : "—") + '</div><div class="l">FRT (перша відповідь)</div></div>' +
    '<div class="statcard"><div class="v">' + (r.aht != null ? r.aht + " с" : "—") + '</div><div class="l">AHT (обробка)</div></div>' +
    '<div class="statcard"><div class="v">' + (r.resolution != null ? r.resolution + "%" : "—") + '</div><div class="l">Resolution Rate</div></div>' +
    '<div class="statcard"><div class="v">' + (r.abandoned || 0) + '</div><div class="l">abandoned</div></div>' +
    '<div class="statcard"><div class="v">' + (r.avgQa != null ? r.avgQa : "—") + '</div><div class="l">середній QA /100</div></div>' +
    '<div class="statcard"><div class="v">' + (r.xpBonus ? "+" + r.xpBonus : "0") + '</div><div class="l">XP бонус за зміну</div></div></div>';
  html += '<h4>💡 3 головні поради</h4>';
  (r.tips || []).forEach(function(t, i){ html += '<div class="factrow"><b>' + (i+1) + '.</b> ' + esc(t) + '</div>'; });
  html += '<h4>💬 Розбір чатів</h4><table class="scoretab" style="width:100%"><tr><th>№</th><th>Сценарій</th><th>Статус</th><th>FRT</th><th>Факти</th><th>QA /100</th><th>Зауваження</th></tr>';
  st.chats.forEach(function(c){
    var res = c.result || {};
    var stTxt = c.abandoned ? "abandoned" : (c.status === "closed" ? "закрито" : statusText(c));
    var notes = [];
    if (res.garbage) notes.push("порожньо/сміття");
    if (res.contradictions > 0) notes.push("суперечить еталону");
    if ((res.forb || []).length) notes.push("FORBIDDEN: " + res.forb.join("; "));
    if (res.esc && res.esc.missed) notes.push("пропущена ескалація: " + res.esc.dept);
    if (res.esc && res.esc.escalated && !res.esc.deptOk && res.esc.required) notes.push("ескалація не в той відділ");
    html += '<tr><td>№' + c.no + '</td><td>' + esc(c.sid) + '</td><td>' + stTxt + '</td><td>' +
      (c.firstReplyAt && c.openedAt ? Math.round((c.firstReplyAt - c.openedAt)/1000) + " с" : "—") + '</td><td>' + (res.factPct || 0) + '%</td><td><b>' + (res.qa100 || 0) + '</b></td><td class="small">' + esc(notes.join(" · ") || "—") + '</td></tr>';
  });
  html += '</table><div class="row end" style="margin-top:10px"><button class="btn primary" id="shAgain">Нова зміна</button></div></div>';
  root.innerHTML = html;
  var again = document.getElementById("shAgain");
  if (again) again.addEventListener("click", function(){ wipe(); render(); });
}
function sendAnswer(){
  if (!st || st.finished) return;
  var c = selectedChat();
  if (!c || c.status === "closed" || c.abandoned) return;
  var sc = scenOf(c);
  var text = (c.draft || "").trim();
  if (!text) return;
  if (c.firstReplyAt == null) c.firstReplyAt = now();   /* FRT */
  c.answers.push(text);
  c.awaitingReply = false;
  if (c.clientStep < 1 + (sc.follows || []).length) c.clientStep++;
  c.status = (c.clientStep < 1 + (sc.follows || []).length) ? "active" : "waiting";
  c.draft = "";
  save(); render();
}
function openChat(no){
  if (!st || st.finished) return;
  var c = chatByNo(no);
  if (!c || c.status !== "new") { st.selectedNo = no; save(); render(); return; }
  c.status = "active";
  c.openedAt = now();
  c.lastClientMsgAt = now();
  st.selectedNo = no;
  save(); render();
}
function closeChat(no){
  if (!st || st.finished) return;
  var c = chatByNo(no);
  if (!c || c.status === "closed" || c.abandoned) return;
  c.closedAt = now();
  c.status = "closed";
  c.result = evaluateChat(c);
  save(); render();
}
function updateTimerOnly(){
  var el = document.getElementById("shTimer");
  if (el && st) el.textContent = fmtMs(st.endsAt - now());
  var q = document.getElementById("shQueue");
  if (q && st) q.textContent = String(st.queue.length);
  var w = document.getElementById("shWait");
  if (w && st) w.textContent = String(st.chats.filter(function(c){ return c.awaitingReply && !c.abandoned && c.status !== "closed"; }).length);
}
/* --- Архів змін (для статистики та експорту) --- */
var ARCHIVE_KEY = "technodimShift.history.v1";
function getArchive(){ try { var raw = localStorage.getItem(ARCHIVE_KEY); var a = raw ? JSON.parse(raw) : []; return (a && a.push) ? a : []; } catch(e){ return []; } }
function setArchive(a){ try { localStorage.setItem(ARCHIVE_KEY, JSON.stringify(a || [])); } catch(e){} }

window.Shift = {
  render: render,
  isActive: function(){ return !!st && !st.finished; },
  getArchive: getArchive,
  setArchive: function(a){ try { localStorage.setItem(ARCHIVE_KEY, JSON.stringify(a || [])); } catch(e){} },
  /* тестові хуки: підміна годинника і seed — тільки до/під час тестової зміни */
  test: {
    setClock: function(fn){ testClockFn = fn || null; },
    clearClock: function(){ testClockFn = null; },
    seed: function(n){ rng = mulberry32(n); },
    state: function(){ return st; },
    tick: tick,
    send: sendAnswer,
    close: closeChat,
    hold: holdChat,
    select: function(no){ if (st){ st.selectedNo = no; } },
    finishNow: function(){ if (st && !st.finished){ st.endsAt = now(); finish("time"); } }
  }
};
})();
