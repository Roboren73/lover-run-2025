# 掼蛋 AI 引擎（MVP / 阶段0）

这是"打掼蛋实时建议工具"的**大脑**部分：纯逻辑、无外部依赖（仅 Python 标准库）。
手机 App / AI 眼镜前端将来只需调用这里的 `advise()` 接口即可获得出牌建议。

## 文件
| 文件 | 作用 |
|---|---|
| `RULES.md` | 规则口径与 MVP 简化项 |
| `core.py` | 牌、**牌型分析 `classify()`**、大小比较 `beats()`、合法出牌生成 `gen_moves()` |
| `play.py` | 对局引擎 `play_game()`、启发式 Bot、**建议接口 `advise()`**、锦标赛 `tournament()` |
| `test_core.py` | 牌型/比较/逢人配 单元测试（29 项）|

## 快速验证
```bash
cd guandan
python3 test_core.py        # 单元测试，应 29/29 通过
python3 play.py 500         # 自我对弈 500 局，应全部跑完
```

## 建议接口（前端对接点）
```python
from core import Card, classify
from play import advise

level = 2                                   # 当前打几
hand = [Card(3,'S'), Card(3,'H'), ...]      # 我的手牌
current = classify([Card(8,'S'), Card(8,'D')], level)  # 台面上家出的牌(无则 None)

rec = advise(hand, current, level,
             owner_seat=1, my_seat=0, opp_min_cards=10)
# rec = {'action': 'play'/'pass', 'combo': Combo|None, 'reason': '...'}
```

**前端只要把"我的手牌 + 台面牌 + 座位"传进来，就能拿到建议。**
- 手机方案：摄像头识别牌面 → 组装成 `Card` 列表 → 调 `advise()` → 语音/悬浮提示。
- 眼镜方案：第一视角摄像头 → 同一接口 → 耳机播报。

## 已知简化（见 RULES.md）
固定 5 张顺子 / 3 对连对 / 2 个钢板；暂无上贡与跨局升级；Bot 为启发式（非最优搜索）。
**下一步壁垒工作**：把 Bot 升级为搜索/强化学习，提高建议质量；以及前端的牌面识别。
