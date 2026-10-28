/* Escalation System — Етап 3 (Trainer 2.0). Окремий модуль:
   розмітка сценаріїв (обов'язкова/зайва ескалація), відділи, оцінювання.
   Клієнт внутрішньої нотатки не бачить. Підтримується і поле scen.escalate. */
(function(){
"use strict";
var DEPTS = ["Склад/логістика", "Фінанси/повернення коштів", "Сервіс/гарантія", "Технічний відділ", "Старший зміни"];
var PRIORITIES = ["низький", "середній", "високий"];

/* Розмітка сценаріїв: required=true — ескалація справді потрібна (пропуск = стеля 5/10);
   required=false — оператор має вирішити сам (ескаляція = мінус до Policy). */
var MAP = {
  /* --- Склад/логістика: загублені/не знайдені посилки, зриви кур'єра, чужі посилки --- */
  "DLV-07": { dept:"Склад/логістика", required:true, why:"Посилку не знайдено на відділенні двічі — потрібна офіційна претензія і ревізія сектора складом." },
  "DLV-13": { dept:"Склад/логістика", required:true, why:"Посилку втрачено в дорозі — претензія перевізнику і рішення по втраті поза повноваженнями оператора." },
  "DLV-20": { dept:"Склад/логістика", required:true, why:"Кур'єр зірвав доставку — системна скарга на службу доставки через логістику." },
  "DLV-25": { dept:"Склад/логістика", required:true, why:"Телевізор не прибув у строк, статус завис — розслідування перевізника." },
  "DLV-29": { dept:"Склад/логістика", required:true, why:"Замовлення на 26 400 грн зникло без статусів — втрата, рішення поза повноваженнями оператора." },
  "CMP-01": { dept:"Склад/логістика", required:true, why:"Два зриви кур'єра підряд — системна скарга на службу доставки." },
  "CMP-02": { dept:"Склад/логістика", required:true, why:"У запечатаній посилці чужий товар — переплутання складу, ревізія і розшук обох посилок." },
  "CPX-02": { dept:"Склад/логістика", required:true, why:"Статус «готово до видачі», посилки на місці немає двічі — ревізія відділення." },
  "CPX-03": { dept:"Склад/логістика", required:true, why:"Зрив кур'єрської доставки плюс помилково списані 120 грн — скарга і перерахунок." },
  "CPX-06": { dept:"Склад/логістика", required:true, why:"Статус «Доставлено» без отримання — можлива видача не тому покупцю, потрібна звірка." },
  /* --- Фінанси/повернення коштів: подвійні списання, завислі платежі, затримки переказів --- */
  "PAY-02": { dept:"Фінанси/повернення коштів", required:true, why:"Подвійне списання — відкат платежу виконує фінансовий відділ." },
  "PAY-08": { dept:"Фінанси/повернення коштів", required:true, why:"Банк підтвердив платіж, а система його не бачить — розбір на боці фінансів." },
  "RET-08": { dept:"Фінанси/повернення коштів", required:true, why:"Повернення прийнято, переказ затягнувся понад строк — запит у фінансовий відділ." },
  "CMP-06": { dept:"Фінанси/повернення коштів", required:true, why:"Списано більше за ціну сайту через збій — перерахунок і службове розслідування." },
  "CMP-07": { dept:"Фінанси/повернення коштів", required:true, why:"Реклама обіцяла −20%, застосувалось −10% — перерахунок різниці і виправлення акції." },
  "CPX-14": { dept:"Фінанси/повернення коштів", required:true, why:"Подвійне списання плюс скасування — два відкати і координація з банком." },
  "CPX-18": { dept:"Фінанси/повернення коштів", required:true, why:"Розбіжність суми післяплати на відділенні — звірка переказів з фінансами." },
  "RUD-04": { dept:"Фінанси/повернення коштів", required:true, why:"Подвійне списання на тлі грубого тону — відкат плюс нагляд старшого." },
  "ENG-09": { dept:"Фінанси/повернення коштів", required:true, why:"Double payment — the refund request is handled by the finance department." },
  /* --- Сервіс/гарантія: брак після ремонту, строк ремонту на межі --- */
  "GAR-05": { dept:"Сервіс/гарантія", required:true, why:"Той самий вузол зламався вдруге після ремонту — заміна за правилами, рішення сервісного керівника." },
  "GAR-10": { dept:"Сервіс/гарантія", required:true, why:"Ремонт близький до межі 14 робочих днів — контроль сервісного центру на рівні керівництва." },
  /* --- Старший зміни: злам акаунта, погрози, звинувачення у крадіжці --- */
  "CPX-04": { dept:"Старший зміни", required:true, why:"Скасування з акаунта, якого клієнт не робив — підозра на злом, протокол безпеки." },
  "RUD-03": { dept:"Старший зміни", required:true, why:"Погрози фізичного скандалу — передаємо старшому зміни, турбота про безпеку." },
  "RUD-07": { dept:"Старший зміни", required:true, why:"Звинувачення у крадіжці і заява в банк/поліцію — офіційна ескалація старшому." },
  /* --- Ескалація зайва: оператор вирішує сам --- */
  "DLV-01": { dept:null, required:false, why:"Затримка відправки — оператор вирішує сам: позачергова збірка і контроль." },
  "CPX-01": { dept:null, required:false, why:"Затримка і зміна відділення — обидва кроки в межах повноважень оператора." },
  "CAN-03": { dept:null, required:false, why:"Скасування в дорозі — стандартна процедура відкликання, оператор сам." },
  "PAY-05": { dept:null, required:false, why:"Відхилений платіж — ліміт банку, оператор пропонує резерв і післяплату." },
  "SUR-12": { dept:null, required:false, why:"SMS не доходять — повторна відправка і порада, без ескалації." },
  "ENG-11": { dept:null, required:false, why:"Parcel in the wrong city — a redirection request is a routine operator action." },
  "CPX-24": { dept:null, required:false, why:"Помилкова адреса підписки і резерв товару — оператор виправляє сам." }
};

function forScenario(scen){
  if (scen && scen.escalate) return scen.escalate;
  if (scen && MAP[scen.id]) return MAP[scen.id];
  return null;
}
/* Нотатка вважається змістовною, якщо є номер замовлення/ТТН (3+ цифри) або щонайменше 60 символів суті */
function noteOk(note){
  return /\d{3,}/.test(String(note || "")) || String(note || "").trim().length >= 60;
}
/* Чи після ескалації (з позиції atAnswerIndex) оператор написав клієнту про передачу і строк */
function notifiedAfter(answers, fromIdx){
  var transfer = ["передав","передаю","передано","передам","ескал","старшого","старшому","відділу","колег",
    "фінансов","сервісн","склад","запит","претенз","банк"];
  var time = ["протягом","годин","годину","днів","завтра","сьогодні","24"];
  var arr = answers || [];
  for (var i = Math.max(0, fromIdx || 0); i < arr.length; i++){
    var low = String(arr[i]).toLowerCase();
    var hasT = transfer.some(function(m){ return low.indexOf(m) !== -1; });
    var hasTime = time.some(function(m){ return low.indexOf(m) !== -1; }) || low.indexOf("?") !== -1;
    if (hasT && hasTime) return true;
  }
  return false;
}
/* Оцінка ескалації: бонус/частково/пропущена/зайва + мінуси нотатки і повідомлення клієнту */
function assess(scen, esc, answers){
  var spec = forScenario(scen);
  var res = { spec: spec, required: !!(spec && spec.required), self: !!(spec && !spec.required),
    dept: spec ? spec.dept : null, why: spec ? spec.why : null,
    escalated: !!esc, deptOk: false, noteMissing: false, notifyMissing: false,
    missed: false, unnecessary: false, bonus: 0 };
  if (!res.required){
    if (esc) res.unnecessary = true;   /* ескалація там, де оператор має вирішити сам */
    return res;
  }
  if (!esc){ res.missed = true; return res; }
  res.deptOk = esc.dept === spec.dept;
  res.wrongDept = !res.deptOk;   /* Етап 3 правка: не той відділ — помилка (клієнт втрачає час) */
  res.noteMissing = !noteOk(esc.note);
  res.notifyMissing = !notifiedAfter(answers, esc.atAnswerIndex);
  if (res.deptOk && !res.noteMissing && !res.notifyMissing) res.bonus = 15;
  /* часткового +5 більше немає: не той відділ = стеля 7/10 і −Policy (scoreAnswers) */
  return res;
}

window.Escalation = { DEPTS: DEPTS, PRIORITIES: PRIORITIES, for: forScenario, assess: assess,
  noteOk: noteOk, notifiedAfter: notifiedAfter };
})();
