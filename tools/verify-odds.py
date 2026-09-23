#!/usr/bin/env python3
"""
Cross-checks every published odds figure in the HTML against site-data.js.

The odds appear in a lot of places — tier cards, the shop comparison table, the
FAQ disclosure table, the Trade Up pools, the monthly audit, derived "chance of
a standout" percentages. site-data.js is the source of truth, but the static
tables are hand-authored so the no-JS view still discloses them. This script is
what stops those two drifting apart.

Run after any odds change:  python3 tools/verify-odds.py
Exits non-zero on mismatch.
"""

import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
ORDER = ["rare", "designer", "statement", "seasonal", "everyday"]
LABEL = {
    "rare": "Vintage Rare", "designer": "Designer Label",
    "statement": "Statement Piece", "seasonal": "Seasonal Pick",
    "everyday": "Everyday Staple",
}
RANK = {"everyday": 1, "seasonal": 2, "statement": 3, "designer": 4, "rare": 5}
PROTECTED = ["rare"]
ELIGIBLE_FROM = ["everyday", "seasonal"]

problems = []
checks = 0


def check(cond, msg):
    global checks
    checks += 1
    if not cond:
        problems.append(msg)


# ---------------------------------------------------------------------------
# Parse the source of truth
# ---------------------------------------------------------------------------
data = (ROOT / "assets/js/site-data.js").read_text(encoding="utf-8")

# Scope to the TIERS array — RARITIES above it also has `id:` keys, and an
# unscoped scan silently swallows the first tier.
try:
    block = data[data.index("const TIERS = ["):data.index("const TIER_BY_ID")]
except ValueError:
    sys.exit("could not locate the TIERS array in site-data.js")

tiers = {}
for m in re.finditer(r"id:\s*'(\w+)',(.*?)odds:\s*\{([^}]+)\}", block, re.S):
    tid, body, odds_src = m.group(1), m.group(2), m.group(3)
    odds = {k: int(v) for k, v in re.findall(r"(\w+):\s*(\d+)", odds_src)}
    slots = int(re.search(r"featureSlots:\s*(\d+)", body).group(1))
    price = int(re.search(r"price:\s*(\d+)", body).group(1))
    tiers[tid] = {"odds": odds, "slots": slots, "price": price}

if set(tiers) != {"starter", "classic", "premium"}:
    sys.exit(f"could not parse tiers from site-data.js, got {sorted(tiers)}")


def standout(t):
    miss = t["odds"].get("everyday", 0) / 100
    return round((1 - miss ** t["slots"]) * 1000) / 10


def pcts_to_100(weights):
    total = sum(weights)
    raw = [w / total * 100 for w in weights]
    out = [int(v * 10) / 10 for v in raw]
    deficit = round((100 - sum(out)) * 10)
    order = sorted(range(len(raw)), key=lambda i: raw[i] - out[i], reverse=True)
    for k in range(deficit):
        out[order[k % len(order)]] = round((out[order[k % len(order)]] + 0.1) * 10) / 10
    return out


def trade_pool(t, frm):
    ids = [i for i in ORDER
           if RANK[i] > RANK[frm] and i not in PROTECTED and t["odds"].get(i, 0) > 0]
    if not ids:
        return {}
    return dict(zip(ids, pcts_to_100([t["odds"][i] for i in ids])))


# ---------------------------------------------------------------------------
# 1. Internal integrity
# ---------------------------------------------------------------------------
for tid, t in tiers.items():
    check(sum(t["odds"].values()) == 100,
          f"{tid}: odds sum to {sum(t['odds'].values())}%, not 100%")

for a, b in (("starter", "classic"), ("classic", "premium")):
    check(tiers[a]["odds"]["rare"] < tiers[b]["odds"]["rare"],
          f"price ladder broken: {a} rare >= {b} rare")
    check(tiers[a]["odds"]["everyday"] > tiers[b]["odds"]["everyday"],
          f"price ladder broken: {a} everyday <= {b} everyday")

for tid, t in tiers.items():
    for frm in ELIGIBLE_FROM:
        if not t["odds"].get(frm):
            continue
        pool = trade_pool(t, frm)
        if not pool:
            continue
        check(abs(sum(pool.values()) - 100) < 0.05,
              f"{tid} trade-up from {frm}: pool sums to {sum(pool.values())}%")
        floor = min(pool, key=lambda i: RANK[i])
        check(RANK[floor] > RANK[frm],
              f"{tid} trade-up from {frm}: floor {floor} is not an upgrade")
        check("rare" not in pool,
              f"{tid} trade-up from {frm}: Vintage Rare must never be reachable")

# ---------------------------------------------------------------------------
# 2. HTML must agree with the source of truth
# ---------------------------------------------------------------------------
html = {f.name: f.read_text(encoding="utf-8") for f in ROOT.glob("*.html")}
joined = "\n".join(html.values())

# a) the odds sentence used as the no-JS fallback on tier cards
for tid, t in tiers.items():
    parts = [f"{LABEL[i]} {t['odds'][i]}%" for i in ORDER if t["odds"].get(i, 0) > 0]
    sentence = " · ".join(parts)
    check(sentence in joined,
          f"{tid}: fallback odds sentence not found in any page -> expected '{sentence}'")

# b) derived standout percentages
for tid, t in tiers.items():
    want = standout(t)
    txt = f"{want:g}%"
    check(txt in joined, f"{tid}: standout {txt} not present in HTML")
    # And the stale value must be gone
    for stale in ("45%", "87.8%") if want not in (45, 87.8) else ():
        pass

# c) comparison / disclosure table cells: each tier column value must appear
for i in ORDER:
    row = [tiers[t]["odds"].get(i, 0) for t in ("starter", "classic", "premium")]
    cells = "".join(f'<td style="text-align:left">{v}%</td>' for v in row)
    never = cells.replace(f'<td style="text-align:left">0%</td>',
                          '<td style="text-align:left">never</td>')
    check(cells in joined or never in joined,
          f"{LABEL[i]}: table row {row} not found in shop/faq tables")

# d) FAQ Trade Up pool percentages
faq = html.get("faq.html", "")
for tid, t in tiers.items():
    for frm in ELIGIBLE_FROM:
        pool = trade_pool(t, frm) if t["odds"].get(frm) else {}
        if not pool:
            continue
        for rid, pct in pool.items():
            needle = f"{LABEL[rid].split()[0]} {pct:g}%"
            check(needle in faq,
                  f"faq.html: Trade Up pool figure missing -> '{needle}' ({tid} from {frm})")

# e) monthly audit table published column must match current odds
impact = html.get("impact.html", "")
for i in ORDER:
    pct = tiers["classic"]["odds"][i]
    check(f"<td>{pct}%</td>" in impact,
          f"impact.html: audit table published column missing {LABEL[i]} {pct}%")

# f) stale figures from the previous odds table must be gone everywhere
STALE = ["87.8%", "(0.35 &times; 0.35)", "Everyday Staple 55%", "Everyday Staple 35%",
         "Vintage Rare 6% ", "Vintage Rare 2% "]
for s in STALE:
    check(s not in joined, f"stale figure still present in HTML: '{s}'")

# ---------------------------------------------------------------------------
print(f"verify-odds: {checks} checks")
for tid in ("starter", "classic", "premium"):
    t = tiers[tid]
    print(f"  {tid:9} " + "  ".join(f"{i[:4]} {t['odds'][i]:>2}%" for i in ORDER)
          + f"   standout/box {standout(t):g}%")
if problems:
    print(f"\n{len(problems)} PROBLEM(S):")
    for p in problems:
        print("  !", p)
    sys.exit(1)
print("all published odds figures agree with site-data.js")
