"""Build pixel-art SVG mark for Clara from a hand-tuned grid."""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]

# 22 x 26 — closer to the source; display at 2× (44×52) for crisp pixels.
ROWS = [
    ".........####.........",  # 0 solid bun
    "........######........",  # 1
    ".......########.......",  # 2
    ".......########.......",  # 3
    "........######........",  # 4
    "......##########......",  # 5 hair crown
    ".....############.....",  # 6
    "....##############....",  # 7
    "...#######..#######...",  # 8 V peak
    "...######....######...",  # 9
    "..######......######..",  # 10
    "..#####........#####..",  # 11
    ".#####..........#####.",  # 12
    ".####............####.",  # 13
    "####..............####",  # 14
    "###..######..######.##",  # 15 glasses top — check len
]


def main() -> None:
    rows = [
        ".........####.........",
        "........######........",
        ".......########.......",
        ".......########.......",
        "........######........",
        "......##########......",
        ".....############.....",
        "....##############....",
        "...#######..#######...",
        "...######....######...",
        "..######......######..",
        "..#####........#####..",
        ".#####..........#####.",
        ".####............####.",
        "####..............####",
        "###.######..######.###",
        "##.#......##......#.##",
        "##.#..##..##..##..#.##",
        "##.#.#..#.##.#..#.#.##",
        "##.#......##......#.##",
        ".#..######..######..#.",
        ".#..................#.",
        "..#.......##.......#..",
        "...#..............#...",
        "....##..........##....",
        "......##########......",
    ]
    width = len(rows[0])
    bad = [(i, len(r)) for i, r in enumerate(rows) if len(r) != width]
    assert not bad, bad
    for i, r in enumerate(rows):
        print(f"{i:02d}|{r}|")

    d = to_path(rows)
    w, h = width, len(rows)
    write_svg(d, w, h, ROOT / "public" / "clara-mark.svg")
    write_tsx(d, w, h, ROOT / "src" / "components" / "clara-mark.tsx")
    write_icon(d, w, h, ROOT / "src" / "app" / "icon.svg")
    write_preview(rows, ROOT / "public" / "clara-mark-preview.png")


def to_path(rows: list[str]) -> str:
    parts: list[str] = []
    width = len(rows[0])
    for y, row in enumerate(rows):
        x = 0
        while x < width:
            if row[x] != "#":
                x += 1
                continue
            start = x
            while x < width and row[x] == "#":
                x += 1
            run = x - start
            parts.append(f"M{start} {y}h{run}v1h{-run}z")
    return "".join(parts)


def write_svg(d: str, w: int, h: int, path: Path) -> None:
    path.write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" '
        f'shape-rendering="crispEdges" fill="currentColor" aria-hidden="true">\n'
        f'  <path d="{d}"/>\n'
        f"</svg>\n",
        encoding="utf-8",
    )
    print("wrote", path)


def write_tsx(d: str, w: int, h: int, path: Path) -> None:
    path.write_text(
        f"""export function ClaraMark({{ className }}: {{ className?: string }}) {{
  return (
    <svg
      className={{className}}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 {w} {h}"
      shapeRendering="crispEdges"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="{d}" />
    </svg>
  );
}}
""",
        encoding="utf-8",
    )
    print("wrote", path)


def write_icon(d: str, w: int, h: int, path: Path) -> None:
    pad = 14
    available = 128 - pad * 2
    scale = min(available // w, available // h)
    ox = (128 - w * scale) // 2
    oy = (128 - h * scale) // 2
    path.write_text(
        f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" shape-rendering="crispEdges">
  <rect width="128" height="128" rx="26" fill="#fff"/>
  <g transform="translate({ox} {oy}) scale({scale})" fill="#171717">
    <path d="{d}"/>
  </g>
</svg>
""",
        encoding="utf-8",
    )
    print("wrote", path)


def write_preview(rows: list[str], path: Path, scale: int = 12) -> None:
    w, h = len(rows[0]), len(rows)
    img = Image.new("L", (w, h), 255)
    px = img.load()
    assert px is not None
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == "#":
                px[x, y] = 0
    img.resize((w * scale, h * scale), Image.Resampling.NEAREST).save(path)
    print("wrote", path)


if __name__ == "__main__":
    main()
