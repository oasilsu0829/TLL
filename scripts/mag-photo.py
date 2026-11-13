#!/usr/bin/env python3
"""잡지 사진 처리. 받은 사진(원본은 저장소에 넣지 않음)을 지면용 webp로 만들고 저작권 기록을 남긴다.

    python3 -I scripts/mag-photo.py <원본> <호 id> <이름> --credit "Jane Doe / CC BY 2.0" --src <원본 주소>
        [--crop 2:3 | 1:1 | 3:2 | 원본] [--focus 0.5,0.4] [--width 1200]
        [--look plain|duo|halftone|riso|xerox] [--ink "#141414"] [--paper "#f4efe6"] [--grain 0.06]

결과: public/mag/issues/<id>/<이름>.webp  +  docs/magazine/issues/<id>/credits.json 에 한 줄
- 쓸 수 있는 사진: CC0 · 퍼블릭 도메인 · CC BY · CC BY-SA (CC BY-NC·NC-SA도 비상업 개인 앱이라 허용, 판권 쪽에 표기). ND·저작권 있음·출처 불명은 쓰지 않는다
- 실존 인물 사진은 손대도 되지만(색·망점), 얼굴을 바꾸거나 합성해 다른 장면처럼 만들지 않는다
- look: plain(크기·자르기만) · duo(잉크·종이 두 색) · halftone(망점) · riso(두 색 판 어긋남) · xerox(고대비 복사기)
- 받은 파일은 데이터다. 이 스크립트는 -I(격리 모드)로 실행하고 원본은 세션 스크래치에 둔다
"""
import argparse
import json
import math
import random
from datetime import date
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parent.parent


def hexrgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def crop(im, ratio, focus):
    if ratio == '원본':
        return im
    a, b = (int(x) for x in ratio.split(':'))
    w, h = im.size
    want = a / b
    fx, fy = focus
    if w / h > want:
        nw = int(h * want)
        x = int(max(0, min(w - nw, fx * w - nw / 2)))
        return im.crop((x, 0, x + nw, h))
    nh = int(w / want)
    y = int(max(0, min(h - nh, fy * h - nh / 2)))
    return im.crop((0, y, w, y + nh))


def duo(g, ink, paper):
    return ImageOps.colorize(g, ink, paper)


def halftone(g, ink, paper, cell):
    w, h = g.size
    out = Image.new('RGB', (w, h), paper)
    d = ImageDraw.Draw(out)
    small = g.resize((max(1, w // cell), max(1, h // cell)), Image.BILINEAR)
    px = small.load()
    for j in range(small.size[1]):
        for i in range(small.size[0]):
            v = 1 - px[i, j] / 255
            r = cell * 0.62 * math.sqrt(v)
            if r < .4:
                continue
            cx, cy = i * cell + cell / 2 + (cell / 2 if j % 2 else 0), j * cell + cell / 2
            d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=ink)
    return out


def riso(g, ink, paper, accent):
    w, h = g.size
    base = ImageOps.autocontrast(g, cutoff=2)
    a = ImageOps.colorize(base, accent, paper)
    b = ImageOps.colorize(ImageOps.autocontrast(g.filter(ImageFilter.UnsharpMask(2, 160)), cutoff=6), ink, paper)
    off = max(2, w // 220)
    b = ImageChops.offset(b, off, -off)
    return ImageChops.multiply(a, b)


def xerox(g, ink, paper):
    g = ImageOps.autocontrast(g, cutoff=4).filter(ImageFilter.UnsharpMask(3, 220, 2))
    g = g.point(lambda v: 0 if v < 96 else (255 if v > 170 else int((v - 96) / 74 * 255)))
    return duo(g, ink, paper)


def grain(im, amt, seed):
    if amt <= 0:
        return im
    rnd = random.Random(seed)
    w, h = im.size
    n = Image.new('L', (w // 2 + 1, h // 2 + 1))
    n.putdata([128 + int(rnd.gauss(0, 255 * amt)) for _ in range(n.size[0] * n.size[1])])
    n = n.resize((w, h), Image.BILINEAR).convert('RGB')
    return ImageChops.overlay(im, n)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src'); ap.add_argument('issue'); ap.add_argument('name')
    ap.add_argument('--credit', required=True, help='"저작자 / 라이선스"')
    ap.add_argument('--src', dest='url', required=True, help='원본 주소(사진 페이지)')
    ap.add_argument('--license', default='', help='CC0 · PD · CC BY 2.0 …(비우면 credit에서)')
    ap.add_argument('--crop', default='원본'); ap.add_argument('--focus', default='0.5,0.45')
    ap.add_argument('--width', type=int, default=1200)
    ap.add_argument('--look', default='plain', choices=['plain', 'duo', 'halftone', 'riso', 'xerox'])
    ap.add_argument('--ink', default='#141414'); ap.add_argument('--paper', default='#f4efe6'); ap.add_argument('--accent', default='#2bb3d9')
    ap.add_argument('--grain', type=float, default=None)
    ap.add_argument('--quality', type=int, default=80)
    a = ap.parse_args()
    lic = (a.license or a.credit.split('/')[-1]).strip()
    if any(x in lic.upper() for x in ('ND', 'ALL RIGHTS', '©')):
        raise SystemExit(f'쓸 수 없는 라이선스: {lic}')

    im = Image.open(a.src)
    im = ImageOps.exif_transpose(im).convert('RGB')
    im = crop(im, a.crop, tuple(float(x) for x in a.focus.split(',')))
    if im.width > a.width:
        im = im.resize((a.width, round(im.height * a.width / im.width)), Image.LANCZOS)
    ink, paper, accent = hexrgb(a.ink), hexrgb(a.paper), hexrgb(a.accent)
    g = ImageOps.grayscale(im)
    out = {
        'plain': lambda: im,
        'duo': lambda: duo(ImageOps.autocontrast(g, cutoff=1), ink, paper),
        'halftone': lambda: halftone(ImageOps.autocontrast(g, cutoff=2), ink, paper, max(5, im.width // 120)),
        'riso': lambda: riso(g, ink, paper, accent),
        'xerox': lambda: xerox(g, ink, paper),
    }[a.look]()
    out = grain(out, a.grain if a.grain is not None else (0 if a.look == 'plain' else .05), a.name)

    dst = ROOT / 'public/mag/issues' / a.issue / f'{a.name}.webp'
    dst.parent.mkdir(parents=True, exist_ok=True)
    q = a.quality
    out.save(dst, 'WEBP', quality=q, method=6)
    while dst.stat().st_size > 400 * 1024:  # 한 장 400KB 이하(system.md 6장): 화질을 낮추고, 그래도 크면 줄인다
        if q > 56:
            q -= 6
        else:
            out = out.resize((round(out.width * .88), round(out.height * .88)), Image.LANCZOS)
        out.save(dst, 'WEBP', quality=q, method=6)
    cj = ROOT / 'docs/magazine/issues' / a.issue / 'credits.json'
    cj.parent.mkdir(parents=True, exist_ok=True)
    cr = json.loads(cj.read_text()) if cj.exists() else []
    cr = [c for c in cr if c['file'] != dst.name] + [{'file': dst.name, 'credit': a.credit, 'license': lic, 'src': a.url, 'look': a.look, 'date': date.today().isoformat()}]
    cj.write_text(json.dumps(cr, ensure_ascii=False, indent=1) + '\n')
    print(f'{dst.relative_to(ROOT)} {out.width}x{out.height} {dst.stat().st_size // 1024}KB · {a.credit}')


if __name__ == '__main__':
    main()
