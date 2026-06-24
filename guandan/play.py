#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""掼蛋对局引擎 + 启发式 Bot + 自我对弈/锦标赛。

- GameState/play_game：发牌、轮次出牌、走牌名次，跑完整一局。
- HeuristicBot：首家出牌/跟牌的启发式策略（含简单队友配合：不盖队友）。
- advise()：给定手牌与台面，返回"建议出牌 + 理由"——这是手机/眼镜前端要调用的大脑接口。
- tournament()：跑 N 局，统计完成率/炸弹数/头游归属，验证引擎稳定跑通。

随机性用 random.Random(seed) 显式控制，便于复现。
"""
import random
from typing import List, Optional, Tuple
from core import (Card, Combo, make_deck, gen_moves, legal_responses, beats,
                  order_value)

NUM_PLAYERS = 4


def deal(rng: random.Random, level: int) -> List[List[Card]]:
    deck = make_deck()
    rng.shuffle(deck)
    return [deck[i * 27:(i + 1) * 27] for i in range(NUM_PLAYERS)]


def teammate(seat: int) -> int:
    return (seat + 2) % NUM_PLAYERS


def _hand_value(hand: List[Card], level: int) -> int:
    return sum(order_value(c.rank, level) for c in hand)


# --------------------------------------------------------------------------
# 启发式策略：返回要出的 Combo，或 None 表示"过"
# --------------------------------------------------------------------------
def _bomb_ranks(hand: List[Card], level: int) -> set:
    """手里已成型的同点炸弹(>=4张)的点数，出牌时尽量别拆。"""
    from collections import Counter
    cnt = Counter(c.rank for c in hand
                  if not c.is_joker() and not (c.suit == "H" and c.rank == level))
    return {r for r, c in cnt.items() if c >= 4}


def choose_lead(hand: List[Card], level: int) -> Combo:
    """首家必须出牌：尽量出牌、留炸弹(不拆)、先走小牌。"""
    moves = gen_moves(hand, level)
    bomb_rk = _bomb_ranks(hand, level)
    # 非炸弹且不拆已成型炸弹的走法优先
    safe = [m for m in moves if not m.is_bomb
            and not any(c.rank in bomb_rk for c in m.cards)]
    non_bomb = [m for m in moves if not m.is_bomb]
    pool = safe or non_bomb or moves
    # 多张优先(快走牌)，同长出小点；避免一上来甩大牌
    pool.sort(key=lambda m: (-m.length, m.rank))
    return pool[0]


def choose_follow(hand: List[Card], current: Combo, owner_is_partner: bool,
                  level: int, opp_low: bool) -> Optional[Combo]:
    """跟牌：能压则压，优先不拆炸；队友领先时一般不盖。
    opp_low: 对手手牌很少(快走完)，此时愿意动用炸弹拦截。"""
    if owner_is_partner and not opp_low:
        return None  # 不盖队友
    resp = legal_responses(hand, current, level)
    if not resp:
        return None
    non_bomb = [m for m in resp if not m.is_bomb]
    if non_bomb:
        non_bomb.sort(key=lambda m: (m.rank, m.length))
        return non_bomb[0]
    # 只剩炸弹能压：对手快走完才用，否则保留
    if opp_low:
        bombs = sorted(resp, key=lambda m: m.bomb_power)
        return bombs[0]
    return None


# --------------------------------------------------------------------------
# 建议接口（给前端：手机/眼镜）
# --------------------------------------------------------------------------
def advise(hand: List[Card], current: Optional[Combo], level: int,
           owner_seat: Optional[int] = None, my_seat: Optional[int] = None,
           opp_min_cards: int = 99) -> dict:
    """返回 {'action':'play'/'pass', 'combo':Combo|None, 'reason':str}。"""
    from strategy_v2 import lead_v2, follow_v2, decompose
    opp_low = opp_min_cards <= 3
    if current is None:
        c = lead_v2(hand, level)
        plan = decompose(hand, level)
        return {"action": "play", "combo": c,
                "reason": f"你是首家，按最少{len(plan)}手的计划先走小牌、保留炸弹：出 {c}"}
    owner_is_partner = (owner_seat is not None and my_seat is not None
                        and owner_seat == teammate(my_seat))
    c = follow_v2(hand, current, owner_is_partner, level, opp_low)
    if c is None:
        if owner_is_partner:
            return {"action": "pass", "combo": None,
                    "reason": "台面是队友的牌，建议过牌不盖队友。"}
        return {"action": "pass", "combo": None,
                "reason": "无更优解或为保留炸弹，建议过牌。"}
    extra = "（对手快走完，动用炸弹拦截）" if c.is_bomb else ""
    return {"action": "play", "combo": c, "reason": f"建议压牌：出 {c} {extra}".strip()}


# --------------------------------------------------------------------------
# 一局对局
# --------------------------------------------------------------------------
def play_game(rng: random.Random, level: int = 2, verbose: bool = False,
              strategies=None) -> dict:
    """strategies: 长度4的列表，每项为 {'lead':fn(hand,level), 'follow':fn(hand,current,partner,level,opp_low)}。
    缺省全部用 V1 启发式。"""
    if strategies is None:
        v1 = {"lead": choose_lead, "follow": choose_follow}
        strategies = [v1, v1, v1, v1]
    hands = deal(rng, level)
    finished: List[int] = []          # 走牌名次
    leader = rng.randrange(NUM_PLAYERS)
    current: Optional[Combo] = None
    owner: Optional[int] = None
    passes = 0
    turn = leader
    bombs_played = 0
    tricks = 0
    safety = 0

    def active() -> List[int]:
        return [s for s in range(NUM_PLAYERS) if hands[s]]

    def play_combo(seat: int, combo: Combo):
        nonlocal bombs_played
        for c in combo.cards:
            for i, h in enumerate(hands[seat]):
                if h.rank == c.rank and h.suit == c.suit:
                    hands[seat].pop(i)
                    break
        if combo.is_bomb:
            bombs_played += 1
        if verbose:
            print(f"  P{seat} 出 {combo}  (剩 {len(hands[seat])})")

    while len(active()) > 1:
        safety += 1
        if safety > 100000:
            raise RuntimeError("对局未收敛，疑似死循环")

        if not hands[turn]:                       # 已走牌，跳过
            turn = (turn + 1) % NUM_PLAYERS
            continue

        if current is None:                       # 首家
            combo = strategies[turn]["lead"](hands[turn], level)
            play_combo(turn, combo)
            current, owner, passes = combo, turn, 0
            tricks += 1
            if not hands[turn]:
                finished.append(turn)
            turn = (turn + 1) % NUM_PLAYERS
            continue

        if turn == owner:                          # 回到台主：本轮无人能压
            current, owner, passes = None, None, 0
            continue                               # 台主原地重新领出

        # 跟牌
        act = active()
        opp_min = min((len(hands[s]) for s in act
                       if s != turn and (s % 2) != (turn % 2)), default=99)
        owner_is_partner = (owner is not None and owner == teammate(turn))
        combo = strategies[turn]["follow"](hands[turn], current, owner_is_partner,
                                           level, opp_min <= 3)
        if combo is not None:
            play_combo(turn, combo)
            current, owner, passes = combo, turn, 0
            if not hands[turn]:
                finished.append(turn)
        else:
            passes += 1
            if verbose:
                print(f"  P{turn} 过")

        # 判定本轮是否结束：除台主外的在场者都已过
        act = active()
        if owner in act:
            needed = len(act) - 1
        else:
            needed = len(act)
        if needed <= 0 or passes >= needed:
            # 新首家 = 台主(若在场) 否则台主下家的下一个在场者
            if owner in act:
                turn = owner
            else:
                nxt = (owner + 1) % NUM_PLAYERS if owner is not None else turn
                while not hands[nxt]:
                    nxt = (nxt + 1) % NUM_PLAYERS
                turn = nxt
            current, owner, passes = None, None, 0
            continue

        turn = (turn + 1) % NUM_PLAYERS

    # 最后一名
    for s in range(NUM_PLAYERS):
        if s not in finished:
            finished.append(s)

    head = finished[0]
    head_team = head % 2
    return {
        "order": finished,
        "head": head,
        "head_team": head_team,
        "bombs": bombs_played,
        "tricks": tricks,
    }


# --------------------------------------------------------------------------
# 锦标赛/自我对弈验证
# --------------------------------------------------------------------------
def tournament(n: int = 200, seed: int = 42, level: int = 2) -> dict:
    rng = random.Random(seed)
    team0_head = 0
    total_bombs = 0
    total_tricks = 0
    completed = 0
    for _ in range(n):
        res = play_game(rng, level=level)
        assert len(res["order"]) == NUM_PLAYERS and len(set(res["order"])) == 4
        completed += 1
        team0_head += 1 if res["head_team"] == 0 else 0
        total_bombs += res["bombs"]
        total_tricks += res["tricks"]
    return {
        "games": n,
        "completed": completed,
        "team0_head_rate": round(team0_head / n, 3),
        "avg_bombs": round(total_bombs / n, 2),
        "avg_tricks": round(total_tricks / n, 2),
    }


if __name__ == "__main__":
    import sys
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 200
    print(f"=== 自我对弈 {n} 局（验证引擎稳定跑通）===")
    stats = tournament(n)
    for k, v in stats.items():
        print(f"  {k}: {v}")
    ok = stats["completed"] == n
    print(f"\n{'全部对局正常跑完 ✅' if ok else '存在未完成对局 ❌'}")
    sys.exit(0 if ok else 1)
