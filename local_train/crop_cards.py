#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把整张牌照自动裁成"贴边牌面"。牌是画面里最大的亮白矩形：
用 高亮度&低饱和(白卡) 掩膜，取其主体外接框，留少量边距裁出。"""
import glob, os, sys
import numpy as np
from PIL import Image

def crop_card(im):
    rgb=im.convert("RGB"); W,H=rgb.size
    small=rgb.resize((240, int(240*H/W))) if W>=H else rgb.resize((int(240*W/H),240))
    a=np.asarray(small.convert("HSV"),dtype=np.float32)
    Hh,S,V=a[...,0]/255,a[...,1]/255,a[...,2]/255
    white=(V>0.62)&(S<0.28)                  # 白卡(白边+牌面留白)
    if white.mean()<0.04:                    # 兜底：背景太亮就只用高亮度
        white=V>0.75
    ys=np.where(white.any(1))[0]; xs=np.where(white.any(0))[0]
    if len(xs)==0 or len(ys)==0: return rgb
    # 用列/行投影的累计分位，去掉零散噪点
    col=white.sum(0).astype(float); row=white.sum(1).astype(float)
    def span(p):
        c=np.cumsum(p); c/=c[-1]
        lo=np.searchsorted(c,0.02); hi=np.searchsorted(c,0.98)
        return lo,hi
    x0,x1=span(col); y0,y1=span(row)
    sh,sw=white.shape
    mx=int(0.04*sw); my=int(0.04*sh)
    x0=max(0,x0-mx); x1=min(sw,x1+mx); y0=max(0,y0-my); y1=min(sh,y1+my)
    sx=W/sw; sy=H/sh
    return rgb.crop((int(x0*sx),int(y0*sy),int(x1*sx),int(y1*sy)))

if __name__=="__main__":
    src,dst=sys.argv[1],sys.argv[2]
    for cls in ("big","small"):
        os.makedirs(f"{dst}/{cls}",exist_ok=True)
        for p in sorted(glob.glob(f"{src}/{cls}/*.jpg")):
            crop_card(Image.open(p)).save(f"{dst}/{cls}/{os.path.basename(p)}",quality=92)
        print(cls, len(glob.glob(f"{dst}/{cls}/*.jpg")),"张已裁")
