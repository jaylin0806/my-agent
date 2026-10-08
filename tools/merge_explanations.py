#!/usr/bin/env python3
"""把詳解檔合併進題庫 JSON。

用法：
    python3 tools/merge_explanations.py docs/data/peds.json tools/explanations/peds-cardio.json [--draft]

詳解檔格式：{ "題目id": { "quick": ..., "background": ..., "options": {...}, "sources": [...] } }
加上 --draft 會把這批詳解標記為「草稿、尚待審閱」，網頁上會顯示提示；
審閱完成後不加 --draft 重新合併一次即可移除標記。
"""
import argparse
import json
import sys
from pathlib import Path


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("bank", type=Path)
    ap.add_argument("explanations", type=Path)
    ap.add_argument("--draft", action="store_true", help="標記為尚待審閱的草稿")
    args = ap.parse_args()

    bank = json.loads(args.bank.read_text(encoding="utf-8"))
    exps = json.loads(args.explanations.read_text(encoding="utf-8"))
    by_id = {q["id"]: q for q in bank["questions"]}

    missing = [qid for qid in exps if qid not in by_id]
    if missing:
        sys.exit(f"題庫裡找不到這些 id：{missing}")

    for qid, ex in exps.items():
        ex = dict(ex)
        ex.pop("draft", None)
        if args.draft:
            ex["draft"] = True
        by_id[qid]["explanation"] = ex

    args.bank.write_text(json.dumps(bank, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    label = "（草稿）" if args.draft else ""
    print(f"已合併 {len(exps)} 題詳解{label} → {args.bank}")


if __name__ == "__main__":
    main()
