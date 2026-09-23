#!/usr/bin/env python3
"""
Second Spin — Card Vault sprite generator.

Generates 60 pixel-art trading-card sprites for the collectibles product line,
plus the JS catalogue the site reads.

ORIGINAL ARTWORK ONLY
---------------------
These are deliberately generic collectible-card designs: frame, art window,
abstract elemental sigil, holo treatment, stat pips. No existing franchise's
characters, logos, typefaces, layouts or trade dress are reproduced, and none
should be added here.

Reselling authentic secondhand cards is lawful under first-sale doctrine and
you may describe real inventory factually in copy. Putting another company's
character art or marks into *our own* site assets is a different thing and is
not something this generator will do.

Usage:  python3 tools/generate-cards.py
"""

import json
import os
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

from pixelkit import Canvas, Rng, render_pixels, upscale, write_png  # noqa: E402

GRID = 32
SCALE = 4
SEED = 7734219

ROOT = pathlib.Path(__file__).resolve().parent.parent
CARDS_DIR = ROOT / "assets" / "cards"
JS_OUT = ROOT / "assets" / "js" / "card-catalog.js"
SHEET_OUT = ROOT / "docs" / "card-contact-sheet.png"

# Card geometry on the 32x32 grid — portrait, centred.
CX0, CX1 = 8, 23
CY0, CY1 = 2, 29
ART = (10, 6, 21, 17)          # art window
BAR = (10, 19, 21, 21)         # name bar


# ---------------------------------------------------------------------------
# Elemental sigils — 8x8 original glyphs drawn into the art window
# ---------------------------------------------------------------------------
SIGILS = {
    "ember": [
        "   ##   ",
        "  ####  ",
        " ###### ",
        "###  ###",
        "##    ##",
        "###  ###",
        " ###### ",
        "  ####  ",
    ],
    "tide": [
        "   ##   ",
        "  ####  ",
        " ###### ",
        "########",
        "########",
        "## ## ##",
        " ###### ",
        "  ####  ",
    ],
    "thicket": [
        "     ###",
        "   #####",
        " #######",
        "####### ",
        "#####   ",
        "###  #  ",
        "#    #  ",
        "     #  ",
    ],
    "voltage": [
        "    ####",
        "   ###  ",
        "  ###   ",
        " #######",
        "  ##### ",
        "   ###  ",
        "  ###   ",
        " ##     ",
    ],
    "stone": [
        "  ####  ",
        " ###### ",
        "########",
        "########",
        "########",
        " ###### ",
        "  ####  ",
        "   ##   ",
    ],
    "aether": [
        "   ##   ",
        "   ##   ",
        "## ## ##",
        " ###### ",
        "  ####  ",
        " ###### ",
        "## ## ##",
        "   ##   ",
    ],
}

SIGIL_NAMES = list(SIGILS.keys())


def stamp_scaled(c, pattern, x0, y0, factor, role="A", char="#"):
    """Stamp an ASCII glyph with each source pixel drawn as factor x factor."""
    for dy, line in enumerate(pattern):
        for dx, ch in enumerate(line):
            if ch != char:
                continue
            for sy in range(factor):
                for sx in range(factor):
                    c.set(x0 + dx * factor + sx, y0 + dy * factor + sy, role)


def build_card(c, sigil, holo=False, fullart=False, pips=1, worn=False):
    # Card body + border
    c.rect(CX0, CY0, CX1, CY1, "B")
    c.rect(CX0 + 1, CY0 + 1, CX1 - 1, CY1 - 1, "X")

    if fullart:
        # Art bleeds to the card edge — the "chase" layout
        c.rect(CX0 + 1, CY0 + 1, CX1 - 1, CY1 - 4, "X")
    else:
        c.rect(*ART, "B")
        c.rect(ART[0] + 1, ART[1] + 1, ART[2] - 1, ART[3] - 1, "X")

    # Holo: diagonal sheen across the art window.
    # Drawn in 'L' (highlight), deliberately NOT 'A' — the sigil is 'A', and
    # using one role for both made the sigil vanish into the sheen.
    if holo:
        x0, y0, x1, y1 = ART
        for y in range(y0 + 1, y1):
            for x in range(x0 + 1, x1):
                if (x + y) % 4 == 0:
                    c.set(x, y, "L")

    # Sigil, centred in the art window. Full Art cards get it at 2x so the
    # layout reads as a different product, not just a different colour.
    art_cx = (ART[0] + ART[2]) // 2
    art_cy = (ART[1] + ART[3]) // 2
    if fullart:
        stamp_scaled(c, SIGILS[sigil], art_cx - 7, art_cy - 7, 2, "A")
    else:
        c.stamp(art_cx - 4, art_cy - 4, SIGILS[sigil], "A")

    # Name bar and stat pips
    c.rect(*BAR, "B")
    for i in range(pips):
        c.set(CX0 + 2 + i * 3, CY1 - 3, "A")
        c.set(CX0 + 3 + i * 3, CY1 - 3, "A")

    # Edge wear on older stock — honest about condition
    if worn:
        for i, y in enumerate(range(CY0, CY1 + 1, 5)):
            c.set(CX0, y, " ")
            c.set(CX1, y + 1 if y + 1 <= CY1 else y, " ")
    return c


# ---------------------------------------------------------------------------
# Card rarity ladder — its own ladder, separate from the garment one
# ---------------------------------------------------------------------------
CARD_RARITIES = ["vintage", "holo", "fullart", "uncommon", "common"]
CARD_LABEL = {
    "vintage": "Vintage Holo",
    "holo": "Holo Rare",
    "fullart": "Full Art",
    "uncommon": "Uncommon",
    "common": "Common",
}

PALETTES = {
    "vintage": [
        ("Faded Gold",   "#c9a23a", "#6e5518", "#f4e4b0"),
        ("Aged Cream",   "#e4d8b4", "#8a7340", "#c25c2a"),
        ("Patina Teal",  "#4a8a82", "#1f4a46", "#d8ece8"),
    ],
    "holo": [
        ("Prism Violet", "#7b5ea7", "#3a2a55", "#e8d8ff"),
        ("Prism Azure",  "#2a6fd6", "#123566", "#cfe8ff"),
        ("Prism Rose",   "#c22e7a", "#5c1238", "#ffd8ec"),
    ],
    "fullart": [
        ("Nocturne",     "#2b3a5c", "#111b30", "#f4b429"),
        ("Solar",        "#e4722e", "#6e3010", "#ffe8b0"),
        ("Verdant",      "#3c7a4e", "#183a24", "#d8f0c0"),
    ],
    "uncommon": [
        ("Slate",        "#5a6470", "#2a3038", "#c8d0d8"),
        ("Copper",       "#a8703a", "#4a2e14", "#e8c898"),
        ("Fern",         "#6e8a5a", "#33452a", "#d0e0b8"),
    ],
    "common": [
        ("Newsprint",    "#c8c4b8", "#6e6a60", "#f0eee8"),
        ("Bulk Grey",    "#9aa0a4", "#4a5054", "#dce0e2"),
        ("Plain Buff",   "#d8cdb8", "#7a6e58", "#f4ece0"),
    ],
}

COUNTS = {"common": 18, "uncommon": 16, "fullart": 12, "holo": 9, "vintage": 5}

ERAS = {
    "vintage": ["1996-99 era", "First-run era", "Base-set era"],
    "holo": ["2000s", "2010s", "Modern"],
    "fullart": ["Modern", "Recent set"],
    "uncommon": ["Mixed sets", "Modern"],
    "common": ["Mixed sets", "Bulk lot"],
}
CONDITIONS = {
    "vintage": ["Good", "Very Good", "Excellent"],
    "holo": ["Very Good", "Excellent", "Near Mint"],
    "fullart": ["Excellent", "Near Mint"],
    "uncommon": ["Good", "Very Good", "Excellent"],
    "common": ["Played", "Good", "Very Good"],
}
RESALE = {
    "vintage": "typically resells $40\u2013250",
    "holo": "typically resells $12\u201360",
    "fullart": "typically resells $8\u201335",
    "uncommon": "typically resells $1\u20135",
    "common": "typically resells under $1 individually",
}
SIGIL_LABEL = {
    "ember": "Ember", "tide": "Tide", "thicket": "Thicket",
    "voltage": "Voltage", "stone": "Stone", "aether": "Aether",
}


def build_catalog():
    rng = Rng(SEED)
    items = []
    n = 0
    seen = set()

    for rarity in CARD_RARITIES:
        palettes = PALETTES[rarity]
        for i in range(COUNTS[rarity]):
            n += 1
            sigil = SIGIL_NAMES[i % len(SIGIL_NAMES)]
            pal_name, main, secondary, accent = palettes[i % len(palettes)]
            holo = rarity in ("vintage", "holo")
            fullart = rarity == "fullart"
            worn = rarity in ("vintage", "common") and rng.chance(45)
            pips = 1 + (i % 3)

            c = Canvas(GRID)
            build_card(c, sigil, holo=holo, fullart=fullart, pips=pips, worn=worn)
            c.shade()
            c.outline()

            cid = f"card-{n:03d}"
            write_png(CARDS_DIR / f"{cid}.png",
                      upscale(render_pixels(c, main, secondary, accent), SCALE))

            era = rng.pick(ERAS[rarity])
            cond = rng.pick(CONDITIONS[rarity])
            name = f"{SIGIL_LABEL[sigil]} {CARD_LABEL[rarity]}"
            base = name
            k = 2
            while name in seen:
                name = f"{base} #{k}"
                k += 1
            seen.add(name)

            items.append({
                "id": cid,
                "file": f"assets/cards/{cid}.png",
                "name": name,
                "rarity": rarity,
                "rarityLabel": CARD_LABEL[rarity],
                "type": sigil,
                "typeLabel": SIGIL_LABEL[sigil],
                "category": "card",
                "era": era,
                "condition": cond,
                "colourway": pal_name,
                "resaleBand": RESALE[rarity],
            })
    return items


def write_js(items):
    breadth = {r: sum(1 for i in items if i["rarity"] == r) for r in CARD_RARITIES}
    header = f"""/* ==========================================================================
   Second Spin — Card Vault catalogue
   --------------------------------------------------------------------------
   GENERATED FILE — do not edit by hand.
   Regenerate with:  python3 tools/generate-cards.py

   {len(items)} original pixel-art collectible-card designs, tagged with the
   rarity band they belong to.

   ARTWORK NOTE: these are our own generic card designs — frame, art window,
   abstract elemental sigil, holo treatment. No existing franchise's
   characters, logos or trade dress are reproduced. We resell authentic
   secondhand cards and describe them factually; we do not borrow anybody's
   art for our own assets.

   Breadth: {", ".join(f"{CARD_LABEL[r]} {breadth[r]}" for r in CARD_RARITIES)}
   (Breadth is how many distinct designs we illustrate, NOT draw odds —
   those live in card-data.js.)
   ========================================================================== */

const CARD_CATALOG = """
    footer = """;

function cardsByRarity(rarityId) {
  return CARD_CATALOG.filter((c) => c.rarity === rarityId);
}

function cardBreadth() {
  return CARD_CATALOG.reduce((acc, c) => {
    acc[c.rarity] = (acc[c.rarity] || 0) + 1;
    return acc;
  }, {});
}

/* Top-level `const` is not a window property; expose explicitly for debugging
   and for the test harness, which reads these across an iframe boundary. */
if (typeof window !== 'undefined') {
  window.CARD_CATALOG = CARD_CATALOG;
  window.cardsByRarity = cardsByRarity;
  window.cardBreadth = cardBreadth;
}
"""
    JS_OUT.write_text(header + json.dumps(items, indent=2, ensure_ascii=False) + footer,
                      encoding="utf-8")


def write_contact_sheet(items, cols=12):
    cell = GRID + 2
    rows = (len(items) + cols - 1) // cols
    bg = (247, 242, 230, 255)
    sheet = [[bg for _ in range(cols * cell)] for _ in range(rows * cell)]
    rng = Rng(SEED)
    for idx, it in enumerate(items):
        pal = next(p for p in PALETTES[it["rarity"]] if p[0] == it["colourway"])
        holo = it["rarity"] in ("vintage", "holo")
        fullart = it["rarity"] == "fullart"
        worn = it["rarity"] in ("vintage", "common") and rng.chance(45)
        c = Canvas(GRID)
        build_card(c, it["type"], holo=holo, fullart=fullart,
                   pips=1 + (idx % 3), worn=worn)
        c.shade()
        c.outline()
        px = render_pixels(c, pal[1], pal[2], pal[3])
        ox, oy = (idx % cols) * cell + 1, (idx // cols) * cell + 1
        for y in range(GRID):
            for x in range(GRID):
                r, g, b, a = px[y][x]
                if a:
                    sheet[oy + y][ox + x] = (r, g, b, 255)
    write_png(SHEET_OUT, upscale(sheet, 3))


def main():
    CARDS_DIR.mkdir(parents=True, exist_ok=True)
    SHEET_OUT.parent.mkdir(parents=True, exist_ok=True)
    for old in CARDS_DIR.glob("card-*.png"):
        old.unlink()

    items = build_catalog()
    write_js(items)
    write_contact_sheet(items)

    total = sum(os.path.getsize(CARDS_DIR / f"{i['id']}.png") for i in items)
    print(f"generated {len(items)} card sprites -> {CARDS_DIR.relative_to(ROOT)}")
    for r in CARD_RARITIES:
        print(f"  {CARD_LABEL[r]:14} {sum(1 for i in items if i['rarity']==r):3}")
    print(f"catalogue -> {JS_OUT.relative_to(ROOT)}")
    print(f"contact   -> {SHEET_OUT.relative_to(ROOT)}")
    print(f"payload: {total/1024:.1f} KB, {total/len(items):.0f} bytes average")


if __name__ == "__main__":
    main()
