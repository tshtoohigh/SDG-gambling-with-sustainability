#!/usr/bin/env python3
"""
Shared pixel-art toolkit for Second Spin's asset generators.

Used by generate-assets.py (garments) and generate-cards.py (trading cards) so
both product lines are drawn by exactly one code path and cannot drift apart
stylistically.

Everything here is pure standard library — the PNG encoder at the bottom is
zlib + struct. No Pillow, no network, no build step.
"""

import struct
import zlib

# Shared outline colour, matches the site's --ink token.
INK = "#16241b"


# ---------------------------------------------------------------------------
# Deterministic PRNG (linear congruential)
# ---------------------------------------------------------------------------
class Rng:
    """Tiny LCG. Avoids depending on the stability of random's internals across
    Python versions, which would make generated output non-reproducible."""

    def __init__(self, seed):
        self.s = seed & 0xFFFFFFFF

    def next(self):
        self.s = (1103515245 * self.s + 12345) & 0x7FFFFFFF
        return self.s

    def pick(self, seq):
        return seq[self.next() % len(seq)]

    def chance(self, pct):
        return (self.next() % 100) < pct


# ---------------------------------------------------------------------------
# Colour helpers
# ---------------------------------------------------------------------------
def hex_rgb(h):
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def mix(c, target, amount):
    return tuple(round(a + (b - a) * amount) for a, b in zip(c, target))


def lighten(c, amount):
    return mix(c, (255, 255, 255), amount)


def darken(c, amount):
    return mix(c, (0, 0, 0), amount)


# ---------------------------------------------------------------------------
# Canvas
# ---------------------------------------------------------------------------
# Role codes stored in the grid:
#   ' ' transparent   'X' main      'B' secondary (pattern/trim)
#   'A' accent        'O' outline   'L' highlight (derived)
#   'S' shadow (derived)
class Canvas:
    def __init__(self, size=32):
        self.size = size
        self.g = [[" "] * size for _ in range(size)]

    def set(self, x, y, role):
        if 0 <= x < self.size and 0 <= y < self.size:
            self.g[y][x] = role

    def get(self, x, y):
        if 0 <= x < self.size and 0 <= y < self.size:
            return self.g[y][x]
        return " "

    def rect(self, x0, y0, x1, y1, role="X"):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.set(x, y, role)

    def clear_rect(self, x0, y0, x1, y1):
        self.rect(x0, y0, x1, y1, " ")

    def frame(self, x0, y0, x1, y1, role="B"):
        """Hollow rectangle — one pixel thick."""
        self.rect(x0, y0, x1, y0, role)
        self.rect(x0, y1, x1, y1, role)
        self.rect(x0, y0, x0, y1, role)
        self.rect(x1, y0, x1, y1, role)

    def taper(self, x0, x1, y0, y1, grow, role="X"):
        """A shape that widens (grow>0) or narrows (grow<0) toward the bottom."""
        rows = max(1, y1 - y0)
        for i, y in enumerate(range(y0, y1 + 1)):
            d = round(grow * i / rows)
            self.rect(x0 - d, y, x1 + d, y, role)

    def stamp(self, x0, y0, pattern, role="A", char="#"):
        """Draw an ASCII sprite fragment at an offset."""
        for dy, line in enumerate(pattern):
            for dx, ch in enumerate(line):
                if ch == char:
                    self.set(x0 + dx, y0 + dy, role)

    def solid(self):
        return {"X", "B", "A", "L", "S"}

    def outline(self):
        """Any transparent pixel touching fabric becomes outline."""
        solid = self.solid()
        adds = []
        for y in range(self.size):
            for x in range(self.size):
                if self.g[y][x] != " ":
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    if self.get(x + dx, y + dy) in solid:
                        adds.append((x, y))
                        break
        for x, y in adds:
            self.set(x, y, "O")

    def shade(self):
        """Top-lit: highlight the top edge of a form, shadow the bottom."""
        solid = self.solid()
        out = [row[:] for row in self.g]
        for y in range(self.size):
            for x in range(self.size):
                if self.g[y][x] not in ("X", "B"):
                    continue
                if self.get(x, y - 1) not in solid:
                    out[y][x] = "L"
                elif self.get(x, y + 1) not in solid:
                    out[y][x] = "S"
        self.g = out

    def rows(self):
        return self.g


# ---------------------------------------------------------------------------
# Rendering
# ---------------------------------------------------------------------------
def render_pixels(canvas, main, secondary, accent):
    """Role grid -> RGBA pixel grid at logical resolution."""
    m, s2, a = hex_rgb(main), hex_rgb(secondary), hex_rgb(accent)
    colours = {
        "X": m,
        "L": lighten(m, 0.22),
        "S": darken(m, 0.24),
        "B": s2,
        "A": a,
        "O": hex_rgb(INK),
    }
    out = []
    for row in canvas.rows():
        line = []
        for role in row:
            if role == " ":
                line.append((0, 0, 0, 0))
            else:
                r, g, b = colours[role]
                line.append((r, g, b, 255))
        out.append(line)
    return out


def upscale(pixels, factor):
    out = []
    for row in pixels:
        big = []
        for px in row:
            big.extend([px] * factor)
        for _ in range(factor):
            out.append(list(big))
    return out


def write_png(path, pixels):
    """Minimal 8-bit RGBA PNG encoder."""
    h = len(pixels)
    w = len(pixels[0])
    raw = bytearray()
    for row in pixels:
        raw.append(0)                       # filter type 0 (None)
        for (r, g, b, a) in row:
            raw += bytes((r, g, b, a))

    def chunk(typ, data):
        return (struct.pack(">I", len(data)) + typ + data
                + struct.pack(">I", zlib.crc32(typ + data) & 0xFFFFFFFF))

    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
           + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
           + chunk(b"IEND", b""))
    path.write_bytes(png)
