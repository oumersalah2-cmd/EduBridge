#!/usr/bin/env python3
"""
measure-wer.py - Word Error Rate (WER) Evaluation Script
Part of EduBridge Accessible Media Pipeline (Dev-only)

Compares an ASR draft transcript to a ground-truth human reference text for English (en) and Amharic (am).
Uses `jiwer` if available; otherwise falls back to exact word-level Levenshtein dynamic programming.

Usage:
  python3 measure-wer.py --reference ref.txt --draft draft.txt [--lang en|am]
  python3 measure-wer.py --ref-text "..." --draft-text "..." [--lang en|am]
"""

import sys
import argparse
import re
import json

def normalize_text(text, lang="en"):
    if not text:
        return ""
    text = text.strip()
    # Strip WebVTT headers, cue numbers and timestamps if text is a VTT file
    text = re.sub(r"^WEBVTT[^\n]*\n+", "", text, flags=re.IGNORECASE)
    text = re.sub(r"^\d+\s*$", "", text, flags=re.MULTILINE)
    text = re.sub(r"\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}", "", text)
    
    if lang == "en":
        # Lowercase, remove basic punctuation, collapse whitespace
        text = text.lower()
        text = re.sub(r"[^\w\s']", " ", text)
    elif lang == "am":
        # Keep Ethiopic word characters, remove Latin punctuation and Ethiopic punctuation (። ፣ ፤ ፥ ፦ ፧ ፠)
        text = re.sub(r"[።፣፤፥፦፧፠!?,.:;\"'()\[\]]", " ", text)
    
    text = re.sub(r"\s+", " ", text).strip()
    return text

def compute_wer_dp(ref_words, hyp_words):
    n = len(ref_words)
    m = len(hyp_words)

    if n == 0:
        return (1.0 if m > 0 else 0.0), {"substitutions": 0, "deletions": 0, "insertions": m, "ref_words": 0, "hyp_words": m}

    # dp[i][j] = (dist, sub, del, ins)
    dp = [[(0, 0, 0, 0) for _ in range(m + 1)] for _ in range(n + 1)]

    for i in range(1, n + 1):
        dp[i][0] = (i, 0, i, 0) # all deletions
    for j in range(1, m + 1):
        dp[0][j] = (j, 0, 0, j) # all insertions

    for i in range(1, n + 1):
        for j in range(1, m + 1):
            if ref_words[i - 1] == hyp_words[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]
            else:
                sub = dp[i - 1][j - 1]
                sub_cost = sub[0] + 1

                dele = dp[i - 1][j]
                del_cost = dele[0] + 1

                ins = dp[i][j - 1]
                ins_cost = ins[0] + 1

                min_cost = min(sub_cost, del_cost, ins_cost)
                if min_cost == sub_cost:
                    dp[i][j] = (min_cost, sub[1] + 1, sub[2], sub[3])
                elif min_cost == del_cost:
                    dp[i][j] = (min_cost, dele[1], dele[2] + 1, dele[3])
                else:
                    dp[i][j] = (min_cost, ins[1], ins[2], ins[3] + 1)

    cost, s, d, ins_cnt = dp[n][m]
    wer = cost / float(n)
    return wer, {"substitutions": s, "deletions": d, "insertions": ins_cnt, "ref_words": n, "hyp_words": m}

def main():
    parser = argparse.ArgumentParser(description="Evaluate Word Error Rate (WER) for ASR transcripts.")
    parser.add_argument("--reference", "-r", help="Path to ground truth reference text or VTT file")
    parser.add_argument("--draft", "-d", help="Path to ASR draft transcript or VTT file")
    parser.add_argument("--ref-text", help="Reference string directly")
    parser.add_argument("--draft-text", help="Draft string directly")
    parser.add_argument("--lang", default="en", choices=["en", "am"], help="Language code (en or am)")
    parser.add_argument("--json", action="store_true", help="Output machine-readable JSON")

    args = parser.parse_args()

    ref_raw = ""
    if args.reference:
        with open(args.reference, "r", encoding="utf-8") as f:
            ref_raw = f.read()
    elif args.ref_text:
        ref_raw = args.ref_text

    draft_raw = ""
    if args.draft:
        with open(args.draft, "r", encoding="utf-8") as f:
            draft_raw = f.read()
    elif args.draft_text:
        draft_raw = args.draft_text

    if not ref_raw or not draft_raw:
        sys.stderr.write("Error: Both reference and draft text must be provided via files (--reference, --draft) or strings (--ref-text, --draft-text).\n")
        sys.exit(1)

    ref_norm = normalize_text(ref_raw, args.lang)
    draft_norm = normalize_text(draft_raw, args.lang)

    ref_words = ref_norm.split()
    draft_words = draft_norm.split()

    # Try jiwer first
    used_jiwer = False
    wer_val = None
    stats = {}

    try:
        import jiwer
        wer_val = jiwer.wer(ref_norm, draft_norm)
        used_jiwer = True
    except ImportError:
        pass

    dp_wer, dp_stats = compute_wer_dp(ref_words, draft_words)
    if wer_val is None:
        wer_val = dp_wer
    stats = dp_stats

    result = {
        "language": args.lang,
        "wer": round(wer_val, 4),
        "wer_percent": f"{round(wer_val * 100, 2)}%",
        "reference_word_count": stats["ref_words"],
        "draft_word_count": stats["hyp_words"],
        "substitutions": stats["substitutions"],
        "deletions": stats["deletions"],
        "insertions": stats["insertions"],
        "engine": "jiwer" if used_jiwer else "builtin_dp"
    }

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print("=" * 50)
        print(f"EduBridge WER Benchmark Report ({args.lang.upper()})")
        print("=" * 50)
        print(f"Engine:             {result['engine']}")
        print(f"Word Error Rate:    {result['wer_percent']} (WER = {result['wer']})")
        print(f"Reference Words:    {result['reference_word_count']}")
        print(f"Draft Words:        {result['draft_word_count']}")
        print(f"Substitutions (S):  {result['substitutions']}")
        print(f"Deletions (D):      {result['deletions']}")
        print(f"Insertions (I):     {result['insertions']}")
        print("=" * 50)

if __name__ == "__main__":
    main()
