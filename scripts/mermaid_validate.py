#!/usr/bin/env python3
"""Mermaid validation — every ```mermaid block has a known diagram type and a closed fence.
A CI gate (docs/10 §2). Zero deps. Exit 1 on any malformed diagram."""
import re, sys, glob, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TYPES = ("graph", "flowchart", "sequenceDiagram", "erDiagram", "mindmap", "pie",
         "gantt", "classDiagram", "stateDiagram", "journey", "C4", "xychart")

def main() -> int:
    total, bad = 0, []
    for f in glob.glob(os.path.join(ROOT, "docs", "**", "*.md"), recursive=True):
        s = open(f, encoding="utf-8").read()
        rel = os.path.relpath(f, ROOT)
        if s.count("```") % 2:
            bad.append(f"{rel}: unbalanced code fences")
        for block in re.findall(r"```mermaid\s*(.*?)```", s, re.S):
            total += 1
            first = (block.strip().splitlines() or [""])[0].strip()
            if not first.startswith(TYPES):
                bad.append(f"{rel}: unknown diagram type '{first[:30]}'")
    if bad:
        print("MERMAID VALIDATION: FAIL")
        for b in bad:
            print("  " + b)
        return 1
    print(f"MERMAID VALIDATION: PASS ({total} diagrams)")
    return 0

if __name__ == "__main__":
    sys.exit(main())
