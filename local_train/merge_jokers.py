#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把"自己标注的大小王(2类)数据集"合并进"52类基础数据集"，生成 54 类数据集。

为什么需要它：公开数据集没有能区分大王/小王的，只能自己拍王、标成两类，再合并。

约定（重要）：你在 Roboflow/labelImg 里把王标成两类，类名包含关键字即可识别：
  - 小王(黑王)：类名含 small / black / 小 / 黑   → 合并后固定为第 52 号类 joker_small
  - 大王(红王)：类名含 big / red / 大 / 红       → 合并后固定为第 53 号类 joker_big
基础数据集用我们一直在用的 augmented-startups（52 类，顺序 10C,10D,...,QS）。

用法：
  python merge_jokers.py --base path\\to\\Playing-Cards-4 --jokers path\\to\\MyJokers --out merged
合并完得到 merged\\data.yaml，再：
  python train.py --data merged\\data.yaml --model yolov8s.pt --imgsz 960 --epochs 120
"""
import argparse
import os
import shutil
import glob
import yaml

CANON_JOKERS = ["joker_small", "joker_big"]   # 固定追加在 52 类之后 → id 52, 53


def load_names(data_yaml):
    with open(data_yaml, encoding="utf-8") as f:
        d = yaml.safe_load(f)
    names = d.get("names")
    if isinstance(names, dict):
        names = [names[i] for i in sorted(names)]
    return list(names)


def joker_kind(name):
    n = str(name).lower()
    if any(k in n for k in ("small", "black", "小", "黑", "sj")):
        return 0   # joker_small → +0
    if any(k in n for k in ("big", "red", "大", "红", "bj")):
        return 1   # joker_big → +1
    return None


def find_splits(root):
    """返回 [(split_name, images_dir, labels_dir), ...]"""
    out = []
    for split in ("train", "valid", "val", "test"):
        img = os.path.join(root, split, "images")
        lab = os.path.join(root, split, "labels")
        if os.path.isdir(img) and os.path.isdir(lab):
            out.append((("valid" if split == "val" else split), img, lab))
    return out


def copy_split(images_dir, labels_dir, out_split_dir, id_remap=None, prefix=""):
    oi = os.path.join(out_split_dir, "images")
    ol = os.path.join(out_split_dir, "labels")
    os.makedirs(oi, exist_ok=True)
    os.makedirs(ol, exist_ok=True)
    n = 0
    for img in glob.glob(os.path.join(images_dir, "*")):
        base = prefix + os.path.basename(img)
        shutil.copy(img, os.path.join(oi, base))
        stem = os.path.splitext(os.path.basename(img))[0]
        lab = os.path.join(labels_dir, stem + ".txt")
        out_lab = os.path.join(ol, prefix + stem + ".txt")
        if os.path.exists(lab):
            lines = []
            for ln in open(lab, encoding="utf-8"):
                p = ln.split()
                if not p:
                    continue
                cid = int(p[0])
                if id_remap is not None:
                    if cid not in id_remap:
                        continue  # 跳过未知类
                    cid = id_remap[cid]
                lines.append(" ".join([str(cid)] + p[1:]))
            open(out_lab, "w", encoding="utf-8").write("\n".join(lines) + ("\n" if lines else ""))
        else:
            open(out_lab, "w", encoding="utf-8").write("")
        n += 1
    return n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", required=True, help="52类基础数据集根目录(含 data.yaml)")
    ap.add_argument("--jokers", required=True, help="自标大小王数据集根目录(含 data.yaml)")
    ap.add_argument("--out", default="merged")
    a = ap.parse_args()

    base_names = load_names(os.path.join(a.base, "data.yaml"))
    if len(base_names) != 52:
        print(f"⚠ 基础数据集是 {len(base_names)} 类(期望52)。仍按其顺序追加王。")
    jk_names = load_names(os.path.join(a.jokers, "data.yaml"))

    # 王数据集 class id → 合并后新 id(52 或 53)
    offset = len(base_names)
    id_remap = {}
    for jid, jn in enumerate(jk_names):
        k = joker_kind(jn)
        if k is None:
            raise SystemExit(f"无法判断类 '{jn}' 是大王还是小王。请把王的类名改成含 small/black/小/黑 或 big/red/大/红。")
        id_remap[jid] = offset + k
    print("王类映射:", {jk_names[i]: id_remap[i] for i in id_remap})

    merged_names = list(base_names) + CANON_JOKERS

    # 拷贝 base（id 不变）
    for split, img, lab in find_splits(a.base):
        n = copy_split(img, lab, os.path.join(a.out, split))
        print(f"base {split}: {n} 张")
    # 拷贝 jokers（id 重映射，文件名加前缀防冲突）
    for split, img, lab in find_splits(a.jokers):
        n = copy_split(img, lab, os.path.join(a.out, split), id_remap=id_remap, prefix="jk_")
        print(f"joker {split}: {n} 张")

    data = {
        "path": os.path.abspath(a.out),
        "train": "train/images",
        "val": "valid/images" if os.path.isdir(os.path.join(a.out, "valid")) else "train/images",
        "test": "test/images" if os.path.isdir(os.path.join(a.out, "test")) else "",
        "nc": len(merged_names),
        "names": merged_names,
    }
    with open(os.path.join(a.out, "data.yaml"), "w", encoding="utf-8") as f:
        yaml.safe_dump(data, f, allow_unicode=True, sort_keys=False)

    print(f"\n✅ 合并完成 → {a.out}\\data.yaml  共 {len(merged_names)} 类")
    print("最后两类(给网页用的顺序)：", merged_names[-2:], "→ id 52(小王) / 53(大王)")
    print("接着：python train.py --data", os.path.join(a.out, "data.yaml"), "--model yolov8s.pt --imgsz 960 --epochs 120")


if __name__ == "__main__":
    main()
