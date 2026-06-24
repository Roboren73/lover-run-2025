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

console.log(`\n结果: ${total - failed}/${total} 通过` + (failed ? ` ，${failed} 失败 ❌` : "，全部通过 ✅"));
process.exit(failed ? 1 : 0);
