#!/usr/bin/env python3
"""
Second Spin — pixel-art garment asset generator.

Generates the item lookbook: one small PNG sprite per catalogue garment, plus a
JS catalogue file the site reads, plus a contact sheet for review.

Design notes
------------
* Pure standard library. No Pillow, no network, no build tooling — the PNG
  encoder is ~25 lines at the bottom of this file.
* Sprites are authored on a 24x24 logical grid and written at 4x (96x96) so
  they stay crisp in GitHub previews and scale cleanly in the browser with
  `image-rendering: pixelated`.
* Silhouettes are composed from rectangles, then *auto-outlined* and
  *auto-shaded*. That is what makes 200 sprites look like one coherent set:
  nobody hand-draws outlines, so nothing drifts stylistically.
* Deterministic. Everything derives from a fixed seed, so regenerating produces
  byte-identical output and the catalogue stays stable across runs.

Usage
-----
    python3 tools/generate-assets.py

Writes:
    assets/items/*.png          the sprites
    assets/js/item-catalog.js   catalogue consumed by the site
    docs/contact-sheet.png      every sprite in one image, for review
"""

import json
import os
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

GRID = 32          # logical sprite size (24 was too cramped to read necklines)
SCALE = 4          # output pixels per logical pixel
SEED = 20260923    # fixed, so output is reproducible

ROOT = pathlib.Path(__file__).resolve().parent.parent
ITEMS_DIR = ROOT / "assets" / "items"
JS_OUT = ROOT / "assets" / "js" / "item-catalog.js"
SHEET_OUT = ROOT / "docs" / "contact-sheet.png"

INK = "#16241b"    # shared outline colour, matches the site's --ink

# Shared pixel-art toolkit — the PRNG, colour helpers, Canvas and PNG encoder
# live in pixelkit so the garment and trading-card generators draw through
# exactly one code path and cannot drift apart stylistically.
from pixelkit import (Canvas, Rng, INK, hex_rgb, lighten, darken,   # noqa: E402
                      render_pixels, upscale, write_png)


# ---------------------------------------------------------------------------
# Garment silhouettes
# ---------------------------------------------------------------------------
# 32x32 layout reference
#   torso      x 10..21  (12 wide), starts y7
#   sleeves    x 4..9 (left) / x 22..27 (right), start y8 — one row below the
#              shoulder line, which is what makes the T-silhouette read
#   neckline   cleared from x13..18 — wide and deep enough to actually see
CX0, CX1 = 10, 21          # torso left/right
SL0, SL1 = 5, 9            # left sleeve
SR0, SR1 = 22, 26          # right sleeve


def build_top(c, hem=20, sleeve="short", neck="crew", open_front=False,
              collar=False, hood=False, waist=False, flare=0, wide=False):
    x0, x1 = (CX0 - 1, CX1 + 1) if wide else (CX0, CX1)
    c.rect(x0, 7, x1, hem)                                  # torso
    if flare:
        c.taper(x0, x1, hem - flare * 3, hem, flare)

    if sleeve == "short":
        c.rect(SL0 + 1, 8, SL1, 15); c.rect(SR0, 8, SR1 - 1, 15)
    elif sleeve == "long":
        # Cuffs must sit above the hem, otherwise the sleeves hang past the
        # body and the whole garment reads as an "H" rather than a top.
        cuff = max(12, hem - 2)
        c.rect(SL0, 8, SL1, cuff); c.rect(SR0, 8, SR1, cuff)
        c.rect(SL0, cuff - 1, SL1, cuff, "B")
        c.rect(SR0, cuff - 1, SR1, cuff, "B")
    elif sleeve == "cap":
        c.rect(SL1 - 2, 8, SL1, 12); c.rect(SR0, 8, SR0 + 2, 12)

    # Necklines — cut after the torso so they punch a visible hole
    if neck == "crew":
        c.clear_rect(13, 6, 18, 9)
    elif neck == "v":
        c.clear_rect(13, 6, 18, 8)
        c.clear_rect(14, 9, 17, 10)
        c.clear_rect(15, 11, 16, 12)
    elif neck == "wide":
        c.clear_rect(12, 6, 19, 9)
    elif neck == "high":
        c.rect(13, 5, 18, 8, "B")                           # roll neck
        c.clear_rect(14, 5, 17, 7)

    if collar:
        c.rect(11, 7, 14, 11, "B"); c.rect(17, 7, 20, 11, "B")
    if hood:
        c.rect(12, 2, 19, 8, "B")
        c.clear_rect(14, 2, 17, 5)
    if waist:
        c.rect(x0, hem - 1, x1, hem, "B")                   # ribbed hem
    if open_front:
        c.clear_rect(15, 10, 16, hem)
        for y in range(12, hem - 1, 4):
            c.set(14, y, "A"); c.set(17, y, "A")
    return c


def build_dress(c, sleeve="cap", neck="crew"):
    build_top(c, hem=27, sleeve=sleeve, neck=neck)
    c.rect(CX0, 16, CX1, 17, "B")                           # waist seam
    c.taper(CX0, CX1, 18, 27, 4)                            # skirt flare
    return c


def build_skirt(c, pleated=False):
    c.rect(11, 9, 20, 12, "B")                              # waistband
    c.taper(11, 20, 12, 26, 5)
    if pleated:
        for x in range(6, 27, 4):
            for y in range(15, 27):
                if c.get(x, y) == "X":
                    c.set(x, y, "B")
    return c


def build_trousers(c, length=28, wide=False):
    c.rect(11, 7, 20, 10, "B")                              # waistband
    grow = 3 if wide else 0
    c.rect(11, 10, 20, 15)                                  # seat
    c.taper(11, 14, 15, length, grow)                       # left leg
    c.taper(17, 20, 15, length, grow)                       # right leg
    c.set(15, 8, "A"); c.set(16, 8, "A")                    # button
    return c


def build_vest(c):
    c.rect(CX0, 7, CX1, 21)
    c.clear_rect(13, 6, 18, 9)
    c.clear_rect(15, 10, 16, 21)
    for y in range(12, 20, 3):
        c.set(14, y, "A")
    return c


def build_boots(c):
    for bx in (7, 18):
        c.rect(bx, 8, bx + 5, 24)                           # shaft
        c.rect(bx - 1, 24, bx + 6, 27, "B")                 # sole
        c.set(bx + 1, 11, "A"); c.set(bx + 1, 15, "A")      # eyelets
    return c


def build_sneakers(c):
    for bx in (5, 17):
        c.rect(bx, 14, bx + 8, 21)                          # upper
        c.rect(bx, 21, bx + 9, 24, "B")                     # sole
        c.set(bx + 3, 16, "A"); c.set(bx + 4, 17, "A"); c.set(bx + 5, 18, "A")
    return c


def build_beanie(c, cuff=True):
    c.taper(12, 19, 6, 17, 3)
    if cuff:
        c.rect(10, 17, 21, 21, "B")
    c.rect(15, 3, 16, 6, "A")                               # bobble
    return c


def build_scarf(c):
    c.rect(5, 8, 26, 13)                                    # wrap
    c.clear_rect(13, 8, 18, 10)
    c.rect(11, 13, 14, 27)                                  # hanging ends
    c.rect(17, 13, 20, 27)
    c.rect(11, 25, 14, 27, "B")                             # fringe
    c.rect(17, 25, 20, 27, "B")
    return c


def build_bag(c):
    c.rect(9, 13, 22, 26)                                   # body
    c.rect(9, 13, 22, 17, "B")                              # flap
    for x in (11, 20):                                      # strap
        for y in range(5, 13):
            c.set(x, y, "X")
    c.rect(12, 4, 19, 5, "X")
    c.clear_rect(13, 6, 18, 12)
    c.set(15, 17, "A"); c.set(16, 17, "A")                  # clasp
    return c


def build_shorts(c):
    return build_trousers(c, length=19, wide=True)


def build_coat(c):
    build_top(c, hem=28, sleeve="long", neck="wide", open_front=True,
              collar=True, wide=True)
    c.rect(CX0 - 1, 27, CX1 + 1, 28, "B")
    return c


def build_blazer(c):
    build_top(c, hem=23, sleeve="long", neck="wide", collar=True, open_front=True)
    c.rect(11, 18, 13, 20, "B")                             # pocket flaps
    c.rect(18, 18, 20, 20, "B")
    return c


# type key -> (builder, kwargs, display noun, plural-ish category)
GARMENTS = {
    "tee":        (build_top,      dict(hem=20, sleeve="short", neck="crew"),                 "Tee",          "top"),
    "longsleeve": (build_top,      dict(hem=21, sleeve="long", neck="crew"),                  "Long Sleeve",  "top"),
    "sweater":    (build_top,      dict(hem=22, sleeve="long", neck="crew", waist=True),      "Jumper",       "knit"),
    "rollneck":   (build_top,      dict(hem=22, sleeve="long", neck="high", waist=True),      "Roll Neck",    "knit"),
    "vneck":      (build_top,      dict(hem=21, sleeve="long", neck="v"),                     "V-Neck",       "knit"),
    "cardigan":   (build_top,      dict(hem=23, sleeve="long", neck="wide", open_front=True), "Cardigan",     "knit"),
    "hoodie":     (build_top,      dict(hem=22, sleeve="long", neck="crew", hood=True, waist=True), "Hoodie", "top"),
    "shirt":      (build_top,      dict(hem=22, sleeve="long", neck="wide", collar=True, open_front=True), "Shirt", "shirt"),
    "camp":       (build_top,      dict(hem=20, sleeve="short", neck="wide", collar=True, open_front=True), "Camp-Collar Shirt", "shirt"),
    "blazer":     (build_blazer,   dict(),                                                    "Blazer",       "tailoring"),
    "jacket":     (build_top,      dict(hem=19, sleeve="long", neck="wide", collar=True, waist=True), "Jacket", "outerwear"),
    "coat":       (build_coat,     dict(),                                                    "Coat",         "outerwear"),
    "vest":       (build_vest,     dict(),                                                    "Vest",         "layer"),
    "dress":      (build_dress,    dict(sleeve="cap", neck="crew"),                           "Dress",        "dress"),
    "sundress":   (build_dress,    dict(sleeve="none", neck="wide"),                          "Sundress",     "dress"),
    "skirt":      (build_skirt,    dict(pleated=True),                                        "Pleated Skirt", "bottom"),
    "aline":      (build_skirt,    dict(pleated=False),                                       "A-Line Skirt", "bottom"),
    "jeans":      (build_trousers, dict(length=28),                                           "Jeans",        "bottom"),
    "trousers":   (build_trousers, dict(length=28, wide=True),                                "Trousers",     "bottom"),
    "shorts":     (build_shorts,   dict(),                                                    "Shorts",       "bottom"),
    "boots":      (build_boots,    dict(),                                                    "Boots",        "footwear"),
    "sneakers":   (build_sneakers, dict(),                                                    "Trainers",     "footwear"),
    "beanie":     (build_beanie,   dict(),                                                    "Beanie",       "accessory"),
    "scarf":      (build_scarf,    dict(),                                                    "Scarf",        "accessory"),
    "bag":        (build_bag,      dict(),                                                    "Bag",          "accessory"),
}


# ---------------------------------------------------------------------------
# Patterns — recolour some 'X' to 'B' after the silhouette is built
# ---------------------------------------------------------------------------
def apply_pattern(c, pattern, rng):
    size = c.size
    for y in range(size):
        for x in range(size):
            if c.g[y][x] != "X":
                continue
            hit = False
            if pattern == "stripe_h":
                hit = y % 3 == 0
            elif pattern == "stripe_v":
                hit = x % 3 == 0
            elif pattern == "plaid":
                hit = (y % 4 == 0) or (x % 4 == 0)
            elif pattern == "check":
                hit = ((x // 2) + (y // 2)) % 2 == 0
            elif pattern == "speckle":
                hit = (x * 7 + y * 13) % 11 == 0
            elif pattern == "floral":
                hit = (x % 5 == 2 and y % 5 == 2) or (x % 5 == 3 and y % 5 == 3)
            elif pattern == "colourblock":
                hit = y > size * 0.58
            elif pattern == "distressed":
                hit = (x * 5 + y * 3) % 17 == 0
            if hit:
                c.g[y][x] = "B"
    return c


PATTERNS = ["solid", "solid", "stripe_h", "stripe_v", "plaid", "check",
            "speckle", "floral", "colourblock", "distressed"]

PATTERN_LABEL = {
    "solid": "Solid", "stripe_h": "Horizontal Stripe", "stripe_v": "Vertical Stripe",
    "plaid": "Plaid", "check": "Check", "speckle": "Marled",
    "floral": "Floral", "colourblock": "Colour-block", "distressed": "Distressed",
}


# ---------------------------------------------------------------------------
# Palettes, eras and fabrics per rarity tag
# ---------------------------------------------------------------------------
PALETTES = {
    "rare": [
        ("Avocado",        "#7a8b3c", "#c9b464", "#5c3a21"),
        ("Rust Corduroy",  "#a8502a", "#e0b070", "#3b2a1c"),
        ("Harvest Gold",   "#c99b2e", "#7a5a2a", "#f2e2c0"),
        ("Faded Indigo",   "#4a6285", "#c8d4e2", "#2a3548"),
        ("Burnt Orange",   "#c4622d", "#f0c9a0", "#4a2a18"),
        ("Moss Wool",      "#5e6b4a", "#b8c0a0", "#333a28"),
    ],
    "designer": [
        ("Camel",          "#b9925e", "#f0e4d0", "#3a2c1c"),
        ("Navy Wool",      "#2b3a5c", "#d8dfe8", "#c9a23a"),
        ("Charcoal",       "#3c4048", "#9aa0aa", "#d0d4da"),
        ("Burgundy",       "#6e2233", "#e0c0c8", "#2a1016"),
        ("Cream Silk",     "#efe2c8", "#c9b48c", "#8a7350"),
        ("Forest Cashmere","#274736", "#bcd0c0", "#d8c070"),
    ],
    "statement": [
        ("Magenta",        "#c22e7a", "#f2c0d8", "#5c1238"),
        ("Electric Blue",  "#2a6fd6", "#bcd8f8", "#123566"),
        ("Tangerine",      "#e4722e", "#f8d0a8", "#6e3010"),
        ("Teal Pop",       "#1f8a8a", "#b8e8e4", "#0c4040")  ,
        ("Violet",         "#7b5ea7", "#ddd0ef", "#3a2a55"),
        ("Acid Lime",      "#a8c22e", "#eef8c0", "#4a5c10"),
    ],
    "seasonal": [
        ("Linen Sand",     "#e0d2b4", "#b8a480", "#6e6048"),
        ("Sage Cotton",    "#9fb894", "#e0ead8", "#5a6e50"),
        ("Sky Chambray",   "#8fb4d0", "#dceaf4", "#48688a"),
        ("Flannel Red",    "#a8382e", "#e8c0a8", "#4a1810"),
        ("Autumn Plaid",   "#8a5a3a", "#d8b078", "#3a2418"),
        ("Frost Grey",     "#b4bcc4", "#e8ecf0", "#6a727a"),
    ],
    "everyday": [
        ("Heather Grey",   "#9aa0a4", "#d8dcde", "#55595c"),
        ("Denim Blue",     "#4a6b90", "#c8d8e8", "#2a3c50"),
        ("Black Cotton",   "#3a3d40", "#75797c", "#c0c4c6"),
        ("White Cotton",   "#f0efe8", "#c8c8c0", "#8a8a82"),
        ("Olive Drab",     "#6e7250", "#c0c498", "#3a3c28"),
        ("Oatmeal",        "#d8cdb8", "#a89880", "#6e6450"),
    ],
}

ERAS = {
    "rare":      ["1960s", "1970s", "1970s", "1980s", "1980s", "1990s"],
    "designer":  ["1990s", "2000s", "Heritage", "Archive", "Contemporary"],
    "statement": ["1980s", "1990s", "Y2K", "Handmade", "One-off"],
    "seasonal":  ["Contemporary", "Recent", "Last season"],
    "everyday":  ["Contemporary", "Recent", "Modern"],
}

FABRICS = {
    "rare":      ["Corduroy", "Wool", "Suede", "Waxed Cotton", "Tweed", "Silk", "Denim"],
    "designer":  ["Lambswool", "Cashmere", "Merino", "Gabardine", "Oxford Cotton", "Leather"],
    "statement": ["Mohair", "Sequined", "Embroidered", "Quilted", "Metallic", "Hand-knit"],
    "seasonal":  ["Linen", "Flannel", "Poplin", "Jersey", "Brushed Cotton", "Ripstop"],
    "everyday":  ["Cotton", "Jersey", "Fleece", "Chambray", "Twill", "Marl"],
}

# How many catalogue entries per tag. Breadth deliberately mirrors real stock:
# lots of everyday, few genuine vintage. It is NOT the odds table — that lives
# in site-data.js — it is how many distinct items we photograph per tag.
COUNTS = {"everyday": 60, "seasonal": 45, "statement": 45, "designer": 30, "rare": 20}

# Which garment types suit which tag.
TYPES_FOR = {
    "rare":      ["jacket", "coat", "blazer", "sweater", "cardigan", "dress", "shirt",
                  "jeans", "trousers", "boots", "vest", "scarf", "rollneck", "aline"],
    "designer":  ["blazer", "coat", "sweater", "vneck", "shirt", "trousers", "dress",
                  "boots", "bag", "cardigan", "scarf", "rollneck"],
    "statement": ["cardigan", "dress", "jacket", "sweater", "skirt", "camp", "vest",
                  "sneakers", "beanie", "scarf", "bag", "tee", "rollneck", "sundress"],
    "seasonal":  ["camp", "tee", "shorts", "sundress", "aline", "longsleeve", "vest",
                  "jacket", "beanie", "scarf", "sneakers", "trousers", "skirt"],
    "everyday":  ["tee", "longsleeve", "sweater", "vneck", "jeans", "trousers", "shorts",
                  "hoodie", "shirt", "sneakers", "beanie", "cardigan", "aline", "bag"],
}

RARITY_LABEL = {
    "rare": "Vintage Rare", "designer": "Designer Label", "statement": "Statement Piece",
    "seasonal": "Seasonal Pick", "everyday": "Everyday Staple",
}
RARITY_ORDER = ["rare", "designer", "statement", "seasonal", "everyday"]


# ---------------------------------------------------------------------------
# Catalogue build
# ---------------------------------------------------------------------------
def build_catalog():
    rng = Rng(SEED)
    items = []
    n = 0
    seen_names = set()

    for rarity in RARITY_ORDER:
        types = TYPES_FOR[rarity]
        palettes = PALETTES[rarity]
        for i in range(COUNTS[rarity]):
            n += 1
            tkey = types[i % len(types)]
            builder, kwargs, noun, category = GARMENTS[tkey]
            pal_name, main, secondary, accent = palettes[(i // len(types) + i) % len(palettes)]
            pattern = rng.pick(PATTERNS)
            era = rng.pick(ERAS[rarity])
            fabric = rng.pick(FABRICS[rarity])

            # Draw
            c = Canvas()
            builder(c, **kwargs)
            apply_pattern(c, pattern, rng)
            c.shade()
            c.outline()

            item_id = f"itm-{n:03d}"
            pixels = upscale(render_pixels(c, main, secondary, accent), SCALE)
            write_png(ITEMS_DIR / f"{item_id}.png", pixels)

            name = f"{era} {fabric} {noun}"
            if name in seen_names:
                name = f"{era} {pal_name} {fabric} {noun}"
            suffix = 2
            base = name
            while name in seen_names:
                name = f"{base} ({suffix})"
                suffix += 1
            seen_names.add(name)

            items.append({
                "id": item_id,
                "file": f"assets/items/{item_id}.png",
                "name": name,
                "rarity": rarity,
                "rarityLabel": RARITY_LABEL[rarity],
                "type": tkey,
                "typeLabel": noun,
                "category": category,
                "era": era,
                "fabric": fabric,
                "colourway": pal_name,
                "pattern": PATTERN_LABEL[pattern],
            })
    return items


def write_js(items):
    """Emit a JS file rather than JSON: the site must work from file:// too,
    and fetch() of a local JSON file is blocked there."""
    by_rarity = {r: sum(1 for i in items if i["rarity"] == r) for r in RARITY_ORDER}
    header = f"""/* ==========================================================================
   Second Spin — item lookbook catalogue
   --------------------------------------------------------------------------
   GENERATED FILE — do not edit by hand.
   Regenerate with:  python3 tools/generate-assets.py

   {len(items)} pixel-art garment sprites, each tagged with the rarity band it
   belongs to, so a visitor can see the kind of clothing each tag actually
   means before they buy. Counts per tag reflect catalogue breadth (how many
   distinct items we stock), NOT the draw probabilities — those live in
   site-data.js and are the only numbers that govern what you receive.

   Breadth: {", ".join(f"{RARITY_LABEL[r]} {by_rarity[r]}" for r in RARITY_ORDER)}
   ========================================================================== */

const ITEM_CATALOG = """
    body = json.dumps(items, indent=2, ensure_ascii=False)
    footer = """;

/** All catalogue items carrying a given rarity tag. */
function itemsByRarity(rarityId) {
  return ITEM_CATALOG.filter((i) => i.rarity === rarityId);
}

/** How many distinct items we stock per tag (catalogue breadth, not odds). */
function catalogBreadth() {
  return ITEM_CATALOG.reduce((acc, i) => {
    acc[i.rarity] = (acc[i.rarity] || 0) + 1;
    return acc;
  }, {});
}

/* A top-level `const` is not a property of `window`, so expose the catalogue
   explicitly. Handy for poking at it in the console, and required by the
   test harness, which reads it across an iframe boundary. */
if (typeof window !== 'undefined') {
  window.ITEM_CATALOG = ITEM_CATALOG;
  window.itemsByRarity = itemsByRarity;
  window.catalogBreadth = catalogBreadth;
}
"""
    JS_OUT.write_text(header + body + footer, encoding="utf-8")


def write_contact_sheet(items, cols=20):
    """One image with every sprite, for eyeballing the whole set at once."""
    cell = GRID + 2
    rows = (len(items) + cols - 1) // cols
    w, h = cols * cell, rows * cell
    bg = (247, 242, 230, 255)
    sheet = [[bg for _ in range(w)] for _ in range(h)]

    rng = Rng(SEED)
    for idx, item in enumerate(items):
        # Re-draw at logical size (cheaper than reading the PNGs back)
        tkey = item["type"]
        builder, kwargs, _, _ = GARMENTS[tkey]
        pal = next(p for p in PALETTES[item["rarity"]] if p[0] == item["colourway"])
        pattern = next(k for k, v in PATTERN_LABEL.items() if v == item["pattern"])
        c = Canvas()
        builder(c, **kwargs)
        apply_pattern(c, pattern, rng)
        c.shade()
        c.outline()
        px = render_pixels(c, pal[1], pal[2], pal[3])

        ox = (idx % cols) * cell + 1
        oy = (idx // cols) * cell + 1
        for y in range(GRID):
            for x in range(GRID):
                r, g, b, a = px[y][x]
                if a:
                    sheet[oy + y][ox + x] = (r, g, b, 255)

    write_png(SHEET_OUT, upscale(sheet, 2))


def main():
    ITEMS_DIR.mkdir(parents=True, exist_ok=True)
    SHEET_OUT.parent.mkdir(parents=True, exist_ok=True)
    for old in ITEMS_DIR.glob("itm-*.png"):
        old.unlink()

    items = build_catalog()
    write_js(items)
    write_contact_sheet(items)

    breadth = {}
    for i in items:
        breadth[i["rarity"]] = breadth.get(i["rarity"], 0) + 1
    total_bytes = sum(os.path.getsize(ITEMS_DIR / f"{i['id']}.png") for i in items)

    print(f"generated {len(items)} sprites -> {ITEMS_DIR.relative_to(ROOT)}")
    for r in RARITY_ORDER:
        print(f"  {RARITY_LABEL[r]:18} {breadth.get(r,0):3}")
    print(f"catalogue  -> {JS_OUT.relative_to(ROOT)}")
    print(f"contact    -> {SHEET_OUT.relative_to(ROOT)}")
    print(f"sprite payload: {total_bytes/1024:.1f} KB total, "
          f"{total_bytes/len(items):.0f} bytes average")
    types = sorted({i['type'] for i in items})
    print(f"garment types: {len(types)} ({', '.join(types)})")


if __name__ == "__main__":
    main()
