#!/usr/bin/env python3
"""把 Excel 匯出的 CSV 題目表轉成題庫 JSON。

用法：
    python3 tools/csv2json.py 題目.csv --id cardio --name "心臟內科題庫"

輸出到 docs/data/<id>.json，並自動把題庫加進 docs/data/banks.json。
欄位說明請看 tools/template.csv 與 README。
"""
import argparse
import csv
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "docs" / "data"
LETTERS = "ABCDEF"


def split_list(text):
    """以 ；、; 或 | 分隔多個值，例如參考來源。"""
    return [s.strip() for s in re.split(r"[；;|]", text or "") if s.strip()]


def convert_row(row, line):
    def get(key):
        return (row.get(key) or "").strip()

    options = {k: get(k) for k in LETTERS if get(k)}
    answers = [a.upper() for a in re.split(r"[,，、\s]+", get("answer")) if a]
    q = {
        "id": get("id"),
        "year": int(get("year")) if get("year").isdigit() else get("year"),
        "exam": get("exam"),
        "no": int(get("no")) if get("no").isdigit() else get("no"),
        "topic": get("topic"),
        "stem": get("stem"),
        "options": options,
        "answer": answers[0] if len(answers) == 1 else answers,
    }
    if get("void").lower() in ("1", "y", "yes", "true", "是", "送分"):
        q["void"] = True
    if get("image"):
        q["image"] = get("image")

    ex = {}
    if get("quick"):
        ex["quick"] = get("quick")
    if get("background"):
        ex["background"] = get("background")
    ex_opts = {k: get("ex_" + k) for k in LETTERS if get("ex_" + k)}
    if ex_opts:
        ex["options"] = ex_opts
    if split_list(get("sources")):
        ex["sources"] = split_list(get("sources"))
    if ex:
        q["explanation"] = ex

    if not q["id"]:
        sys.exit(f"第 {line} 行缺少 id")
    return {k: v for k, v in q.items() if v not in ("", None)}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("csv", type=Path)
    ap.add_argument("--id", required=True, help="題庫代號（英數，用於網址與檔名）")
    ap.add_argument("--name", required=True, help="題庫顯示名稱")
    ap.add_argument("--year-prefix", default="", help="年度前綴，例如「民國」")
    args = ap.parse_args()

    # utf-8-sig：Excel 存成「CSV UTF-8」時開頭會有 BOM
    with args.csv.open(encoding="utf-8-sig", newline="") as f:
        questions = [convert_row(r, i) for i, r in enumerate(csv.DictReader(f), start=2)]

    topics = list(dict.fromkeys(q["topic"] for q in questions if q.get("topic")))
    bank = {
        "id": args.id,
        "name": args.name,
        "yearPrefix": args.year_prefix,
        "topics": topics,
        "questions": questions,
    }
    out = DATA / f"{args.id}.json"
    out.write_text(json.dumps(bank, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    banks_path = DATA / "banks.json"
    cfg = json.loads(banks_path.read_text(encoding="utf-8"))
    entry = {"id": args.id, "name": args.name, "file": out.name}
    cfg["banks"] = [b for b in cfg["banks"] if b["id"] != args.id] + [entry]
    banks_path.write_text(json.dumps(cfg, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"已輸出 {len(questions)} 題 → {out.relative_to(ROOT)}，並更新 banks.json")
    print("建議接著執行：python3 tools/validate.py")


if __name__ == "__main__":
    main()
