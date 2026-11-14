#!/usr/bin/env python3
"""잡지 사진 찾기·받기 (커넥터 없이). 받은 뒤 처리는 scripts/mag-photo.py 가 한다.

    python3 -I scripts/mag-photos.py search "Brainstory band" [--src commons,openverse,loc,artic] [--n 8]
    python3 -I scripts/mag-photos.py get <번호> <호 id> <이름> [--crop 2:3 --look duo ...]   ← mag-photo.py 옵션 그대로

search  여러 곳에서 쓸 수 있는 라이선스만 골라 번호를 붙여 보여 주고, 결과를 캐시에 저장
get     캐시의 그 번호 원본을 받아(캐시 폴더, 저장소 밖) mag-photo.py 로 넘긴다(--credit · --src 자동)
        → public/mag/issues/<id>/<이름>.webp + docs/magazine/issues/<id>/credits.json

곳(--src, 쉼표로 여러 개, 앞쪽부터 찾음)
  commons    Wikimedia Commons API. 인물·공연 사진이 가장 많음. 공유 IP라 429가 잦다 → 기다렸다 다시(최대 4번)
  openverse  Openverse API(Flickr CC 등). 504가 잦다
  loc        미국 의회도서관 사진(No known restrictions만 받음). 옛 사진·사물
  artic      시카고 미술관 퍼블릭 도메인(CC0). 질감·콜라주 재료
라이선스: CC0 · PD · CC BY · CC BY-SA · CC BY-NC(-SA)만. ND·저작권·불명은 버림(system.md 6장)
캐시: $MAG_PHOTO_CACHE 또는 ~/.cache/mag-photos (저장소 밖에 둔다)
"""
import html
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = Path(os.environ.get('MAG_PHOTO_CACHE') or Path.home() / '.cache/mag-photos')
UA = 'TLL-magazine-photo-tool/1.0 (python-urllib; low volume)'
OK_LIC = re.compile(r'^(cc0|pd|public domain|pdm|no known restrictions|cc[ -]by(?:[ -]sa|[ -]nc(?:[ -]sa)?)?(?:[ -][\d.]+)?)', re.I)


def ok_license(lic):
    l = (lic or '').strip()
    return bool(l) and 'nd' not in re.split(r'[ \-]', l.lower()) and bool(OK_LIC.match(l))


def commons_thumb(u, w=1280):
    """Commons 원본 주소 → 썸네일 주소(원본 직접 받기는 429로 막힘)."""
    m = re.match(r'^https://upload\.wikimedia\.org/wikipedia/commons/(\w)/(\w\w)/([^/]+)$', u or '')
    return f'https://thumb.wikimedia.org/wikipedia/commons/thumb/{m[1]}/{m[2]}/{m[3]}/{w}px-{m[3]}' if m else u


def get(url, tries=4, binary=False):
    wait = 3
    for i in range(tries):
        req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': '*/*'})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                data = r.read()
                return data if binary else json.loads(data)
        except urllib.error.HTTPError as e:
            if e.code in (429, 502, 503, 504) and i < tries - 1:
                ra = e.headers.get('Retry-After')
                w = int(ra) if ra and ra.isdigit() else wait
                print(f'  {e.code} {urllib.parse.urlsplit(url).netloc} → {w}초 뒤 다시', file=sys.stderr)
                time.sleep(min(w, 60)); wait *= 2
                continue
            raise
        except (urllib.error.URLError, TimeoutError) as e:
            if i < tries - 1:
                time.sleep(wait); wait *= 2
                continue
            raise
    return None


def strip(s):
    return html.unescape(re.sub(r'<[^>]+>', '', s or '')).strip()


def commons(q, n):
    u = 'https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode({
        'action': 'query', 'format': 'json', 'generator': 'search', 'gsrsearch': f'filetype:bitmap {q}', 'gsrnamespace': 6,
        'gsrlimit': n * 2, 'prop': 'imageinfo', 'iiprop': 'url|extmetadata|size', 'iiurlwidth': 1280})
    d = get(u) or {}
    out = []
    for p in sorted((d.get('query') or {}).get('pages', {}).values(), key=lambda p: p.get('index', 0)):
        ii = (p.get('imageinfo') or [{}])[0]
        m = ii.get('extmetadata') or {}
        lic = strip((m.get('LicenseShortName') or {}).get('value'))
        out.append({'src': 'commons', 'title': p['title'].removeprefix('File:'), 'author': strip((m.get('Artist') or {}).get('value')) or '알 수 없음',
                    'license': lic, 'page': ii.get('descriptionurl'), 'img': ii.get('thumburl') or ii.get('url'), 'w': ii.get('width'), 'h': ii.get('height')})
    return out


def openverse(q, n):
    u = 'https://api.openverse.org/v1/images/?' + urllib.parse.urlencode({'q': q, 'license': 'cc0,pdm,by,by-sa,by-nc,by-nc-sa', 'page_size': n})
    d = get(u) or {}
    return [{'src': 'openverse', 'title': r.get('title') or '', 'author': r.get('creator') or '알 수 없음',
             'license': ('CC ' + r['license'].upper() + (' ' + r['license_version'] if r.get('license_version') else '')) if r.get('license') not in ('cc0', 'pdm') else r['license'].upper().replace('PDM', 'PD'),
             'page': r.get('foreign_landing_url'), 'img': commons_thumb(r.get('url')), 'w': r.get('width'), 'h': r.get('height')} for r in d.get('results', [])]


def loc(q, n):
    u = 'https://www.loc.gov/photos/?' + urllib.parse.urlencode({'q': q, 'fo': 'json', 'c': n, 'at': 'results'})
    d = get(u) or {}
    out = []
    for r in d.get('results', []):
        imgs = [x for x in r.get('image_url', []) if x]
        if not imgs:
            continue
        big = re.sub(r'_\d+px\.jpg', 'v.jpg', imgs[-1].split('#')[0])
        out.append({'src': 'loc', 'title': r.get('title') or '', 'author': ', '.join(r.get('contributor', [])[:2]) or 'Library of Congress',
                    'license': '확인 필요(받을 때 검사)', 'page': r.get('url') or r.get('id'), 'img': big, 'w': None, 'h': None})
    return out


def artic(q, n):
    u = 'https://api.artic.edu/api/v1/artworks/search?' + urllib.parse.urlencode({
        'q': q, 'limit': n * 3, 'fields': 'id,title,artist_display,image_id,is_public_domain'})
    d = get(u) or {}
    return [{'src': 'artic', 'title': r.get('title') or '', 'author': (r.get('artist_display') or 'Art Institute of Chicago').split('\n')[0],
             'license': 'CC0', 'page': f"https://www.artic.edu/artworks/{r['id']}", 'img': f"https://www.artic.edu/iiif/2/{r['image_id']}/full/1686,/0/default.jpg", 'w': None, 'h': None}
            for r in d.get('data', []) if r.get('image_id') and r.get('is_public_domain')]


SRC = {'commons': commons, 'openverse': openverse, 'loc': loc, 'artic': artic}


def search(argv):
    q = argv[0]
    srcs = 'commons,openverse'
    n = 8
    if '--src' in argv: srcs = argv[argv.index('--src') + 1]
    if '--n' in argv: n = int(argv[argv.index('--n') + 1])
    res = []
    for s in srcs.split(','):
        try:
            got = SRC[s.strip()](q, n)
        except Exception as e:  # 한 곳이 막혀도 다른 곳은 계속
            print(f'  {s}: 실패 ({e})', file=sys.stderr)
            continue
        good = [r for r in got if r['src'] == 'loc' or ok_license(r['license'])]
        print(f'  {s}: {len(got)}장 중 쓸 수 있는 라이선스 {len(good)}장', file=sys.stderr)
        res += good[:n]
    CACHE.mkdir(parents=True, exist_ok=True)
    (CACHE / 'last.json').write_text(json.dumps({'q': q, 'results': res}, ensure_ascii=False, indent=1))
    for i, r in enumerate(res, 1):
        size = f" {r['w']}x{r['h']}" if r.get('w') else ''
        print(f"{i:>2}. [{r['src']}] {r['title'][:70]}{size}\n    {r['author'][:60]} / {r['license']}\n    {r['page']}")
    if not res:
        print('찾지 못함. 다른 말(영어·장소·악기·사물)이나 다른 --src 로', file=sys.stderr)


def fetch(argv):
    if len(argv) < 3:
        sys.exit('사용법: mag-photos.py get <번호> <호 id> <이름> [mag-photo.py 옵션]')
    k, issue, name, rest = int(argv[0]), argv[1], argv[2], argv[3:]
    res = json.loads((CACHE / 'last.json').read_text())['results']
    r = res[k - 1]
    lic = r['license']
    if r['src'] == 'loc':
        item = get(r['page'].rstrip('/') + '/?fo=json') or {}
        ra = ' '.join((item.get('item') or {}).get('rights_advisory') or [])
        if 'no known restrictions' not in ra.lower():
            sys.exit(f'의회도서관 권리 표시가 "No known restrictions"가 아님: {ra or "없음"} → 쓰지 않음')
        lic = 'No known restrictions (LOC)'
    if not ok_license(lic):
        sys.exit(f'쓸 수 없는 라이선스: {lic}')
    data = get(r['img'], binary=True)
    ext = '.png' if r['img'].lower().endswith('.png') else '.jpg'
    raw = CACHE / 'raw' / f'{issue}-{name}{ext}'
    raw.parent.mkdir(parents=True, exist_ok=True)
    raw.write_bytes(data)
    print(f'받음 {raw} ({len(data) // 1024}KB)')
    credit = f"{r['author']} / {lic}"
    cmd = [sys.executable, '-I', str(ROOT / 'scripts/mag-photo.py'), str(raw), issue, name, '--credit', credit, '--src', r['page'], '--license', lic] + rest
    subprocess.run(cmd, check=True)
    print(f'지면 캡션: {credit}')


if __name__ == '__main__':
    if len(sys.argv) < 3 or sys.argv[1] not in ('search', 'get'):
        print(__doc__); sys.exit(2)
    (search if sys.argv[1] == 'search' else fetch)(sys.argv[2:])
