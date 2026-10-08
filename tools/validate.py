#!/usr/bin/env python3
"""檢查 docs/data 裡所有題庫是否格式正確。

用法：python3 tools/validate.py
有錯誤時會列出每一題的問題並以非 0 結束碼離開。
"""
import json
import sys
from pathlib import Path

DOCS = Path(__file__).resolve().parent.parent / "docs"
LETTERS = set("ABCDEF")


def check_bank(path):
    errors = []
    try:
        bank = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        return [f"JSON 格式錯誤：第 {e.lineno} 行第 {e.colno} 欄 {e.msg}"], 0

    topics = bank.get("topics")
    seen = set()
    for i, q in enumerate(bank.get("questions", []), start=1):
        where = f"第 {i} 題（id={q.get('id', '?')}）"
        for key in ("id", "year", "stem", "options", "answer"):
            if key not in q or q[key] in ("", None, {}, []):
                errors.append(f"{where}：缺少 {key}")
        if q.get("id") in seen:
            errors.append(f"{where}：id 重複")
        seen.add(q.get("id"))

        opts = q.get("options") or {}
        bad_keys = set(opts) - LETTERS
        if bad_keys:
            errors.append(f"{where}：選項代號只能是 A–F，發現 {sorted(bad_keys)}")
        answers = q.get("answer")
        answers = answers if isinstance(answers, list) else [answers]
        for a in answers:
            if a not in opts:
                errors.append(f"{where}：答案 {a} 不在選項裡")

        if topics and q.get("topic") and q["topic"] not in topics:
            errors.append(f"{where}：主題「{q['topic']}」沒有列在 topics 裡")
        if q.get("image") and not q["image"].startswith(("http://", "https://")):
            if not (DOCS / q["image"]).is_file():
                errors.append(f"{where}：找不到圖片 docs/{q['image']}")

        ex_opts = (q.get("explanation") or {}).get("options") or {}
        extra = set(ex_opts) - set(opts)
        if extra:
            errors.append(f"{where}：逐選項解析有不存在的選項 {sorted(extra)}")
    return errors, len(bank.get("questions", []))


def main():
    data = DOCS / "data"
    cfg = json.loads((data / "banks.json").read_text(encoding="utf-8"))
    total_errors = 0
    for b in cfg["banks"]:
        path = data / b["file"]
        if not path.is_file():
            print(f"✗ {b['file']}：檔案不存在")
            total_errors += 1
            continue
        errors, n = check_bank(path)
        if errors:
            print(f"✗ {b['file']}：{len(errors)} 個問題")
            for e in errors:
                print("   - " + e)
        else:
            print(f"✓ {b['file']}：{n} 題，格式正確")
        total_errors += len(errors)
    sys.exit(1 if total_errors else 0)


if __name__ == "__main__":
    main()
