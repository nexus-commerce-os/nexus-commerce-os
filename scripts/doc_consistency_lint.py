#!/usr/bin/env python3
"""
Doc-consistency lint — a certified CI fitness function (docs/04 §10, wired in docs/10 §2).

Breaks the ADR->doc propagation-failure class that adversarial reviews R4/R5 repeatedly caught:
a decision fixed in an ADR but left stale in the canonical docs. Fails the build (exit 1) on:
  1. BANNED / retired terms   (attacker-exploitable or superseded wording)
  2. DANGLING intra-repo anchors  (every ](file.md#slug) must resolve to a real heading slug)
  3. BROKEN relative links     (target file must exist)

Dated review artifacts (docs/review/*) and this lint's own definition are exempt.
Zero third-party deps; runs anywhere Python 3.8+ exists.
"""
import re, os, sys, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILES = glob.glob(os.path.join(ROOT, "docs", "**", "*.md"), recursive=True) + [
    os.path.join(ROOT, "PROJECT_MEMORY.md")
]
REL = lambda p: os.path.relpath(p, ROOT).replace("\\", "/")

# Retired/banned terms. Each is a (regex, human-name). Exemptions handled per-line below.
BANNED = [
    (re.compile(r"\blast-writer-by-network-timestamp\b"), "attacker-controllable reversal ordering"),
    (re.compile(r"(?<![-\w])[Ee]xactly-once(?![-\w])"), "unqualified 'exactly-once' (use effectively-once)"),
    (re.compile(r"promised / pending / confirmed / clawed-back"), "retired savings vocabulary (use four-state)"),
]
ANCHOR_LINK = re.compile(r"\]\((?!https?://)([^)]+)\)")


def gh_slug(heading: str) -> str:
    """GitHub-compatible heading slug (link text only; keeps underscores; strips punctuation)."""
    h = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", heading)  # [text](url) -> text
    h = re.sub(r"[`*]", "", h)
    s = re.sub(r"[^\w\s-]", "", h.strip().lower())
    return s.replace(" ", "-")


def build_slugs(text: str):
    seen, out = {}, set()
    for m in re.finditer(r"^#{1,6}\s+(.*)$", text, re.M):
        base = gh_slug(m.group(1))
        n = seen.get(base, 0)
        out.add(base if n == 0 else f"{base}-{n}")
        seen[base] = n + 1
    return out


def main() -> int:
    texts = {REL(f): open(f, encoding="utf-8").read() for f in FILES}
    slugs = {f: build_slugs(t) for f, t in texts.items()}
    failures = []

    for f, s in texts.items():
        historical = f.startswith("docs/review/") or f.endswith("ADR-INDEX-lineage.md") or f == "PROJECT_MEMORY.md"
        d = os.path.dirname(f)

        # 1. banned terms
        if not historical:
            for i, line in enumerate(s.splitlines(), 1):
                low = line.lower()
                if "banned" in low or "lint" in low:  # this lint's own definition
                    continue
                for rx, name in BANNED:
                    if rx.search(line):
                        if "exactly-once" in name and ("effectively-once" in low or "at-least-once" in low):
                            continue
                        failures.append(f"BANNED-TERM  {f}:{i}  {name}")

        # 2/3. links + anchors
        for m in ANCHOR_LINK.finditer(s):
            raw = m.group(1)
            if raw == "file.md#slug":  # lint doc example
                continue
            if raw.startswith("#"):
                tgt, frag = f, raw[1:]
            else:
                path, _, frag = raw.partition("#")
                tgt = REL(os.path.normpath(os.path.join(ROOT, d, path)))
                if not os.path.exists(os.path.join(ROOT, tgt)):
                    failures.append(f"BROKEN-LINK  {f}  ->  {raw}")
                    continue
            if frag and not f.startswith("docs/review/") and tgt in slugs and frag not in slugs[tgt]:
                failures.append(f"DANGLING-ANCHOR  {f}  ->  {raw}")

    if failures:
        print("DOC-CONSISTENCY LINT: FAIL")
        for x in sorted(set(failures)):
            print("  " + x)
        return 1
    print(f"DOC-CONSISTENCY LINT: PASS ({len(texts)} files, 0 issues)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
