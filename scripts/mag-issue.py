#!/usr/bin/env python3
"""잡지 판형 2(fmt: 2) 호 만들기.

    python3 scripts/mag-issue.py docs/magazine/issues/fb-02

<폴더>/articles.md  원고. 문법은 그 파일 맨 위 주석 참고
<폴더>/pages.html   지면. <head>(글꼴 link · <style>) + <template class="pg"> 여러 개
                    지면 안에서 쓸 수 있는 것:
                      {{p 기사 묶음.번호}}  {{p 기사 묶음.1-3}}  {{p 기사 묶음}}(묶음 전체)  → 원고 문단을 <p>로
                      {{more 기사 묶음.번호 [글자]}}  → 읽기 모드로 이어 읽는 버튼
                      {{title 기사}}  → 기사 제목
결과: public/mag/issues/<폴더 이름>/issue.html (지면 + <template class="art"> 기사 본문)
"""
import html
import re
import sys
from pathlib import Path


def inline(t):
    t = html.escape(t, quote=False)
    t = re.sub(r'(https?://[^\s<]+)', r'<a href="\1" target="_blank" rel="noopener">\1</a>', t)
    t = re.sub(r'\[([^\]]+)\]', r'<span class="alb">[\1]</span>', t)
    return t


def parse(md):
    md = re.sub(r'<!--.*?-->', '', md, flags=re.S)
    arts, art, sec = {}, None, None
    order = []
    buf = []

    def flush():
        nonlocal buf
        if buf and sec is not None:
            text = ' '.join(x.strip() for x in buf).strip()
            if text:
                kind = 'p'
                if text.startswith('> '):
                    kind, text = 'pull', text[2:]
                elif text.startswith('※ '):
                    kind, text = 'note', text[2:]
                sec['items'].append((kind, text))
        buf = []

    for line in md.splitlines():
        if line.startswith('@art '):
            flush()
            parts = [x.strip() for x in line[5:].split('|')]
            art = {'id': parts[0], 'title': parts[1], 'by': parts[2] if len(parts) > 2 else '', 'secs': []}
            arts[art['id']] = art
            order.append(art['id'])
            sec = None
        elif line.startswith('#') and art is not None:
            flush()
            m = re.match(r'#(\S+)\s*(.*)', line)
            sec = {'id': m.group(1), 'title': m.group(2).strip(), 'items': []}
            art['secs'].append(sec)
        elif line.startswith('- ') and sec is not None:
            flush()
            sec['items'].append(('li', line[2:].strip()))
        elif not line.strip():
            flush()
        else:
            buf.append(line)
    flush()
    return arts, order


def item_html(kind, text, pid):
    a = f' data-p="{pid}"'
    if kind == 'pull':
        return f'<blockquote class="pull"{a}>{inline(text)}</blockquote>'
    if kind == 'note':
        return f'<p class="note"{a}>{inline(text)}</p>'
    if kind == 'li':
        return f'<li{a}>{inline(text)}</li>'
    return f'<p{a}>{inline(text)}</p>'


def render_items(items, sid, start=1):
    out, in_list = [], False
    for i, (kind, text) in enumerate(items, start):
        if kind == 'li' and not in_list:
            out.append('<ul>'); in_list = True
        if kind != 'li' and in_list:
            out.append('</ul>'); in_list = False
        out.append(item_html(kind, text, f'{sid}.{i}'))
    if in_list:
        out.append('</ul>')
    return ''.join(out)


def article_html(a):
    parts = [f'<header class="rhead"><h1>{inline(a["title"])}</h1>' + (f'<p class="by">글 {html.escape(a["by"])}</p>' if a['by'] else '') + '</header>']
    for s in a['secs']:
        if s['title']:
            parts.append(f'<h2 data-p="{s["id"]}">{inline(s["title"])}</h2>')
        else:
            parts.append(f'<span data-p="{s["id"]}"></span>')
        parts.append(render_items(s['items'], s['id']))
    return ''.join(parts)


def find_sec(arts, aid, sid):
    a = arts[aid]
    for s in a['secs']:
        if s['id'] == sid:
            return s
    raise KeyError(f'{aid} {sid}')


def expand(page, arts):
    def p(m):
        aid, ref = m.group(1), m.group(2)
        sid, _, rng = ref.partition('.')
        s = find_sec(arts, aid, sid)
        if rng:
            a, _, b = rng.partition('-')
            a, b = int(a), int(b or a)
        else:
            a, b = 1, len(s['items'])
        items = s['items'][a - 1:b]
        if not items:
            raise ValueError(f'빈 범위: {m.group(0)}')
        return render_items(items, sid, a)

    def more(m):
        aid, ref, label = m.group(1), m.group(2), (m.group(3) or '').strip() or '계속 읽기'
        sid = ref.split('.')[0]
        find_sec(arts, aid, sid)
        return f'<button type="button" class="x-more" data-read="{aid}" data-at="{ref}"><i>▶</i> {html.escape(label)}</button>'

    page = re.sub(r'\{\{p (\w+) ([\w.\-]+)\}\}', p, page)
    page = re.sub(r'\{\{more (\w+) ([\w.]+)(?: ([^}]+))?\}\}', more, page)
    page = re.sub(r'\{\{title (\w+)\}\}', lambda m: inline(arts[m.group(1)]['title']), page)
    if '{{' in page:
        raise ValueError('처리 못 한 {{ }}: ' + page[page.index('{{'):page.index('{{') + 60])
    return page


def main():
    src = Path(sys.argv[1])
    arts, order = parse((src / 'articles.md').read_text(encoding='utf-8'))
    pages = (src / 'pages.html').read_text(encoding='utf-8')
    pages = re.sub(r'<!--.*?-->', '', pages, flags=re.S)
    head = pages[:pages.index('<template')]
    tpls = re.findall(r'<template class="pg">(.*?)</template>', pages, re.S)
    out = [head.strip(), '']
    for t in tpls:
        out.append('<template class="pg">' + expand(t, arts).strip() + '</template>')
    for aid in order:
        a = arts[aid]
        out.append(f'<template class="art" data-id="{aid}" data-title="{html.escape(a["title"])}"><div class="x2r">{article_html(a)}</div></template>')
    # 지면은 앱 문서(Shadow DOM) 안에 들어가므로 상대 경로 그림은 앱 주소 기준으로 풀린다 → 호 폴더 절대 경로로
    base = f'/mag/issues/{src.name}/'
    out = [re.sub(r'((?:src|href)=")([^"/:#][^":]*\.(?:webp|jpg|jpeg|png|svg))"', lambda m: m[1] + base + m[2] + '"', x) for x in out]
    dst = Path('public/mag/issues') / src.name / 'issue.html'
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text('\n'.join(out) + '\n', encoding='utf-8')
    n = {aid: len(re.sub(r'\s+', ' ', ' '.join(t for s in arts[aid]['secs'] for _, t in s['items']))) for aid in order}
    print(f'{dst}: 지면 {len(tpls)}쪽, 기사 {len(order)}편', n)


if __name__ == '__main__':
    main()
