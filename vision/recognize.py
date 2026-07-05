#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""扑克牌识别 → 掼蛋引擎 的桥接。

用法（在装好模型与 ultralytics 的机器上）：
    python vision/recognize.py 牌桌照片.jpg --level 2

流程：YOLO 检测每张牌 → 解析成 (rank,suit) → 调用 guandan 引擎做
自动组牌(decompose) 与出牌建议(advise)。

不带图片参数时跑一个内置示例(用假识别结果)，演示"识别→组牌→建议"链路，
无需安装 ultralytics 即可验证桥接逻辑。
"""
import os
import sys
import re

# 让本脚本能 import 到 ../guandan 引擎
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "guandan"))

from core import Card  # noqa: E402

RANK_MAP = {
    "A": 14, "K": 13, "Q": 12, "J": 11, "T": 10, "10": 10,
    "9": 9, "8": 8, "7": 7, "6": 6, "5": 5, "4": 4, "3": 3, "2": 2,
}
SUIT_MAP = {"S": "S", "H": "H", "D": "D", "C": "C"}
WORD_RANK = {"ace": 14, "king": 13, "queen": 12, "jack": 11, "ten": 10,
             "nine": 9, "eight": 8, "seven": 7, "six": 6, "five": 5,
             "four": 4, "three": 3, "two": 2}
WORD_SUIT = {"spade": "S", "heart": "H", "diamond": "D", "club": "C"}


def parse_card_name(name):
    """把检测类别名解析成 Card。支持 'AS' '10H' 'Kd' '2c'，
    以及 'ace of spades' / 'ten_of_hearts' 等写法；王: 'joker'/'大王'/'小王'。
    返回 Card 或 None(无法解析)。"""
    s = name.strip().lower()
    if "joker" in s or "王" in s:
        if "big" in s or "red" in s or "大" in s:
            return Card(17, None)
        return Card(16, None)
    # 文字式：rank of suit
    mr = next((v for k, v in WORD_RANK.items() if k in s), None)
    ms = next((v for k, v in WORD_SUIT.items() if k in s), None)
    if mr and ms:
        return Card(mr, ms)
    # 紧凑式：如 10H / AS / KD（顺序不限）
    up = name.strip().upper()
    m = re.match(r"^(10|[2-9TAKQJ])([SHDC])$", up) or re.match(r"^([SHDC])(10|[2-9TAKQJ])$", up)
    if m:
        a, b = m.group(1), m.group(2)
        rank_tok, suit_tok = (a, b) if b in SUIT_MAP else (b, a)
        if rank_tok in RANK_MAP and suit_tok in SUIT_MAP:
            return Card(RANK_MAP[rank_tok], SUIT_MAP[suit_tok])
    return None


def detect_cards(image_path, model_path, conf=0.4):
    """用 YOLO 模型检测图片中的牌，返回 Card 列表。需要 ultralytics。"""
    from ultralytics import YOLO  # 延迟导入：仅推理时需要
    model = YOLO(model_path)
    res = model.predict(image_path, conf=conf, verbose=False)[0]
    names = res.names
    cards = []
    for b in res.boxes:
        cls = names[int(b.cls)]
        c = parse_card_name(cls)
        if c:
            cards.append(c)
    return cards


def bridge_to_engine(cards, level=2, engine="v2_plan"):
    """识别到的手牌 → 自动组牌 + 首家出牌建议。

    engine: 传给 play.advise() 的引擎名/实例，见 guandan/engine_api.py。
    默认 v2_plan；以后接入更强引擎(DanZero+/rlcard 等)只需改这里的默认值
    或在调用处传参，识别流程不用动。"""
    from play import advise           # noqa: E402
    from strategy_v2 import decompose  # noqa: E402
    from core import classify          # noqa: E402  (备用)
    plan = decompose(cards, level)
    rec = advise(cards, None, level, my_seat=0, engine=engine)
    return plan, rec


def _format(cards):
    return " ".join(str(c) for c in cards)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    level = 2
    if "--level" in sys.argv:
        level = int(sys.argv[sys.argv.index("--level") + 1])

    if args:
        image_path = args[0]
        model_path = os.path.join(ROOT, "vision", "best.pt")
        if not os.path.exists(model_path):
            print(f"未找到模型 {model_path}。请先用 train_colab.ipynb 训练并把 best.pt 放到 vision/。")
            sys.exit(1)
        cards = detect_cards(image_path, model_path)
        print(f"识别到 {len(cards)} 张牌：{_format(cards)}")
    else:
        # 内置示例：模拟识别结果，验证"识别→组牌→建议"链路（无需 ultralytics）
        demo_names = ["AS", "3S", "9H", "3H", "9D", "4D", "9S", "5C", "9C", "6S", "7H"]
        cards = [parse_card_name(n) for n in demo_names]
        cards = [c for c in cards if c]
        print("（示例）识别到的乱序手牌：", _format(cards))

    plan, rec = bridge_to_engine(cards, level)
    print("自动组牌：", "  |  ".join(
        f"{m.category}[{_format(m.cards)}]" for m in plan))
    print("出牌建议：", rec["reason"])


if __name__ == "__main__":
    main()
