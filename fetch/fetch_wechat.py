#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Fetch a WeChat (mp.weixin.qq.com) article from a network-unrestricted runner.

Strategy order:
  1. Direct HTTP with several User-Agents (WeChat / mobile / desktop).
  2. r.jina.ai reader proxy fallback (handles JS / anti-bot, returns markdown).

Writes:
  fetch/output/result.md   - title + metadata + extracted body
  fetch/output/status.json - machine-readable status of each attempt
  fetch/output/raw.html    - raw HTML of the best direct attempt (debug)
"""
import sys
import os
import re
import json
import html as htmllib
import urllib.request
import urllib.error

OUT_DIR = os.path.join("fetch", "output")

UAS = [
    ("wechat-ios",
     "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 "
     "(KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.0(0x18000020) "
     "NetType/WIFI Language/zh_CN"),
    ("android-chrome",
     "Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 "
     "(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"),
    ("desktop-chrome",
     "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
     "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"),
]

BLOCK_MARKERS = [
    "环境异常", "去验证", "请在微信客户端打开", "当前环境异常",
    "完成验证", "verify", "二维码", "weixin110", "操作太频繁",
]


def http_get(url, ua, timeout=30):
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": ua,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        data = r.read()
        enc = r.headers.get_content_charset() or "utf-8"
        return r.getcode(), data.decode(enc, errors="replace")


def looks_blocked(html):
    head = html[:6000]
    return any(m in head for m in BLOCK_MARKERS)


def extract(html):
    m = (re.search(r'id="activity-name"[^>]*>(.*?)</h1>', html, re.S)
         or re.search(r'property="og:title"\s+content="(.*?)"', html, re.S)
         or re.search(r"<title>(.*?)</title>", html, re.S))
    title = re.sub(r"<[^>]+>", "", m.group(1)).strip() if m else ""

    am = re.search(r'id="js_name"[^>]*>(.*?)</', html, re.S)
    account = re.sub(r"<[^>]+>", "", am.group(1)).strip() if am else ""

    cm = re.search(r'<div[^>]*id="js_content"[^>]*>(.*?)</div>\s*(?:<script|<div[^>]*id="js_temp)', html, re.S)
    content_html = cm.group(1) if cm else ""

    if not content_html:
        dm = re.search(r'property="og:description"\s+content="(.*?)"', html, re.S)
        body = htmllib.unescape(dm.group(1)).strip() if dm else ""
    else:
        t = re.sub(r"(?i)<\s*br\s*/?>", "\n", content_html)
        t = re.sub(r"(?i)</\s*p\s*>", "\n\n", t)
        t = re.sub(r"(?i)</\s*(div|section|h\d|li)\s*>", "\n", t)
        t = re.sub(r"<[^>]+>", "", t)
        t = htmllib.unescape(t)
        t = re.sub(r"[ \t]+\n", "\n", t)
        body = re.sub(r"\n{3,}", "\n\n", t).strip()

    return title, account, body


def try_direct(url):
    best = None
    for name, ua in UAS:
        try:
            code, html = http_get(url, ua)
        except Exception as e:  # noqa: BLE001
            best = best or {"strategy": "direct:" + name, "ok": False, "error": repr(e)}
            continue
        blocked = looks_blocked(html)
        title, account, body = extract(html)
        rec = {
            "strategy": "direct:" + name,
            "http": code,
            "blocked": blocked,
            "title": title,
            "account": account,
            "body_len": len(body),
            "ok": bool(body) and not blocked,
            "html": html,
            "title_val": title,
            "account_val": account,
            "body_val": body,
        }
        if rec["ok"]:
            return rec
        if best is None or rec.get("body_len", 0) > best.get("body_len", 0):
            best = rec
    return best


def try_jina(url):
    jina = "https://r.jina.ai/" + url
    try:
        code, text = http_get(jina, UAS[2][1], timeout=60)
    except Exception as e:  # noqa: BLE001
        return {"strategy": "jina", "ok": False, "error": repr(e)}
    blocked = looks_blocked(text)
    return {
        "strategy": "jina",
        "http": code,
        "blocked": blocked,
        "body_len": len(text),
        "ok": bool(text.strip()) and not blocked,
        "body_val": text.strip(),
        "title_val": "",
        "account_val": "",
    }


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    urls = []
    arg = sys.argv[1] if len(sys.argv) > 1 else ""
    if arg.strip():
        urls = [arg.strip()]
    else:
        p = os.path.join("fetch", "urls.txt")
        if os.path.exists(p):
            with open(p, encoding="utf-8") as f:
                urls = [ln.strip() for ln in f if ln.strip() and not ln.strip().startswith("#")]

    if not urls:
        print("No URL provided (arg or fetch/urls.txt).")
        sys.exit(1)

    all_status = []
    md_parts = []
    for url in urls:
        attempts = []
        direct = try_direct(url)
        if direct:
            attempts.append({k: v for k, v in direct.items() if k not in ("html", "body_val")})
        chosen = direct if (direct and direct.get("ok")) else None

        if chosen is None:
            jina = try_jina(url)
            attempts.append({k: v for k, v in jina.items() if k != "body_val"})
            if jina.get("ok"):
                chosen = jina

        if direct and direct.get("html"):
            with open(os.path.join(OUT_DIR, "raw.html"), "w", encoding="utf-8") as f:
                f.write(direct["html"])

        all_status.append({"url": url, "attempts": attempts,
                            "resolved": bool(chosen), "via": chosen.get("strategy") if chosen else None})

        md_parts.append("# 抓取结果\n")
        md_parts.append("- URL: %s" % url)
        md_parts.append("- 状态: %s" % ("成功" if chosen else "失败/被拦截"))
        if chosen:
            md_parts.append("- 来源策略: %s" % chosen.get("strategy"))
            if chosen.get("title_val"):
                md_parts.append("- 标题: %s" % chosen["title_val"])
            if chosen.get("account_val"):
                md_parts.append("- 公众号: %s" % chosen["account_val"])
            md_parts.append("\n---\n")
            md_parts.append(chosen.get("body_val", ""))
        else:
            md_parts.append("\n所有策略均未取得正文。各尝试详情见 status.json。\n")
            for a in attempts:
                md_parts.append("- %s: http=%s blocked=%s body_len=%s err=%s"
                                % (a.get("strategy"), a.get("http"), a.get("blocked"),
                                   a.get("body_len"), a.get("error")))

    with open(os.path.join(OUT_DIR, "result.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(md_parts) + "\n")
    with open(os.path.join(OUT_DIR, "status.json"), "w", encoding="utf-8") as f:
        json.dump(all_status, f, ensure_ascii=False, indent=2)

    print(json.dumps(all_status, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
