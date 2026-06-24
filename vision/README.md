# vision/ —— 扑克牌识别（换环境训练）

这是"摄像头认牌"那一块。**这个目录里都是代码和说明，本身不会训练**；
你把它拿到一台带 GPU 的机器（推荐免费的 Google Colab）上跑，练出模型文件再装回 App。

## 这里有什么
| 文件 | 作用 |
|---|---|
| `train_colab.ipynb` | **Colab 一键训练笔记本**：上传到 Colab → 全部运行 → 产出模型 |
| `recognize.py` | 拿到模型后的推理脚本：照片 → 识别牌 → 自动组牌 + 出牌建议（直接调用 `guandan/` 引擎）|

## 一、什么是 Colab（一句话）
谷歌免费借你的"云端带显卡电脑"，浏览器里用、啥都不用装，还白送 GPU。
登录 `colab.research.google.com`，把笔记本上传进去点"全部运行"即可。

## 二、训练步骤（最省事路线：Colab）
1. 打开 https://colab.research.google.com ，用 Google 账号登录。
2. 「文件 → 上传笔记本」，选本目录的 `train_colab.ipynb`。
3. 「运行时 → 更改运行时类型 → 硬件加速器选 GPU」。
4. 准备数据集：去 https://roboflow.com 免费注册拿 API Key，搜 `playing cards`
   数据集，把笔记本第 3 格里的 `YOUR_API_KEY` 和 workspace/project/version 换成你的。
5. 「运行时 → 全部运行」。它会自动下载数据、训练（50 轮约几十分钟）、导出模型。
6. 最后一格会自动下载 `best.pt` 和 `best.onnx` 到你电脑。

> 大小王：标准数据集是 52 张、不含王。掼蛋要识别大小王，可在数据集里补标 2 类
> （joker_small / joker_big）再训练；或先只认 52 张，王用手动补录。

## 三、拿回模型后怎么用
1. 把下载的 `best.pt` 放到本目录 `vision/best.pt`。
2. 在装了 `ultralytics` 的机器上：
   ```bash
   pip install ultralytics
   python vision/recognize.py 牌桌照片.jpg --level 2
   ```
   它会打印：识别到的牌 → 自动组牌 → 出牌建议。
3. **不带图片**直接 `python vision/recognize.py` 会跑内置示例，演示"识别→组牌→建议"
   链路（无需 GPU/ultralytics），用于先验证桥接逻辑。

## 四、装到手机 / 眼镜
- 手机网页版（`webapp/`）：把 `best.onnx` 转成 **TF.js** 或用 **onnxruntime-web**，
  在浏览器里直接跑识别，结果喂给现有的 `guandan.js`（`decompose`/`advise`）。
- 手机原生 / 眼镜：把模型转 **TFLite/NCNN** 在设备端跑，识别结果同样接进引擎。

## 五、识别准确率怎么提高（对应"最大限度提高识别"）
- 数据多样化：不同光线、角度、遮挡、不同牌面印刷都要有样本。
- 自己补采集：手机多拍几副牌的照片，用 Roboflow/labelImg 标注后并入数据集再训练。
- 换更大模型：`yolov8n`(快) → `yolov8s/m`(更准)。
- 提分辨率：`imgsz=640 → 960`，对小牌、远处牌更友好。
- 半遮挡也能认：训练集里多放"牌叠在一起、只露一角"的样本。

## 现实说明
- 训练/运行视觉模型需要 GPU 与数据集，**无法在 Claude 的云沙箱里完成**（出口受限、无 GPU/摄像头），
  所以才"换环境"到 Colab/本地。引擎(`guandan/`)这端已经准备好接收识别结果。
- "棋力到顶尖职业"是另一项更重的强化学习工程（参考斗地主 DouZero / 掼蛋 DanZero），不在本目录范围内。
