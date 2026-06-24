#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""掼蛋核心引擎：牌、牌型分析(classify)、比较(beats)、合法出牌生成。

设计要点见 guandan/RULES.md。点数编码：
  2..10 -> 2..10, J=11, Q=12, K=13, A=14, 小王=16, 大王=17
比较时"级牌"升为 15（介于 A 与 小王 之间）；在顺子/连对/钢板里级牌按自然点数参与。
红桃级牌 = 逢人配(wild)。
"""
from dataclasses import dataclass, field
from typing import List, Optional, Tuple, Dict
from collections import defaultdict

RANK_NAMES = {11: "J", 12: "Q", 13: "K", 14: "A", 16: "小王", 17: "大王"}
SUITS = ("S", "H", "D", "C")  # 黑桃 红桃 方块 梅花


def rank_name(r: int) -> str:
    return RANK_NAMES.get(r, str(r))


@dataclass(frozen=True)
class Card:
    rank: int            # 2..14, 16(小王), 17(大王)
    suit: Optional[str]  # 'S'/'H'/'D'/'C'，王为 None

    def is_joker(self) -> bool:
        return self.rank in (16, 17)

    def __str__(self) -> str:
        if self.is_joker():
            return rank_name(self.rank)
        return f"{self.suit}{rank_name(self.rank)}"


def is_wild(card: Card, level: int) -> bool:
    """红桃级牌 = 逢人配。"""
    return (not card.is_joker()) and card.suit == "H" and card.rank == level


def order_value(rank: int, level: int) -> int:
    """单牌/对/三/炸 比较时的序值：级牌升为 15。"""
    if rank in (16, 17):
        return rank
    if rank == level:
        return 15
    return rank


def make_deck() -> List[Card]:
    deck: List[Card] = []
    for _ in range(2):  # 两副牌
        for s in SUITS:
            for r in range(2, 15):
                deck.append(Card(r, s))
        deck.append(Card(16, None))  # 小王
        deck.append(Card(17, None))  # 大王
    return deck


# 炸弹族 tier：4张=4，5张=5，同花顺=6，6张=7，7张=8，8张=9，天王炸=100
def bomb_tier(category: str, n: int) -> int:
    if category == "joker_bomb":
        return 100
    if category == "straight_flush":
        return 6
    # 普通炸弹
    return n if n <= 5 else n + 1


@dataclass
class Combo:
    category: str          # single/pair/triple/full_house/straight/
                           # consec_pairs/consec_triples/bomb/straight_flush/joker_bomb
    length: int            # 牌张数
    rank: int              # 同类内比较用的点数序值
    cards: List[Card] = field(default_factory=list)
    is_bomb: bool = False
    bomb_power: Optional[Tuple[int, int]] = None  # (tier, rank)

    def __str__(self) -> str:
        return f"{self.category}[{' '.join(str(c) for c in self.cards)}]"


def beats(b: Optional[Combo], a: Optional[Combo]) -> bool:
    """b 能否压过 a。a 为 None 表示首家(任意出牌都成立)。"""
    if b is None:
        return False
    if a is None:
        return True
    if b.is_bomb and not a.is_bomb:
        return True
    if a.is_bomb and not b.is_bomb:
        return False
    if b.is_bomb and a.is_bomb:
        return b.bomb_power > a.bomb_power
    # 都是普通牌型：同型同长比点数
    return b.category == a.category and b.length == a.length and b.rank > a.rank


# --------------------------------------------------------------------------
# 构造工具：把"需求(点数,数量)"用手上的牌 + 百搭填满，返回具体牌或 None
# --------------------------------------------------------------------------
def _split_hand(cards: List[Card], level: int):
    """返回 (by_rank, jokers, wilds)。by_rank 不含王、不含百搭。"""
    by_rank: Dict[int, List[Card]] = defaultdict(list)
    jokers: List[Card] = []
    wilds: List[Card] = []
    for c in cards:
        if c.is_joker():
            jokers.append(c)
        elif is_wild(c, level):
            wilds.append(c)
        else:
            by_rank[c.rank].append(c)
    return by_rank, jokers, wilds


def _build(requirements, by_rank, wilds, suit=None):
    """requirements: List[(rank, need)]。用 by_rank 的自然牌(可限定花色)优先，
    不足用 wilds 补。返回具体 Card 列表或 None。不跨需求复用同一张牌。"""
    used: List[Card] = []
    wleft = list(wilds)
    consumed = defaultdict(int)
    for r, need in requirements:
        avail = [c for c in by_rank.get(r, []) if suit is None or c.suit == suit]
        avail = avail[consumed[r]:]  # 跳过本牌型已用掉的
        take = min(need, len(avail))
        used.extend(avail[:take])
        consumed[r] += take
        need -= take
        while need > 0 and wleft:
            used.append(wleft.pop())
            need -= 1
        if need > 0:
            return None
    return used


# --------------------------------------------------------------------------
# classify：判断"一组牌"构成什么牌型（用于校验出牌 / 给建议）
# --------------------------------------------------------------------------
# 顺子/连对/钢板的连续窗口（A 可高可低）
def _windows(size: int):
    """返回长度为 size 的连续点数窗口列表；A(14) 既可作高位也可作低位(=1)。"""
    res = []
    # 普通：从 2 起，最高到 ...A
    seqs = []
    # A 低位：1,2,3,...  用 14 代表 A，但排序点数用 'top'
    low = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]  # 1=A_low ... 14=A_high
    for start in range(1, 14 - size + 2):
        window = list(range(start, start + size))
        # 映射回真实点数：1 -> 14(A)，其余不变
        ranks = [14 if x == 1 else x for x in window]
        top = window[-1]  # 用于比较：A 低位窗口 top 偏小
        res.append((ranks, top))
    return res


def classify(cards: List[Card], level: int) -> Optional[Combo]:
    """识别一组牌构成的牌型，返回 Combo 或 None(非法牌型)。"""
    n = len(cards)
    if n == 0:
        return None
    by_rank, jokers, wilds = _split_hand(cards, level)
    w = len(wilds)

    def ov(r):
        return order_value(r, level)

    # ---- 天王炸：4 张王 ----
    if n == 4 and len(jokers) == 4:
        return Combo("joker_bomb", 4, 100, list(cards), True, (100, 0))

    # 含王但不是天王炸的牌型一律不合法（王只能单出或天王炸）
    if jokers and not (n == 1):
        # 例外：王不参与对/三/炸/顺等。n==1 时下面单张处理。
        return None

    # ---- 单张 ----
    if n == 1:
        c = cards[0]
        return Combo("single", 1, order_value(c.rank, level), list(cards))

    # ---- 同点炸弹 / 对 / 三 ----
    # 找一个能用 自然+百搭 填满 n 张同点的点数
    def same_rank_combo():
        for r, lst in by_rank.items():
            if len(lst) + w >= n and len(lst) >= 1:
                built = _build([(r, n)], by_rank, wilds)
                if built:
                    return r, built
        # 全百搭（极端）：n 张全是百搭，代表级牌点
        if w >= n and not by_rank:
            return level, list(wilds[:n])
        return None

    if n == 2:
        sc = same_rank_combo()
        if sc:
            r, built = sc
            return Combo("pair", 2, ov(r), built)
        return None

    if n == 3:
        sc = same_rank_combo()
        if sc:
            r, built = sc
            return Combo("triple", 3, ov(r), built)
        return None

    if n >= 4:
        # 优先判断同点炸弹
        sc = same_rank_combo()
        if sc:
            r, built = sc
            tier = bomb_tier("bomb", n)
            return Combo("bomb", n, ov(r), built, True, (tier, ov(r)))

    # ---- n==5: 三带二 / 同花顺 / 顺子 ----
    if n == 5:
        # 三带二：三同 + 一对，两点不同
        ranks_present = list(by_rank.keys())
        for t in ranks_present + ([level] if w else []):
            for p in ranks_present + ([level] if w else []):
                if t == p:
                    continue
                built = _build([(t, 3), (p, 2)], by_rank, wilds)
                if built and len(built) == 5:
                    return Combo("full_house", 5, ov(t), built)
        # 同花顺
        for suit in SUITS:
            for ranks, top in _windows(5):
                built = _build([(r, 1) for r in ranks], by_rank, wilds, suit=suit)
                if built and len(built) == 5:
                    return Combo("straight_flush", 5, top, built, True, (6, top))
        # 普通顺子
        for ranks, top in _windows(5):
            built = _build([(r, 1) for r in ranks], by_rank, wilds)
            if built and len(built) == 5:
                return Combo("straight", 5, top, built)
        return None

    # ---- n==6: 三连对 / 钢板 ----
    if n == 6:
        # 三连对
        for ranks, top in _windows(3):
            built = _build([(r, 2) for r in ranks], by_rank, wilds)
            if built and len(built) == 6:
                return Combo("consec_pairs", 6, top, built)
        # 钢板（二连三）
        for ranks, top in _windows(2):
            built = _build([(r, 3) for r in ranks], by_rank, wilds)
            if built and len(built) == 6:
                return Combo("consec_triples", 6, top, built)
        return None

    return None


# --------------------------------------------------------------------------
# 出牌生成：从手牌生成候选 Combo（供 bot/建议使用）
# --------------------------------------------------------------------------
def gen_moves(hand: List[Card], level: int) -> List[Combo]:
    """生成手牌可出的候选牌型（不含'过'）。会去重(按牌型签名)。"""
    by_rank, jokers, wilds = _split_hand(hand, level)
    w = len(wilds)
    ranks = sorted(by_rank.keys())
    out: List[Combo] = []
    seen = set()

    def add(combo: Optional[Combo]):
        if not combo:
            return
        sig = (combo.category, combo.length, combo.rank,
               tuple(sorted(str(c) for c in combo.cards)))
        if sig in seen:
            return
        seen.add(sig)
        out.append(combo)

    # 单张：每张牌（含王、含百搭）
    for c in hand:
        add(Combo("single", 1, order_value(c.rank, level), [c]))

    # 对 / 三 / 炸（同点，含百搭补）
    for r in ranks:
        cnt = len(by_rank[r])
        for need, cat in ((2, "pair"), (3, "triple")):
            if cnt + w >= need and cnt >= 1:
                built = _build([(r, need)], by_rank, wilds)
                if built:
                    add(Combo(cat, need, order_value(r, level), built))
        # 炸弹：4..(cnt+w)
        maxn = min(cnt + w, 8)
        for nb in range(4, maxn + 1):
            built = _build([(r, nb)], by_rank, wilds)
            if built:
                tier = bomb_tier("bomb", nb)
                add(Combo("bomb", nb, order_value(r, level), built, True,
                          (tier, order_value(r, level))))

    # 天王炸
    if len([c for c in jokers if c.rank == 16]) >= 2 and \
       len([c for c in jokers if c.rank == 17]) >= 2:
        jb = [c for c in jokers if c.rank == 16][:2] + \
             [c for c in jokers if c.rank == 17][:2]
        add(Combo("joker_bomb", 4, 100, jb, True, (100, 0)))

    # 三带二
    for t in ranks:
        if len(by_rank[t]) + w < 3:
            continue
        triple = _build([(t, 3)], by_rank, wilds)
        if not triple:
            continue
        wused_t = sum(1 for c in triple if is_wild(c, level))
        wleft = w - wused_t
        # 剩余手牌(去掉 triple 用掉的)
        rem = _remove(hand, triple)
        rb, _, rw = _split_hand(rem, level)
        for p in sorted(rb.keys()):
            if p == t:
                pass
            pair = _build([(p, 2)], rb, rw)
            if pair and len(pair) == 2:
                add(Combo("full_house", 5, order_value(t, level), triple + pair))
                break

    # 顺子 / 同花顺
    for ranks_w, top in _windows(5):
        built = _build([(r, 1) for r in ranks_w], by_rank, wilds)
        if built and len(built) == 5:
            add(Combo("straight", 5, top, built))
        for suit in SUITS:
            sb = _build([(r, 1) for r in ranks_w], by_rank, wilds, suit=suit)
            if sb and len(sb) == 5:
                add(Combo("straight_flush", 5, top, sb, True, (6, top)))

    # 三连对
    for ranks_w, top in _windows(3):
        built = _build([(r, 2) for r in ranks_w], by_rank, wilds)
        if built and len(built) == 6:
            add(Combo("consec_pairs", 6, top, built))

    # 钢板
    for ranks_w, top in _windows(2):
        built = _build([(r, 3) for r in ranks_w], by_rank, wilds)
        if built and len(built) == 6:
            add(Combo("consec_triples", 6, top, built))

    return out


def _remove(hand: List[Card], used: List[Card]) -> List[Card]:
    """从 hand 移除 used（按对象身份/相等移除一份）。"""
    rem = list(hand)
    for u in used:
        for i, c in enumerate(rem):
            if c is u or (c.rank == u.rank and c.suit == u.suit):
                rem.pop(i)
                break
    return rem


def legal_responses(hand: List[Card], current: Optional[Combo], level: int) -> List[Combo]:
    """对当前台面 current，返回所有能出的合法牌(含炸弹)。current=None 表示首家。"""
    moves = gen_moves(hand, level)
    if current is None:
        return moves
    return [m for m in moves if beats(m, current)]
