# 本地 4090 训练扑克牌识别（Windows，从零到能训练）

你的 4090 笔记本比 Colab 免费 GPU 强 ~3–4 倍、且**没有额度限制**。配好一次环境，以后所有训练/导出都在本地跑。

---

## 一、装环境（一次性）

> 全程用 **PowerShell** 或 **CMD**。关键点：**装 PyTorch 必须用带 CUDA 的命令**，否则 pip 默认装成 CPU 版，显卡用不上。

```powershell
:: 1) 确认显卡驱动 OK（看到右上角 CUDA Version 即可，不用单独装 CUDA Toolkit）
nvidia-smi

:: 2) 装 Python 3.11（python.org 下载，安装时勾选 Add python.exe to PATH）
python --version

:: 3) 在项目文件夹建虚拟环境并激活
python -m venv venv
venv\Scripts\activate
python -m pip install --upgrade pip

:: 4) ★装带 CUDA 的 PyTorch（4090=Ada架构，用 cu124 轮子）
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124

:: 5) 验证显卡可用（必须打印 CUDA available: True 和 你的4090名字）
python -c "import torch; print(torch.__version__); print('CUDA available:', torch.cuda.is_available()); print('Device:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU')"

:: 6) 装 ultralytics（一定在装好 GPU 版 torch 之后再装）
pip install ultralytics onnx onnxruntime

:: 7) 自检（会打印 torch/CUDA/设备）
yolo checks
```

**常见坑**
- `CUDA available: False` 或 torch 版本号带 `+cpu`：说明装成 CPU 版了。重新执行第 4 步（带 `--index-url` 那条）。
- 先装了 ultralytics 再装 torch：ultralytics 可能顺手拉了 CPU 版 torch。顺序要反过来（先 torch-cuda 再 ultralytics），或装完再用第 4 步覆盖。
- 显存不够（OOM）：训练命令里把 `--batch -1` 改成 `--batch 8`，或把 `--imgsz` 调小（960→640）。
- 中文路径有时出问题：项目放纯英文路径（如 `D:\guandan`）。

---

## 二、拿到数据集（52 类基础牌面）

公开数据集没有能区分大小王的（见 `vision/加大小王方案.md`），所以**先用 52 类基础数据**（就是 Colab 里用的 augmented-startups）。两种拿法：
- 在 Colab 里你已经下过 `Playing-Cards-4`，把那个文件夹打包下载到本地即可；
- 或本地用 roboflow 包下载：`pip install roboflow`，再用数据集页面的 download code（需要你的 API key）。

---

## 三、训练 / 导出（命令）

```powershell
:: 先验证环境：只训 52 类、imgsz 960、80 轮
python train.py --data D:\guandan\Playing-Cards-4\data.yaml --model yolov8s.pt --imgsz 960 --epochs 80

:: 训练完导出网页用的 onnx
python export_onnx.py --imgsz 960
```
导出的 onnx 改名 `best.onnx`，上传到仓库 `webapp/` 覆盖旧的即可（网页会自动探测输入尺寸，不用改代码）。

> `yolov8s`（s=small）比 `yolov8n` 更准，4090 完全带得动；要再准用 `yolov8m`。
> `imgsz 960` 对"27 张挤一起、角标小"明显比 640 好；想手机端更快可同时另导一个 640 版。

---

## 四、加大小王（54 类）的完整流程

详见 **`vision/加大小王方案.md`**。

> 本项目这副牌（三A扑克 AAA）：**小王=纯黑白印刷，大王=彩色印刷**，图案相同、靠颜色区分。
> 已用这条规律从聊天记录里自动把照片分成两类：`cards/big/`(大王彩色 8 张)、`cards/small/`(小王黑白 7 张)。

### 推荐：用 `gen_joker_data.py` 自动合成 + 自动打标（不用手画一个框）★
王只是一张固定的牌，所以不必去网上找几百张图、也不必在 Roboflow 一张张手标。
你只要拍**自己那副牌**的大小王各几张，脚本把它随机贴到各种背景上（旋转/缩放/明暗/位置随机），
**因为是程序贴的，框的位置脚本自己知道 → 自动写出 YOLO 标注**，一键生成 200+200 张带标注数据。

```text
准备真牌图（jpg/png 都行，透明背景 PNG 抠图最好；普通牌面照也能用）：
  cards/
    small/   小王(黑王) 几张~十几张
    big/     大王(红王) 几张~十几张
可选 backgrounds/ 放些牌桌/桌面照（不给就用程序生成背景）
```
```powershell
:: ① 先把整张牌照自动裁成贴边牌面(去掉大圈桌面背景，框更准)
python crop_cards.py cards cards_crop
:: ② 用裁好的牌面各生成 200 张（含自动标注）
python gen_joker_data.py --cards cards_crop --backgrounds backgrounds --per-class 200 --out joker_dataset
:: 没真牌？先验证管线能跑通（占位假牌，不能用于真训练）：
python gen_joker_data.py --demo --per-class 20 --out joker_demo
```
得到的 `joker_dataset`(约116M，已在 .gitignore，需本地生成) 直接当下面第 3 步的 `--jokers`。
> 提示：拍牌时尽量**平放正拍**（别斜放），裁出的牌面更干净、框更紧。

### 备选：手动在 Roboflow 标
1. 自己拍大王(红)/小王(黑)各几十张照片，在 Roboflow 标成两类（类名含 `small`/`big`）。
   图片存 **JPG/PNG**，导出选 **YOLOv8 (YOLO TXT)**。
2. 导出 YOLOv8 格式，得到一个小数据集。
3. 合并进 52 类基础数据：
   ```powershell
   python merge_jokers.py --base D:\guandan\Playing-Cards-4 --jokers D:\guandan\MyJokers --out merged
   ```
4. 训练 54 类：
   ```powershell
   python train.py --data merged\data.yaml --model yolov8s.pt --imgsz 960 --epochs 120
   python export_onnx.py --imgsz 960
   ```
5. 上传新 `best.onnx` 到 `webapp/`；并把网页 `camera.html` 的 `CLASS_NAMES` 换成 54 类（把 merged/data.yaml 的 names 发我，我帮你改）。
