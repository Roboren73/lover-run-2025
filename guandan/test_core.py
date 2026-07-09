#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""核心引擎单元测试。直接运行：python3 guandan/test_core.py"""
from core import Card, classify, beats, gen_moves, make_deck

LV = 2  # 测试用级牌：打 2


def C(r, s="S"):
    return Card(r, s)


def cl(cards):
    return classify(cards, LV)


def check(name, cond):
    status = "PASS" if cond else "FAIL"
    print(f"[{status}] {name}")
    if not cond:
        check.failed += 1
    check.total += 1


check.failed = 0
check.total = 0


def run():
    # --- 牌型识别 ---
    check("单张 A", cl([C(14)]).category == "single")
    check("对子 KK", cl([C(13, "S"), C(13, "H")]).category == "pair")
    check("三同 999", cl([C(9, "S"), C(9, "H"), C(9, "D")]).category == "triple")
    check("三带二 999+44",
          cl([C(9, "S"), C(9, "H"), C(9, "D"), C(4, "S"), C(4, "H")]).category == "full_house")
    # 用混合花色避免凑成同花顺
    s = cl([C(3, "S"), C(4, "H"), C(5, "D"), C(6, "C"), C(7, "S")])
    check("顺子 34567", s and s.category == "straight")
    check("顺子 A2345(低)", cl([C(14, "S"), C(3, "H"), C(4, "D"), C(5, "C"), C(2, "S")]) is not None)
    check("顺子 10JQKA(高)",
          cl([C(10, "S"), C(11, "H"), C(12, "D"), C(13, "C"), C(14, "S")]).category == "straight")
    check("三连对 334455",
          cl([C(3, "S"), C(3, "H"), C(4, "S"), C(4, "H"), C(5, "S"), C(5, "H")]).category == "consec_pairs")
    check("钢板 555666",
          cl([C(5, "S"), C(5, "H"), C(5, "D"), C(6, "S"), C(6, "H"), C(6, "D")]).category == "consec_triples")
    check("炸弹 8888",
          cl([C(8, "S"), C(8, "H"), C(8, "D"), C(8, "C")]).is_bomb)
    check("同花顺 黑桃34567",
          cl([C(3, "S"), C(4, "S"), C(5, "S"), C(6, "S"), C(7, "S")]).category == "straight_flush")
    check("天王炸",
          cl([Card(16, None), Card(16, None), Card(17, None), Card(17, None)]).category == "joker_bomb")
    check("非法：王混入对子被拒",
          cl([Card(16, None), C(5)]) is None)

    # --- 大小比较 ---
    check("单张 A > K", beats(cl([C(14)]), cl([C(13)])))
    check("级牌(2) > A 单张",
          beats(cl([C(2, "S")]), cl([C(14)])))
    check("大王 > 级牌",
          beats(cl([Card(17, None)]), cl([C(2, "S")])))
    check("对 AA > 对 KK",
          beats(cl([C(14, "S"), C(14, "H")]), cl([C(13, "S"), C(13, "H")])))
    check("炸弹 > 顺子",
          beats(cl([C(8, "S"), C(8, "H"), C(8, "D"), C(8, "C")]),
                cl([C(3, "S"), C(4, "H"), C(5, "D"), C(6, "C"), C(7, "S")])))
    check("6张炸 > 4张炸",
          beats(cl([C(8, "S")] * 1 + [C(8, "H"), C(8, "D"), C(8, "C"), C(8, "S"), C(8, "H")]),
                cl([C(7, "S"), C(7, "H"), C(7, "D"), C(7, "C")])))
    # 同花顺 介于 5张炸 与 6张炸 之间
    sf = cl([C(3, "S"), C(4, "S"), C(5, "S"), C(6, "S"), C(7, "S")])
    b5 = cl([C(9, "S"), C(9, "H"), C(9, "D"), C(9, "C"), C(9, "S")])
    b6 = cl([C(8, "S"), C(8, "H"), C(8, "D"), C(8, "C"), C(8, "S"), C(8, "H")])
    check("同花顺 > 5张炸", beats(sf, b5))
    check("6张炸 > 同花顺", beats(b6, sf))
    check("天王炸 > 6张炸",
          beats(cl([Card(16, None), Card(16, None), Card(17, None), Card(17, None)]), b6))
    check("顺子不能压更小同长顺子(同点不算压)",
          not beats(cl([C(3), C(4), C(5), C(6), C(7)]), cl([C(3), C(4), C(5), C(6), C(7)])))

    # --- 逢人配(红桃2 为级牌2 的百搭) ---
    wild = Card(2, "H")  # 级牌=2 时红桃2 是百搭
    pair_with_wild = classify([C(13, "S"), wild], LV)
    check("百搭 + K = 对K", pair_with_wild and pair_with_wild.category == "pair"
          and pair_with_wild.rank == 13)
    bomb_with_wild = classify([C(9, "S"), C(9, "H"), C(9, "D"), wild], LV)
    check("百搭凑炸弹 999+W", bomb_with_wild and bomb_with_wild.is_bomb)
    straight_with_wild = classify([C(3, "S"), C(4, "D"), wild, C(6, "C"), C(7, "S")], LV)
    check("百搭补顺子 34_67", straight_with_wild and straight_with_wild.category == "straight")

    # --- 出牌生成 sanity ---
    hand = [C(3), C(3, "H"), C(4), C(5), C(6), C(7), C(9, "S"), C(9, "H"), C(9, "D"), C(9, "C")]
    moves = gen_moves(hand, LV)
    cats = {m.category for m in moves}
    check("gen_moves 含 单/对/三/顺/炸",
          {"single", "pair", "straight", "bomb"}.issubset(cats))

    # --- 牌堆完整性 ---
    deck = make_deck()
    check("牌堆 108 张", len(deck) == 108)
    check("牌堆含 4 张王", sum(1 for c in deck if c.is_joker()) == 4)

    # --- decompose 计划质量 / 合法性（曾出过王+百搭凑非法对的 bug）---
    from strategy_v2 import decompose, lead_v2
    wildcard = Card(2, "H")
    endgame = [Card(16, None), wildcard]
    plan = decompose(endgame, LV)
    check("王+百搭 计划全合法", all(classify(m.cards, LV) is not None for m in plan))
    check("王+百搭 lead建议合法", classify(lead_v2(endgame, LV).cards, LV) is not None)
    fh = decompose([C(9, "S"), C(9, "H"), C(9, "D"), C(4, "S"), C(4, "H")], LV)
    check("999+44 并成三带二一手", len(fh) == 1 and fh[0].category == "full_house")
    st = decompose([C(3, "S"), C(4, "D"), C(6, "C"), C(7, "S"), wildcard], LV)
    check("34_67+百搭 组成一手顺子", len(st) == 1 and st[0].category == "straight")
    # 随机手牌全覆盖 + 全合法（防止贪心拆解丢牌/造非法组合）
    import random as _rnd
    rng = _rnd.Random(7)
    for trial in range(20):
        dk = make_deck()
        rng.shuffle(dk)
        rh = dk[:27]
        rp = decompose(rh, LV)
        if sum(m.length for m in rp) != 27 or \
           any(classify(m.cards, LV) is None for m in rp):
            check(f"随机27张 第{trial}组 拆解覆盖且全合法", False)
            break
    else:
        check("随机27张×20组 拆解覆盖全部牌且全部合法", True)

    print(f"\n结果: {check.total - check.failed}/{check.total} 通过"
          f"{'，全部通过 ✅' if check.failed == 0 else f'，{check.failed} 个失败 ❌'}")
    return check.failed == 0


if __name__ == "__main__":
    import sys
    sys.exit(0 if run() else 1)
