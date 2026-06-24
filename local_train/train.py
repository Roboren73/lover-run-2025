#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""本地 4090 训练扑克牌识别（YOLOv8）。

示例：
  # 先只训 52 类（验证环境）：
  python train.py --data path\\to\\Playing-Cards\\data.yaml --imgsz 960 --epochs 80

  # 合并大小王后训 54 类（推荐 yolov8s，更准）：
  python train.py --data merged\\data.yaml --model yolov8s.pt --imgsz 960 --epochs 120

参数说明：
  --imgsz  输入分辨率。一手27张挤一起、角标小 → 960 比 640 明显更准；1280 更准但更慢。
  --batch  -1 让 ultralytics 按显存自动选；4090 笔记本 16G 显存通常能吃 imgsz960/batch16~24。
"""
import argparse
from ultralytics import YOLO


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True, help="data.yaml 路径")
    ap.add_argument("--model", default="yolov8s.pt", help="yolov8n/s/m.pt，越大越准越慢")
    ap.add_argument("--imgsz", type=int, default=960)
    ap.add_argument("--epochs", type=int, default=100)
    ap.add_argument("--batch", type=int, default=-1)
    ap.add_argument("--device", default="0", help="0=第一块GPU；cpu=用CPU")
    ap.add_argument("--name", default="guandan")
    a = ap.parse_args()

    model = YOLO(a.model)
    model.train(
        data=a.data, imgsz=a.imgsz, epochs=a.epochs, batch=a.batch,
        device=a.device, project="runs_guandan", name=a.name, patience=30,
        # 针对“密集小目标 + 多角度握牌”的增强：
        mosaic=1.0, scale=0.5, degrees=8, translate=0.1, fliplr=0.0,
    )
    print(f"\n训练完成。最佳权重：runs_guandan\\{a.name}\\weights\\best.pt")
    print("接着运行：python export_onnx.py  导出给网页用的 best.onnx")


if __name__ == "__main__":
    main()
