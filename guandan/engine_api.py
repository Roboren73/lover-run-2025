#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""可插拔出牌引擎接口。

为什么要这层：advise() 是手机/眼镜前端调用的"大脑"入口。目前大脑是
strategy_v2 的规划型启发式；以后想换成更强的引擎（DanZero+/rlcard 训练出的
策略网络、贝叶斯猜牌+残局 Minimax 等，见 vision/竞品调研与经验借鉴.md），
不应该去改 advise() 或前端调用点，只要注册一个新引擎、切换名字即可。

一个 Engine 只需实现两个方法：
    lead(hand, level, ctx)   -> Combo            首家/台面清空后领出
    follow(hand, current, level, ctx) -> Optional[Combo]   跟牌，None=过

ctx: GameContext，携带"手牌+台面"之外引擎可能用到的上下文。现在只填了
现有信息；以后要给更强引擎喂更多信息（出牌历史、各家剩牌数），只需往
GameContext 加字段，不用改 lead/follow 的调用点或前端。
"""
from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional

from core import Card, Combo


@dataclass
class GameContext:
    my_seat: Optional[int] = None
    owner_seat: Optional[int] = None              # 当前台面是谁出的；None=首家/台面已清空
    owner_is_partner: bool = False
    opp_low: bool = False                          # 对手快走完(<=3张)，可拆炸弹拦截
    opp_min_cards: int = 99
    # 以下字段现有引擎不用，留给以后接入的更强引擎（如 DanZero+/rlcard）：
    played_history: List[Combo] = field(default_factory=list)   # 本局已出过的牌
    seat_hand_sizes: Dict[int, int] = field(default_factory=dict)  # 各家剩牌数


class Engine:
    """引擎基类（仅作类型/文档用途，Python 不强制继承）。"""
    name: str = "base"

    def lead(self, hand: List[Card], level: int, ctx: GameContext) -> Combo:
        raise NotImplementedError

    def follow(self, hand: List[Card], current: Combo, level: int,
               ctx: GameContext) -> Optional[Combo]:
        raise NotImplementedError


def _wrap_v2() -> Engine:
    from strategy_v2 import lead_v2, follow_v2

    class _V2(Engine):
        name = "v2_plan"

        def lead(self, hand, level, ctx):
            return lead_v2(hand, level)

        def follow(self, hand, current, level, ctx):
            return follow_v2(hand, current, ctx.owner_is_partner, level, ctx.opp_low)

    return _V2()


def _wrap_v1() -> Engine:
    from play import choose_lead, choose_follow

    class _V1(Engine):
        name = "v1_heuristic"

        def lead(self, hand, level, ctx):
            return choose_lead(hand, level)

        def follow(self, hand, current, level, ctx):
            return choose_follow(hand, current, ctx.owner_is_partner, level, ctx.opp_low)

    return _V1()


_REGISTRY: Dict[str, Callable[[], Engine]] = {
    "v2_plan": _wrap_v2,
    "v1_heuristic": _wrap_v1,
}


def get_engine(name: str = "v2_plan") -> Engine:
    if isinstance(name, Engine):
        return name
    if name not in _REGISTRY:
        raise KeyError(f"未知引擎 '{name}'，可选: {list(_REGISTRY)}")
    return _REGISTRY[name]()


def register_engine(name: str, factory: Callable[[], Engine]) -> None:
    """给以后接入的新引擎注册入口，例如：

        def _wrap_danzero_plus():
            from my_rl_engine import DanZeroPlusPolicy
            policy = DanZeroPlusPolicy.load("danzero_plus.ckpt")

            class _RL(Engine):
                name = "danzero_plus"
                def lead(self, hand, level, ctx):
                    return policy.act(hand, None, level, ctx)
                def follow(self, hand, current, level, ctx):
                    return policy.act(hand, current, level, ctx)
            return _RL()

        register_engine("danzero_plus", _wrap_danzero_plus)
        # 之后调用 advise(..., engine="danzero_plus") 即可切换，
        # play.py / vision/recognize.py / 前端调用点都不用改。
    """
    _REGISTRY[name] = factory


def available_engines() -> List[str]:
    return list(_REGISTRY)
