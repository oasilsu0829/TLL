---
name: mag-issue
description: T/L/L 주간 잡지(Drop · feedback · Cypher) 한 호를 빨리 만드는 순서. 새 호 뼈대(mag-new.mjs), 커넥터 없이 사진 찾기(mag-photos.py), 빌드·검사·발행. "잡지 새 호", "다음 호", "system.md대로" 요청에 쓴다.
---

# 잡지 한 호 빨리 만들기

규칙의 원본은 `docs/magazine/system.md`(사실·점수·인용 약속, 발행 절차). 이 스킬은 그걸 빨리 도는 순서만 정한다.

## 0. 뼈대 (1분)
```bash
node scripts/mag-new.mjs <drop|fb|cy> [--date YYYY-MM-DD]
```
- 차례 검사(종료 3), 같은 날짜 호가 있는지 검사(종료 4), 다음 id 결정, `docs/magazine/issues/<id>/`에 articles.md · notes.md · pages.html(약 20쪽, 잡지 색·글꼴·사진 칸 포함) · index-entry.json 생성
- 뼈대의 `TODO:`가 남아 있으면 mag-check가 오류를 낸다 → 채우거나 지울 것
- 출력된 '먼저 읽을 것'(바이블 맨 위 '개편', 기억 파일, 연재 예고)만 읽는다. editorial-logic.md는 막힐 때만
- **뼈대는 id·차례·CSS 골격을 얻는 용도.** articles.md의 꼭지 순서·소제목과 pages.html의 쪽 배치는 컨셉(system.md 4-1)에 맞게 지우고 새로 짠다. 뼈대 그대로 채우면 매 호 같은 잡지가 된다(2026-11-14 사용자 '재미가 없어')

## 1. 편성·취재 (가장 오래 걸림)
- 웹 검색은 한 번에 여러 개를 같이 보낸다(그 주 신보 목록 4~5곳 → 후보 3팀 → 후보마다 경력·인터뷰)
- 커버 출처 8곳이 안 모이면 바로 다음 후보로. 30분 넘게 붙잡지 않는다
- 사실은 바로 notes.md 표에 id로 적고, 원고에는 노트에 있는 것만 쓴다(데스크가 빨라진다)
- 취재 중반에 **컨셉 세 개 → 하나 고르기**(system.md 4-1). 기억 파일 '쓴 컨셉'과 겹치지 않게

## 2. 사진 (Unsplash·Adobe 커넥터가 붙어 있으면 먼저 쓴다 — system.md 6장)
```bash
python3 -I scripts/mag-photos.py search "<아티스트 영어 이름> live" --src commons,openverse
python3 -I scripts/mag-photos.py get <번호> <id> photo-cover --crop 2:3 --look riso --accent "<잡지 색>"
```
- 쓸 수 있는 라이선스만 보여 주고, `get`이 크레딧·출처를 붙여 mag-photo.py로 넘긴다(webp, 400KB 넘으면 자동으로 줄임, credits.json)
- 곳: commons(인물·공연, 429가 잦음 → 스크립트가 기다렸다 다시) · openverse(504가 잦음) · loc(옛 사진·사물) · artic(질감·미술, 맞는 작품이 적으면 관계없는 결과가 섞임)
- 뼈대의 사진 칸: 표지 `photo-cover.webp`(2:3) · 커버 여는 쪽 `photo-open.webp`(3:2). 더 넣으려면 `<figure class="x-ph top">`. 한 호 8장 이하
- 캡션(`figcaption`)에 저작자 · 라이선스를 그대로 적는다(mag-check가 확인)
- 아티스트 사진이 없으면 장소·악기·사물 사진, 그것도 없으면 타이포·SVG 표지(fb-02)

## 3. 원고 → 지면
- articles.md 문법은 파일 맨 위 주석. 구성과 소제목은 컨셉대로. 정형 소제목('왜 지금'·'아쉬움에 대하여'·'지키는 것'·'다시, ○○') 금지, 재미 규칙은 system.md 4-2
- 지면은 원고를 `{{p 기사 묶음.1-2}}`로 가져오기만 하면 된다. 넘치면 `.1-2`를 `.1`로 줄인다
- 그래픽은 컨셉에 맞는 것으로 하나 이상(SVG/CSS)

## 4. 빌드·검사·발행
```bash
python3 scripts/mag-issue.py docs/magazine/issues/<id>
node scripts/mag-check.mjs <id>
```
- index-entry.json을 index.json의 같은 잡지 지난 호 뒤에 넣고(title · tracks · singles 채움) 파일은 지운다
- serials.json 회차와 기억 파일을 갱신한 뒤 system.md 8장대로 발행
- 오류 0이어야 발행. 스크린숏 `/tmp/mag-check/<id>/`에서 표지·커버 첫 쪽·그래픽·마지막 쪽을 직접 본다

## 알려진 함정
- User-Agent·요청에 사용자 주소·이메일을 넣지 않는다(자동 모드가 막음)
- index.json에 시험 항목을 넣은 채로 mag-new.mjs를 다시 돌리면 '이미 있음'으로 멈춘다
- 클래스는 `x-` 접두어로 `.x2`·`.x2r` 아래에만(Shadow DOM에 다른 호 CSS가 함께 들어온다)
