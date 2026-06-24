#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""V2 策略：基于"手牌拆解(最少出牌手数)"的规划型出牌。

核心思想（借鉴斗地主/掼蛋常用 AI 思路）：
  把整手牌贪心拆成尽量少的"出牌手数"(combos)——优先成炸弹/顺子/连对/三同，
  剩下凑对、单张。决策时：
    - 首家：按计划领出最该先走的小牌(不拆炸弹)。
    - 跟牌：只在"能用计划内的子牌型压过"时才出(出完后总手数下降)，否则过牌；
      对手快走完才动用炸弹拦截；不盖队友。
"""
from collections import defaultdict
from typing import List, Optional
from core import (Card, Combo, is_wild, order_value, bomb_tier, beats,
                  legal_responses)

# 连续窗口（与 core 对齐：A 可高可低），仅用自然牌成顺/连对/钢板
def _windows(size: int):
    res = []
    for start in range(1, 14 - size + 2):
        window = list(range(start, start + size))
        ranks = [14 if x == 1 else x for x in window]
        res.append((ranks, window[-1]))
    return res


def decompose(hand: List[Card], level: int) -> List[Combo]:
    """把手牌贪心拆成尽量少的出牌手数，返回 Combo 列表(覆盖全部牌)。"""
    pool = defaultdict(list)
    wilds: List[Card] = []
    jokers: List[Card] = []
    for c in hand:
        if c.is_joker():
            jokers.append(c)
        elif is_wild(c, level):
            wilds.append(c)
        else:
            pool[c.rank].append(c)

    combos: List[Combo] = []

    def ov(r):
        return order_value(r, level)

    # 1) 天王炸
    small = [c for c in jokers if c.rank == 16]
    big = [c for c in jokers if c.rank == 17]
    if len(small) >= 2 and len(big) >= 2:
        jb = small[:2] + big[:2]
        combos.append(Combo("joker_bomb", 4, 100, jb, True, (100, 0)))
        for c in jb:
            jokers.remove(c)

    # 2) 自然炸弹(>=4 同点)
    for r in list(pool.keys()):
        if len(pool[r]) >= 4:
            cards = pool[r][:]
            n = len(cards)
            combos.append(Combo("bomb", n, ov(r), cards, True,
                                (bomb_tier("bomb", n), ov(r))))
            pool[r] = []

    # 3) 顺子(仅自然牌, 长度5, 由低到高反复抽取)
    changed = True
    while changed:
        changed = False
        for ranks, top in _windows(5):
            if all(len(pool[r]) >= 1 for r in ranks):
                built = [pool[r].pop() for r in ranks]
                combos.append(Combo("straight", 5, top, built))
                changed = True

    # 4) 钢板(二连三)
    changed = True
    while changed:
        changed = False
        for ranks, top in _windows(2):
            if all(len(pool[r]) >= 3 for r in ranks):
                built = []
                for r in ranks:
                    built += [pool[r].pop() for _ in range(3)]
                combos.append(Combo("consec_triples", 6, top, built))
                changed = True

    # 5) 三连对
    changed = True
    while changed:
        changed = False
        for ranks, top in _windows(3):
            if all(len(pool[r]) >= 2 for r in ranks):
                built = []
                for r in ranks:
                    built += [pool[r].pop() for _ in range(2)]
                combos.append(Combo("consec_pairs", 6, top, built))
                changed = True

    # 6) 三同张
    for r in sorted(pool.keys()):
        while len(pool[r]) >= 3:
            built = [pool[r].pop() for _ in range(3)]
            combos.append(Combo("triple", 3, ov(r), built))

    # 7) 对子
    for r in sorted(pool.keys()):
        while len(pool[r]) >= 2:
            built = [pool[r].pop() for _ in range(2)]
            combos.append(Combo("pair", 2, ov(r), built))

    # 8) 用百搭把剩余单张升级成对子(减少手数)
    leftover_singles = []
    for r in sorted(pool.keys()):
        leftover_singles += pool[r]
        pool[r] = []
    for c in leftover_singles + list(jokers):
        if wilds:
            wcard = wilds.pop()
            r = c.rank if not c.is_joker() else c.rank
            combos.append(Combo("pair", 2, ov(c.rank), [c, wcard]))
        else:
            combos.append(Combo("single", 1, order_value(c.rank, level), [c]))

    # 9) 剩余百搭单出
    for wc in wilds:
        combos.append(Combo("single", 1, order_value(wc.rank, level), [wc]))

    return combos


def plays_needed(hand: List[Card], level: int) -> int:
    return len(decompose(hand, level))


def _remove(hand, used):
    rem = list(hand)
    for u in used:
        for i, c in enumerate(rem):
            if c is u or (c.rank == u.rank and c.suit == u.suit):
                rem.pop(i)
                break
    return rem


def lead_v2(hand: List[Card], level: int) -> Combo:
    """按计划领出最该先走的牌：非炸、点数最低、优先把零散小牌走掉。"""
    plan = decompose(hand, level)
    non_bomb = [c for c in plan if not c.is_bomb]
    pool = non_bomb if non_bomb else plan
    # 低点优先；同点把短的(单/对)先走，留长牌型控场
    pool.sort(key=lambda c: (c.rank, c.length))
    return pool[0]


def follow_v2(hand: List[Card], current: Combo, owner_is_partner: bool,
              level: int, opp_low: bool) -> Optional[Combo]:
    if owner_is_partner and not opp_low:
        return None
    resp = legal_responses(hand, current, level)
    if not resp:
        return None
    base = plays_needed(hand, level)
    non_bomb = [m for m in resp if not m.is_bomb]

    best = None
    best_key = None
    for m in (non_bomb if non_bomb else []):
        rem_cost = plays_needed(_remove(hand, m.cards), level)
        # 出完后总手数(rem_cost) 越小越好；其次点数越小越好
        key = (rem_cost, m.rank, m.length)
        if best_key is None or key < best_key:
            best_key, best = key, m

    if best is not None:
        rem_cost = best_key[0]
        # 只在能推进计划(总手数不增加)时才出；否则保留
        if rem_cost <= base:
            return best
        if opp_low:                      # 对手快走完，宁可拆一手也要拦
            return best

    # 没有合适的普通牌型：必要时(对手快走完)动用最小炸弹
    if opp_low:
        bombs = sorted([m for m in resp if m.is_bomb],
                       key=lambda m: m.bomb_power)
        if bombs:
            return bombs[0]
    return None


STRATEGY_V2 = {"lead": lead_v2, "follow": follow_v2}
