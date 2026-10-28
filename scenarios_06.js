/* ТехноДім Support Trainer — частина 6/12.
   Англомовна практика (Етап 4): повернення/refund, верифікація акаунта,
   подвійне списання, затримка митниці, грубий клієнт. Разом 5 сценаріїв. */
(function(){
window.SCENARIOS.push(
s("ENG-14","англомовний клієнт",2,"спокійний",
"Hello! I bought a coffee maker two weeks ago, but my wife gave me the same one for my birthday. I want to return yours and get a refund. The box is still sealed.",
["Order 28012, I paid with card.","How long does the refund take?"],
"Hello! Good news: the box is sealed and the purchase is within 14 days, so the return is accepted without any questions. I will create a return request for order 28012 right now and send you the return TTN in an SMS — just bring the parcel to any Nova Poshta branch, the return delivery is on us. After the warehouse checks the coffee maker, the money will go back to your card within 3–5 working days. Anything else I can help you with?",
["refund","28012","14 days","3–5 working","sms"],
["G","U","R","N","K","F"],
{num:"28012",status:"Доставлено",date:"14.10",items:"Coffee maker NordLine KC-700",sum:"4 690 грн",pay:"Картка онлайн",deliv:"Нова пошта, відділення №12",ttn:"20450440011223",city:"Lviv"}),
s("ENG-15","англомовний клієнт",2,"розгублений",
"Hello! I can not log in to my account — the verification code from SMS does not come. I want to check my orders but the site does not let me in.",
["My phone number ends with 14.","Maybe I typed the number wrong when I registered?"],
"Hello! Let us fix the login step by step. First, check the Spam folder — sometimes the code lands there. Second, make sure the phone number in your profile is correct: a wrong digit at registration is the most common reason. If the code still does not come, I will send a one-time login link to your email — you can open your orders without the SMS code. I have also asked our side to resend codes to your number, so the next ones will arrive normally. If nothing works in ten minutes, write me here and we will verify your account manually.",
["code","spam","login link","verify","email"],
["G","E","R","N","K","B"]),
s("ENG-16","англомовний клієнт",4,"злий",
"Hello?! Your website charged me TWICE for one order — 4 380 and 4 380! I see two payments in my banking app and I am not paying for your mistakes!",
["Order 28047, the payments were at 10:12 and 10:13.","I want my money back this week, not next month!"],
"Hello! I am very sorry — you are right, and we will fix it. For order 28047 I confirm the double charge at 10:12 and 10:13: one payment paid for the order, the second one must be refunded. I have already sent the refund request to our finance department — the bank returns such payments to your card within 3–5 working days. You will get the request number in an SMS in one hour, so you can show it in your banking app if needed. The order itself is paid correctly and goes to packing today. I will personally check the refund tomorrow morning and write you here.",
["28047","double","refund","3–5 working","sms"],
["G","A","E","U","R","N"],
{num:"28047",status:"В обробці (подвійне списання)",date:"26.10",items:"Air fryer Almeca AF-500",sum:"4 380 грн × 2",pay:"Картка онлайн",deliv:"Нова пошта, відділення №9",ttn:null,city:"Kyiv"}),
s("ENG-17","англомовний клієнт",3,"поспішає",
"Hello! My parcel with a coffee grinder is stuck in customs for three days already. The tracking says customs clearance. When will it finally move? I need it for a gift this weekend!",
["Order 28073, TTN 20450550033445.","Is there any way to speed it up?"],
"Hello! I understand the deadline pressure, so let me be precise. Customs clearance is a standard step for parcels with batteries — the grinder has a built-in battery pack. Usually it takes 1–2 days, sometimes up to three, and the tracking status updates after the release. I see your parcel entered clearance on Tuesday, so it should arrive by Friday — in time for the weekend. I cannot speed up the customs officers, but I will add a priority note to your order and check the status twice a day; if it is not released by Thursday evening, write me and we will discuss a replacement from local stock so your gift is safe.",
["28073","customs","friday","priority","thursday"],
["G","E","R","N","P","B"],
{num:"28073",status:"Митниця (очікує випуску)",date:"24.10",items:"Кавомолка Vitex CG-300 (вбудований акумулятор)",sum:"2 190 грн",pay:"Картка онлайн",deliv:"Нова пошта, відділення №4",ttn:"20450550033445",city:"Odesa"}),
s("ENG-18","англомовний клієнт",4,"злий",
"This is ridiculous! Third email I am writing about my fridge — nobody answers, your support is useless! I want a manager, NOW, not another copy-paste robot!",
["Order 28101, the fridge was delivered with a broken handle.","If I do not get a real answer today, I will record a video about your shop for fifty thousand people."],
"Hello! I hear you, and I am taking your case personally — no more copy-paste answers. I checked order 28101: the fridge was delivered with a damaged handle, and we will replace the handle free of charge this week; the courier brings it and installs it, you do not pay anything. I also raised a complaint about the slow answers — my name will be on this ticket from now on, and I will write you an update today before 18:00. A video is not necessary: if anything goes wrong, you can reach me directly in this chat. Is the fridge cooling normally otherwise?",
["28101","handle","free","18:00","personally"],
["G","C","E","R","N","B"],
{num:"28101",status:"Доставлено (пошкоджена ручка)",date:"26.10",items:"Холодильник Domet DF-45 (дверна ручка пошкоджена)",sum:"17 400 грн",pay:"Картка онлайн",deliv:"Нова пошта, кур'єрська доставка",ttn:"20450551122334",city:"Kharkiv"})
);
window.KEYFACTS = window.KEYFACTS || {};
Object.assign(window.KEYFACTS, {
"ENG-14":[
 {l:"Sealed box + within 14 days — return accepted", s:["sealed","14 days"]},
 {l:"Return request created, TTN in SMS", s:["return request","ttn","sms"]},
 {l:"Return delivery is on us", s:["on us"]},
 {l:"Money back in 3–5 working days", s:["3–5","3-5"]},
 {l:"Offer of further help", s:["anything else"]}],
"ENG-15":[
 {l:"Step 1: check the Spam folder", s:["spam"]},
 {l:"Step 2: phone number in profile", s:["profile","phone number"]},
 {l:"One-time login link to email", s:["login link","email"]},
 {l:"Codes resent to the number", s:["resend"]},
 {l:"Manual account verification if needed", s:["verify","manually"]}],
"ENG-16":[
 {l:"Double charge confirmed (order 28047)", s:["double","28047"]},
 {l:"Refund request sent to finance", s:["refund request","finance"]},
 {l:"Bank returns in 3–5 working days", s:["3–5","3-5"]},
 {l:"Request number in SMS in one hour", s:["request number","sms"]},
 {l:"Order paid correctly, packing today", s:["paid correctly","packing"]}],
"ENG-17":[
 {l:"Customs is standard for battery parcels", s:["customs","batter"]},
 {l:"Usually 1–2 days, up to three", s:["1–2","1-2","up to three"]},
 {l:"Should arrive by Friday", s:["friday","should arrive"]},
 {l:"Priority note + twice-a-day checks", s:["priority note","twice a day"]},
 {l:"Replacement from local stock if not released", s:["replacement","local stock"]}],
"ENG-18":[
 {l:"Operator takes the case personally", s:["personally","my name"]},
 {l:"Handle replaced free of charge this week", s:["handle","free","week"]},
 {l:"Complaint raised about slow answers", s:["complaint","slow"]},
 {l:"Update today before 18:00", s:["18:00"]},
 {l:"No video needed — direct chat contact", s:["video","reach me"]}]
});
})();
