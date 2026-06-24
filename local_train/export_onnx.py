#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把训练出的 best.pt 导出成网页用的 best.onnx。

用法：
  python export_onnx.py                 # 自动找最新 best.pt，导出 960
  python export_onnx.py --imgsz 640     # 想要手机端更快就导 640
  python export_onnx.py --weights runs_guandan\\guandan\\weights\\best.pt --imgsz 960

注意：导出的 imgsz 必须和网页 camera.html 里的 INPUT 一致——
不过 camera.html 现在会“自动探测”模型输入尺寸，所以一般不用改网页。
"""
import argparse
import glob
import os
from ultralytics import YOLO


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--weights", default="")
    ap.add_argument("--imgsz", type=int, default=960)
    a = ap.parse_args()

    w = a.weights
    if not w:
        cands = sorted(glob.glob("runs_guandan/**/weights/best.pt", recursive=True)
                       + glob.glob("runs/**/weights/best.pt", recursive=True),
                       key=os.path.getmtime)
        if not cands:
            raise SystemExit("没找到 best.pt，请用 --weights 指定，或先训练。")
        w = cands[-1]
    print("导出模型：", w, " imgsz=", a.imgsz)
    out = YOLO(w).export(format="onnx", imgsz=a.imgsz, opset=12, simplify=True)
    print("已导出：", out)
    print("把这个 .onnx 改名为 best.onnx，上传到仓库 webapp/ 覆盖旧的即可。")


if __name__ == "__main__":
    main()
