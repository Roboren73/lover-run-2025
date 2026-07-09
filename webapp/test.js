// JS 引擎测试，对齐 guandan/test_core.py。运行：node webapp/test.js
const G = require("./guandan.js");
const LV = 2;
const C = (r, s = "S") => G.card(r, s);
const cl = (cards) => G.classify(cards, LV);
let total = 0, failed = 0;
function check(name, cond) {
  total++;
  if (!cond) { failed++; console.log("[FAIL] " + name); }
  else console.log("[PASS] " + name);
}

check("单张A", cl([C(14)]).category === "single");
check("对子KK", cl([C(13, "S"), C(13, "H")]).category === "pair");
check("三同999", cl([C(9, "S"), C(9, "H"), C(9, "D")]).category === "triple");
check("三带二999+44", cl([C(9, "S"), C(9, "H"), C(9, "D"), C(4, "S"), C(4, "H")]).category === "full_house");
check("顺子34567", cl([C(3, "S"), C(4, "H"), C(5, "D"), C(6, "C"), C(7, "S")]).category === "straight");
check("顺子A2345低", cl([C(14, "S"), C(3, "H"), C(4, "D"), C(5, "C"), C(2, "S")]) !== null);
check("顺子10JQKA高", cl([C(10, "S"), C(11, "H"), C(12, "D"), C(13, "C"), C(14, "S")]).category === "straight");
check("三连对334455", cl([C(3, "S"), C(3, "H"), C(4, "S"), C(4, "H"), C(5, "S"), C(5, "H")]).category === "consec_pairs");
check("钢板555666", cl([C(5, "S"), C(5, "H"), C(5, "D"), C(6, "S"), C(6, "H"), C(6, "D")]).category === "consec_triples");
check("炸弹8888", cl([C(8, "S"), C(8, "H"), C(8, "D"), C(8, "C")]).isBomb);
check("同花顺黑34567", cl([C(3, "S"), C(4, "S"), C(5, "S"), C(6, "S"), C(7, "S")]).category === "straight_flush");
check("天王炸", cl([G.card(16, null), G.card(16, null), G.card(17, null), G.card(17, null)]).category === "joker_bomb");
check("非法王混对子", cl([G.card(16, null), C(5)]) === null);

check("单A>K", G.beats(cl([C(14)]), cl([C(13)])));
check("级牌2>A单", G.beats(cl([C(2, "S")]), cl([C(14)])));
check("大王>级牌", G.beats(cl([G.card(17, null)]), cl([C(2, "S")])));
check("对AA>对KK", G.beats(cl([C(14, "S"), C(14, "H")]), cl([C(13, "S"), C(13, "H")])));
check("炸>顺", G.beats(cl([C(8, "S"), C(8, "H"), C(8, "D"), C(8, "C")]), cl([C(3, "S"), C(4, "H"), C(5, "D"), C(6, "C"), C(7, "S")])));
const sf = cl([C(3, "S"), C(4, "S"), C(5, "S"), C(6, "S"), C(7, "S")]);
const b5 = cl([C(9, "S"), C(9, "H"), C(9, "D"), C(9, "C"), C(9, "S")]);
const b6 = cl([C(8, "S"), C(8, "H"), C(8, "D"), C(8, "C"), C(8, "S"), C(8, "H")]);
check("同花顺>5张炸", G.beats(sf, b5));
check("6张炸>同花顺", G.beats(b6, sf));
check("天王炸>6张炸", G.beats(cl([G.card(16, null), G.card(16, null), G.card(17, null), G.card(17, null)]), b6));
check("同长同顺不算压", !G.beats(cl([C(3, "S"), C(4, "H"), C(5, "D"), C(6, "C"), C(7, "S")]), cl([C(3, "S"), C(4, "H"), C(5, "D"), C(6, "C"), C(7, "S")])));

const wild = C(2, "H");
const pw = G.classify([C(13, "S"), wild], LV);
check("百搭+K=对K", pw && pw.category === "pair" && pw.rank === 13);
check("百搭凑炸999+W", G.classify([C(9, "S"), C(9, "H"), C(9, "D"), wild], LV).isBomb);
check("百搭补顺34_67", G.classify([C(3, "S"), C(4, "D"), wild, C(6, "C"), C(7, "S")], LV).category === "straight");

// advise sanity
const hand = [C(3, "S"), C(3, "H"), C(4, "D"), C(5, "C"), C(6, "S"), C(9, "S"), C(9, "H"), C(9, "D"), C(9, "C"), C(14, "S")];
const r1 = G.advise(hand, null, LV, { mySeat: 0 });
check("首家不拆四个9", r1.action === "play" && !r1.combo.cards.some((c) => c.rank === 9));
const cur = G.classify([C(8, "S"), C(8, "D")], LV);
check("压对8出对9", G.advise(hand, cur, LV, { ownerSeat: 1, mySeat: 0, oppMinCards: 10 }).combo.rank === 9);
check("队友对8则过", G.advise(hand, cur, LV, { ownerSeat: 2, mySeat: 0, oppMinCards: 10 }).action === "pass");

// decompose 计划质量/合法性（曾出过王+百搭凑非法对的 bug）
const wild2 = C(2, "H");
const endgame = [G.card(16, null), wild2];
const eplan = G.decompose(endgame, LV);
check("王+百搭 计划全合法", eplan.every((m) => G.classify(m.cards, LV) !== null));
check("王+百搭 lead建议合法", G.classify(G.leadV2(endgame, LV).cards, LV) !== null);
const fhp = G.decompose([C(9, "S"), C(9, "H"), C(9, "D"), C(4, "S"), C(4, "H")], LV);
check("999+44 并成三带二一手", fhp.length === 1 && fhp[0].category === "full_house");
const stp = G.decompose([C(3, "S"), C(4, "D"), C(6, "C"), C(7, "S"), wild2], LV);
check("34_67+百搭 组成一手顺子", stp.length === 1 && stp[0].category === "straight");
// 随机手牌×20：拆解覆盖全部牌且全部合法
(function(){
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const RANKS = [];
  for (let r = 2; r <= 14; r++) RANKS.push(r);
  for (let trial = 0; trial < 20; trial++) {
    const deck = [];
    for (let d = 0; d < 2; d++) {
      for (const s of ["S","H","D","C"]) for (const r of RANKS) deck.push(G.card(r, s));
      deck.push(G.card(16, null)); deck.push(G.card(17, null));
    }
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    const rh = deck.slice(0, 27);
    const rp = G.decompose(rh, LV);
    const covered = rp.reduce((s, m) => s + m.length, 0) === 27;
    const legal = rp.every((m) => G.classify(m.cards, LV) !== null);
    if (!covered || !legal) { check(`随机27张 第${trial}组 拆解覆盖且全合法`, false); return; }
  }
  check("随机27张×20组 拆解覆盖全部牌且全部合法", true);
})();

// 引擎可插拔：不传 engine 时行为不变；显式切到 v1_heuristic 应正常工作；未知引擎名应报错
const rDefault = G.advise(hand, null, LV, { mySeat: 0 });
const rV2 = G.advise(hand, null, LV, { mySeat: 0, engine: "v2_plan" });
check("默认引擎==v2_plan(向后兼容)", G.comboStr(rDefault.combo) === G.comboStr(rV2.combo));
const rV1 = G.advise(hand, null, LV, { mySeat: 0, engine: "v1_heuristic" });
check("v1_heuristic可正常出建议", rV1.action === "play" && !!rV1.combo);
let threw = false;
try { G.advise(hand, null, LV, { engine: "not_a_real_engine" }); } catch (e) { threw = true; }
check("未知引擎名报错", threw);
G.registerEngine("echo_first_single", {
  lead: (h) => ({ category: "single", length: 1, rank: h[0].rank, cards: [h[0]], isBomb: false }),
  follow: () => null,
});
const rCustom = G.advise(hand, null, LV, { mySeat: 0, engine: "echo_first_single" });
check("自定义引擎(对象形式)可直接注入", rCustom.combo.cards[0] === hand[0]);

// ===== 累加器（去误检投票 + 删除封顶）=====
const { createAccumulator } = require("./accum.js");
const fc = (obj) => new Map(Object.entries(obj)); // {"9S":1} -> Map

// 1) 单帧闪现的误检(幽灵牌)不入表
let acc = createAccumulator({ confirmFrames: 2 });
acc.addFrame(fc({ "9S": 1, "13H": 1 }));       // 13H 是一次性误检
acc.addFrame(fc({ "9S": 1 }));
check("幽灵牌单帧闪现不入表", acc.counts().get("13H") === undefined);
check("真牌连续2帧确认入表", acc.counts().get("9S") === 1);

// 2) 单张识别(instant)跳过投票直接入表
acc = createAccumulator({ confirmFrames: 2 });
acc.addFrame(fc({ "5C": 1 }), true);
check("instant单帧直接入表", acc.counts().get("5C") === 1);

// 3) 1份升2份也要再次确认
acc = createAccumulator({ confirmFrames: 2 });
acc.addFrame(fc({ "9S": 1 })); acc.addFrame(fc({ "9S": 1 }));
acc.addFrame(fc({ "9S": 2 }));
check("升到2份前仍是1份", acc.counts().get("9S") === 1);
acc.addFrame(fc({ "9S": 2 }));
check("2份连续2帧后确认", acc.counts().get("9S") === 2);

// 4) 删除减一份，且封顶：扫描不会自动加回
acc.remove("9S");
check("删除后剩1份", acc.counts().get("9S") === 1);
acc.addFrame(fc({ "9S": 2 })); acc.addFrame(fc({ "9S": 2 }));
check("删除封顶：不再自动回到2份", acc.counts().get("9S") === 1);
acc.remove("9S");
acc.addFrame(fc({ "9S": 1 })); acc.addFrame(fc({ "9S": 1 }));
check("删到0后不再自动加回", acc.counts().get("9S") === undefined);

// 5) 清空恢复一切(含封顶)
acc.clear();
acc.addFrame(fc({ "9S": 1 })); acc.addFrame(fc({ "9S": 1 }));
check("清空后封顶解除、可重新累加", acc.counts().get("9S") === 1);

// 6) 超过两副牌上限被截到2
acc = createAccumulator({ confirmFrames: 1 });
acc.addFrame(fc({ "9S": 5 }));
check("同一张最多2份(两副牌)", acc.counts().get("9S") === 2);

console.log(`\n结果: ${total - failed}/${total} 通过` + (failed ? ` ，${failed} 失败 ❌` : "，全部通过 ✅"));
process.exit(failed ? 1 : 0);
