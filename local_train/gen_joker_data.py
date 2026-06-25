#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""为「大王/小王」自动合成训练数据 + 自动生成 YOLO 标注（不用手画一个框）。

思路：王只是一张固定的牌。把你那张牌图随机贴到各种背景上（旋转/缩放/明暗/位置随机），
因为是程序贴上去的，框的位置脚本自己就知道 → 直接写出 YOLO 标注。
生成的数据集结构与 merge_jokers.py 对接（类名 joker_small / joker_big）。

你只需准备「真牌图」：
  cards/
    small/   放你自己那副牌「小王(黑王)」的照片或裁图，几张到十几张即可（jpg/png）
    big/     放「大王(红王)」的照片或裁图
  （透明背景的 PNG 抠图效果最好；普通矩形牌面照也能用。）
可选背景图（更真实）：放一堆桌面/牌桌/手持照到 backgrounds/，不给就用程序生成背景。

用法：
  # 用真牌生成 各 200 张：
  python gen_joker_data.py --cards cards --backgrounds backgrounds --per-class 200 --out joker_dataset
  # 没真牌？先用占位假牌验证整条管线能跑通（不能用于真训练）：
  python gen_joker_data.py --demo --per-class 20 --out joker_demo

生成后接：
  python merge_jokers.py --base 你的52类数据集 --jokers joker_dataset --out merged
  python train.py --data merged/data.yaml --model yolov8s.pt --imgsz 960 --epochs 120
"""
import argparse
import glob
import math
import os
import random

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

CLASSES = ["joker_small", "joker_big"]  # 0=小王, 1=大王（与 merge_jokers.py 一致）
SUBDIRS = {0: ("small", "black", "小", "黑"), 1: ("big", "red", "大", "红")}


# ---------- 读真牌图 ----------
def load_cards(cards_dir):
    """返回 {0:[Image,...], 1:[Image,...]}，每张转 RGBA。"""
    out = {0: [], 1: []}
    if not cards_dir or not os.path.isdir(cards_dir):
        return out
    for cls, keys in SUBDIRS.items():
        paths = []
        for k in keys:
            d = os.path.join(cards_dir, k)
            if os.path.isdir(d):
                for ext in ("*.png", "*.jpg", "*.jpeg", "*.webp", "*.bmp"):
                    paths += glob.glob(os.path.join(d, ext))
                    paths += glob.glob(os.path.join(d, ext.upper()))
        for p in sorted(set(paths)):
            try:
                im = Image.open(p).convert("RGBA")
                out[cls].append(_ensure_alpha(im))
            except Exception as e:
                print(f"  跳过无法读取的图: {p} ({e})")
    return out


def _ensure_alpha(im):
    """若图片本身没透明通道（矩形牌面照），整张给满 alpha。"""
    a = im.split()[-1]
    if a.getextrema() == (255, 255):  # 全不透明 → 当作矩形牌
        pass
    return im


# ---------- 占位假牌（仅供验证管线） ----------
def make_demo_card(cls):
    w, h = 220, 320
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([2, 2, w - 3, h - 3], radius=18, fill=(255, 255, 255, 255),
                        outline=(20, 20, 20, 255), width=3)
    color = (200, 30, 30, 255) if cls == 1 else (20, 20, 20, 255)
    label = "JOKER-R" if cls == 1 else "JOKER-B"
    for xy in ((16, 14), (w - 70, h - 60)):
        d.text(xy, label, fill=color)
    d.polygon([(w / 2, 90), (w / 2 + 30, 170), (w / 2 - 45, 120),
               (w / 2 + 45, 120), (w / 2 - 30, 170)], fill=color)
    return im


# ---------- 背景 ----------
def load_backgrounds(bg_dir):
    bgs = []
    if bg_dir and os.path.isdir(bg_dir):
        for ext in ("*.png", "*.jpg", "*.jpeg", "*.webp", "*.bmp"):
            bgs += glob.glob(os.path.join(bg_dir, ext))
            bgs += glob.glob(os.path.join(bg_dir, ext.upper()))
    return sorted(set(bgs))


def make_background(size, bg_paths):
    W, H = size
    if bg_paths:
        try:
            bg = Image.open(random.choice(bg_paths)).convert("RGB")
            # 随机裁剪铺满
            scale = max(W / bg.width, H / bg.height) * random.uniform(1.0, 1.3)
            bg = bg.resize((int(bg.width * scale), int(bg.height * scale)))
            x = random.randint(0, max(0, bg.width - W))
            y = random.randint(0, max(0, bg.height - H))
            bg = bg.crop((x, y, x + W, y + H))
            return ImageEnhance.Brightness(bg).enhance(random.uniform(0.8, 1.15))
        except Exception:
            pass
    # 程序生成：随机底色 + 渐变 + 噪点（模拟牌桌/桌面）
    base = random.choice([(35, 110, 60), (60, 80, 120), (120, 90, 60),
                          (200, 200, 200), (40, 40, 40), (150, 120, 90)])
    arr = np.zeros((H, W, 3), np.float32)
    grad = np.linspace(0.7, 1.2, H)[:, None, None]
    arr[:] = np.array(base, np.float32) * grad
    arr += np.random.normal(0, 10, (H, W, 3))
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")


# ---------- 增强 + 贴牌 + 出框 ----------
def place_card(canvas, card, rng):
    W, H = canvas.size
    # 缩放：牌高占画布 25%~62%
    target_h = int(H * rng.uniform(0.25, 0.62))
    scale = target_h / card.height
    c = card.resize((max(1, int(card.width * scale)), target_h), Image.LANCZOS)
    # 颜色/明暗抖动
    c_rgb = c.convert("RGB")
    c_rgb = ImageEnhance.Brightness(c_rgb).enhance(rng.uniform(0.75, 1.2))
    c_rgb = ImageEnhance.Contrast(c_rgb).enhance(rng.uniform(0.85, 1.2))
    c_rgb = ImageEnhance.Color(c_rgb).enhance(rng.uniform(0.8, 1.2))
    c = Image.merge("RGBA", (*c_rgb.split(), c.split()[-1]))
    if rng.random() < 0.3:
        c = c.filter(ImageFilter.GaussianBlur(rng.uniform(0.4, 1.2)))
    # 旋转（带透明，expand 出整张）
    ang = rng.uniform(-25, 25)
    c = c.rotate(ang, expand=True, resample=Image.BICUBIC)
    cw, ch = c.size
    if cw >= W or ch >= H:  # 太大就缩回去
        s = min(W / cw, H / ch) * 0.9
        c = c.resize((int(cw * s), int(ch * s)), Image.LANCZOS)
        cw, ch = c.size
    # 随机位置（整张在画布内）
    x = rng.randint(0, W - cw)
    y = rng.randint(0, H - ch)
    canvas.alpha_composite(c, (x, y))
    # 由 alpha 求紧致框
    alpha = np.array(c.split()[-1])
    ys, xs = np.where(alpha > 16)
    if len(xs) == 0:
        return None
    x0, x1 = x + xs.min(), x + xs.max()
    y0, y1 = y + ys.min(), y + ys.max()
    cx = (x0 + x1) / 2 / W
    cy = (y0 + y1) / 2 / H
    bw = (x1 - x0) / W
    bh = (y1 - y0) / H
    return cx, cy, bw, bh


def gen_split(n, cls, cards, bg_paths, imgsz, out_img, out_lab, prefix, rng):
    os.makedirs(out_img, exist_ok=True)
    os.makedirs(out_lab, exist_ok=True)
    made = 0
    for i in range(n):
        W = H = imgsz
        canvas = make_background((W, H), bg_paths).convert("RGBA")
        labels = []
        # 主体：本类 1 张；30% 概率再叠一张同类增加密度
        k = 1 + (1 if rng.random() < 0.3 else 0)
        for _ in range(k):
            card = rng.choice(cards[cls])
            box = place_card(canvas, card, rng)
            if box:
                labels.append((cls, *box))
        # 20% 概率混入一张「另一类」王，并正确打标，提升区分能力
        other = 1 - cls
        if cards[other] and rng.random() < 0.2:
            box = place_card(canvas, rng.choice(cards[other]), rng)
            if box:
                labels.append((other, *box))
        if not labels:
            continue
        name = f"{prefix}_{cls}_{i:05d}"
        canvas.convert("RGB").save(os.path.join(out_img, name + ".jpg"), quality=90)
        with open(os.path.join(out_lab, name + ".txt"), "w") as f:
            for (cid, cx, cy, bw, bh) in labels:
                f.write(f"{cid} {cx:.6f} {cy:.6f} {bw:.6f} {bh:.6f}\n")
        made += 1
    return made


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cards", default="cards", help="真牌图根目录(含 small/ big/)")
    ap.add_argument("--backgrounds", default="backgrounds", help="背景图目录(可空)")
    ap.add_argument("--per-class", type=int, default=200)
    ap.add_argument("--out", default="joker_dataset")
    ap.add_argument("--imgsz", type=int, default=960)
    ap.add_argument("--val-frac", type=float, default=0.15)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--demo", action="store_true", help="无真牌时用占位假牌验证管线")
    a = ap.parse_args()
    rng = random.Random(a.seed)
    np.random.seed(a.seed)

    cards = load_cards(a.cards)
    if a.demo:
        for cls in (0, 1):
            if not cards[cls]:
                cards[cls] = [make_demo_card(cls)]
        print("⚠ demo 模式：用占位假牌，仅验证管线，不能用于真训练。")
    for cls in (0, 1):
        if not cards[cls]:
            raise SystemExit(
                f"没找到「{CLASSES[cls]}」的牌图。请在 {a.cards}/"
                f"{'small' if cls==0 else 'big'}/ 放几张照片，或加 --demo 先验证管线。")
    print(f"读到真牌: 小王 {len(cards[0])} 张, 大王 {len(cards[1])} 张")

    bg_paths = load_backgrounds(a.backgrounds)
    print(f"背景图: {len(bg_paths)} 张" + ("" if bg_paths else "（无 → 用程序生成背景）"))

    total = 0
    for cls in (0, 1):
        n_val = max(1, int(a.per_class * a.val_frac))
        n_train = a.per_class - n_val
        t = gen_split(n_train, cls, cards, bg_paths, a.imgsz,
                      os.path.join(a.out, "train", "images"),
                      os.path.join(a.out, "train", "labels"), "tr", rng)
        v = gen_split(n_val, cls, cards, bg_paths, a.imgsz,
                      os.path.join(a.out, "valid", "images"),
                      os.path.join(a.out, "valid", "labels"), "va", rng)
        total += t + v
        print(f"{CLASSES[cls]}: train {t} + valid {v}")

    data = {
        "path": os.path.abspath(a.out),
        "train": "train/images", "val": "valid/images",
        "nc": len(CLASSES), "names": CLASSES,
    }
    import yaml
    with open(os.path.join(a.out, "data.yaml"), "w", encoding="utf-8") as f:
        yaml.safe_dump(data, f, allow_unicode=True, sort_keys=False)
    print(f"\n✅ 共生成 {total} 张(含自动标注) → {a.out}/data.yaml")
    print("接着：python merge_jokers.py --base 你的52类数据集 --jokers", a.out, "--out merged")


if __name__ == "__main__":
    main()
