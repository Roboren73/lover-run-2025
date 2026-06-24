#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""对打验证：V2(规划型) vs V1(启发式)。
两队各执一种策略，统计头游率与胜率(名次和更小者胜)。
为消除座位/先手偏差，半数对局交换两队策略所在座位。
"""
import random
import sys
from play import play_game, choose_lead, choose_follow
from strategy_v2 import STRATEGY_V2

V1 = {"lead": choose_lead, "follow": choose_follow}


def positions(order):
    """order 是走牌名次(座位列表)，返回 seat->名次(0最好)。"""
    pos = {}
    for rank, seat in enumerate(order):
        pos[seat] = rank
    return pos


def run(n=400, seed=2026, level=2):
    rng = random.Random(seed)
    v2_head = 0
    v2_win = 0
    v2_levels = []
    v1_levels = []
    for i in range(n):
        # 交换座位：偶数局 V2 在 (0,2)，奇数局 V2 在 (1,3)
        if i % 2 == 0:
            strat = [STRATEGY_V2, V1, STRATEGY_V2, V1]
            v2_seats = (0, 2)
        else:
            strat = [V1, STRATEGY_V2, V1, STRATEGY_V2]
            v2_seats = (1, 3)
        res = play_game(rng, level=level, strategies=strat)
        pos = positions(res["order"])
        head = res["head"]
        if head in v2_seats:
            v2_head += 1
        # 真实掼蛋：头游队赢；升级数看队友名次(二游+3,三游+2,末游+1)
        head_team_seats = v2_seats if head in v2_seats else tuple(set(range(4)) - set(v2_seats))
        partner = [s for s in head_team_seats if s != head][0]
        up = {1: 3, 2: 2, 3: 1}[pos[partner]]   # 队友名次→升级数
        if head in v2_seats:
            v2_win += 1
            v2_levels.append(up)
        else:
            v1_levels.append(up)
    import statistics
    return {
        "games": n,
        "v2_head_rate": round(v2_head / n, 3),
        "v2_win_rate": round(v2_win / n, 3),
        "v2_avg_up_when_win": round(statistics.mean(v2_levels), 2) if v2_levels else 0,
        "v1_avg_up_when_win": round(statistics.mean(v1_levels), 2) if v1_levels else 0,
    }


if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 400
    print(f"=== V2(规划型) vs V1(启发式)，{n} 局，交换座位消除偏差 ===")
    for sd in (1, 2026, 77):
        s = run(n, seed=sd)
        print(f"  seed={sd}: V2胜率(头游) {s['v2_win_rate']}, "
              f"V2赢时均升 {s['v2_avg_up_when_win']}级, V1赢时均升 {s['v1_avg_up_when_win']}级")
    print("\n(胜率显著 >0.5 即说明 V2 更强；按真实掼蛋规则=头游队胜)")
