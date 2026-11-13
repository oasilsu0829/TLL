# T/L/L — 작업 인계 메모

Spotify 턴테이블 앱. 2026-11-13 Sabathia(`oasilsu0829/sabathia`)의 음악 앱(/music/, MUS-09)을 떼어 냈다. 같은 날 사용자 결정: Sabathia와 연결 없는 독자 프로그램(DB 따로, 런처·홈 아이콘 연결 없음).

## 주소·배포
- https://tll.oasilsu0829.workers.dev (Cloudflare Worker 이름 `tll`). 내 턴테이블 `/`, 친구용 `/deck/`
- 배포는 GitHub 연동(Workers Builds). 사용자는 PC가 없으니 로컬 `wrangler` 명령을 전제로 하지 말 것. Build command `npm run build`(echo만), Deploy command `npx wrangler deploy`
- D1은 전용 `tll-db`(binding DB, id 4e9e7263-e232-456f-af4a-e8efbb22ec8d). 첫 배포 때 자동으로 만들어졌다
  - 2026-11-13 Sabathia `jarvis-db`에서 음악 데이터(music · music.cid · music.owner · music.u.*)를 한 번 복사했고(settings `tll.copied`), 사용자가 크레이트 확인 후 연결(OLD binding·copyOld)을 지웠다. 이제 Sabathia와 공유하는 것 없음
- 인증: Sabathia의 API_TOKEN은 쓰지 않는다. 서버는 X-Spotify(액세스 토큰)로 /me를 확인한다. Client ID 바꾸기(PUT /api/music/cid)는 주인 계정만
- Spotify 대시보드 Redirect URIs: `https://tll.oasilsu0829.workers.dev/` 와 `https://tll.oasilsu0829.workers.dev/deck/`
- 옮기기: Sabathia `/music/`이 처음 한 번 그 기기의 `music.*`·`mag.*`(로그인 토큰 제외)를 `#from=<base64url JSON>`에 담아 보낸다 → `public/shell.js`가 여기 없는 키만 채우고 주소에서 지운다. Sabathia `/deck/…`·`/music/<파일>`은 이쪽으로 301
- 로고 T/L/L(2026-11-13): 앱 아이콘은 `scripts/tll-icon.html`의 4안(A 명판 · B 판 라벨 · C 계단 · D 각인) 중 D(각인, 2026-11-13 사용자 선택). 바꾸기 `node scripts/tll-icon.cjs <안>`. 화면 글자·3D 각인·명판·라벨·붐박스 상표·Spotify 기기 이름(DEV)도 T/L/L
- 포인트 색(2026-11-13): 처음엔 바하마 블루 #026395로 통일했다가 같은 날 사용자 요청으로 '앨범 표지 색 따라가기'로 되돌림. 앨범이 바뀌면 applyAmb()가 배경(.amb)과 함께 accentOf(표지 대표색 중 채도 가장 높은 색)로 `--main`(L 34%, 흰 바탕 글자) · `--main-glow`(L 60%, 불빛)를 바꾸고 Deck3D.setAccent로 3D 카트리지·노브 표시·램프·후광도 바꾼다. 흑백 표지·색 못 뽑음·앨범 없음이면 바하마 블루. `--red`는 지우기·경고에만. 그대로 둔 빨강: 잼 REC, RCA 케이블, 클립보드 여백 줄, 잡지 자체 색
- 테스트: `npm test` (test/music.mjs 합치기, test/music-api.mjs API — node:sqlite)

## 구조
```
public/index.html   앱 화면(예전 public/music/index.html). /deck/도 Worker가 이 파일을 내준다(window.FRIEND)
public/shell.js     예전 기록 가져오기(#from=, 한 번), /sw.js 등록
public/sw.js        캐시 먼저 + 뒤에서 갱신. 여러 파일을 고치면 VERSION을 올릴 것
public/merge.js     크레이트 합치기(화면·서버 공용). 예전 /music/mag/sleeves/ 그림 경로는 /mag/sleeves/로 바꾼다
public/3d · jam · mag · deck   턴테이블 3D · 잼 · 잡지 · 친구용 매니페스트·아이콘
src/index.js        라우터(/deck/, 예전 /music/… → 새 경로 301, /api/music/*)
src/music.js        음악 API · src/util.js 테이블 준비(settings, jam_q)
```

## 기능 메모 (Sabathia에서 옮겨 온 그대로, 경로만 새 구조로 고침. '/music/'은 이제 '/')
public/       음악 (MUS-09, 2026-11-11). Spotify 플레이어. Stitch 시안 "White Deck - iPad Edition"(턴테이블 + 플레이리스트 상자)을 옮김(상표·모델명은 뺌). theme.css를 쓰지 않는 자체 화면
                    - 로그인: PKCE(서버 없음). 사용자가 developer.spotify.com에 앱을 만들고 Client ID를 설정 창에 넣는다(localStorage music.cid, 토큰 music.tok). Redirect URI = <주소>/music/
                      간편 로그인(2026-11-13): 로그인에 성공하면 Client ID(공개값)를 서버에 올림(PUT /api/music/cid, D1 settings k='music.cid'). 다른 기기는 열 때 받아 오고, 재생·OFFLINE을 누르면 설정 창 없이 바로 Spotify 동의 화면(connect()). 설정 창은 Client ID를 알면 안내·입력칸을 숨기고 'Client ID 바꾸기'로 펼침. 토큰은 기기마다(갱신 토큰이 매번 바뀌어 공유 불가)
                    - 조작은 Web API(/me/player…), 플레이리스트는 /me/playlists. Web Playback SDK로 이 브라우저를 'Sabathia' 기기로 올림(PC 크롬만. 폰·아이패드 브라우저는 Spotify가 막아서 기기 목록에서 폰 Spotify 앱을 조작)
                    - Premium 계정 필요(사용자 Premium 확인). 개발 모드 앱이라 사용자 본인 계정만 씀
                    - 크레이트(2026-11-11 사용자 요청): 오른쪽은 낡은 나무 상자(CSS 나뭇결) 안에 앨범을 세워 꽂고 앞으로 넘겨 고른다(밀기·휠·화살표). 플레이리스트는 뺐고 앨범 단위로 듣는다(재생 때 셔플 끔)
                    - '앨범 찾기' = /v1/search type=album(limit 10, 개발 모드 한도) → 담기. 크레이트 여러 개(만들기·이름·지우기 = 칩을 한 번 더 누름). 저장 music.crates, 동기화 /api/music/sync(src/music.js, D1 settings k='music', 합치기 public/merge.js · test/music.mjs, 크레이트 단위로 늦게 고친 쪽)
                    - 앨범이 바뀌면(다른 기기에서 바꿔도) dropLP(): 3초 동안 슬리브가 들어와 판을 꺼내 플래터에 올리고 톤암이 내려옴. 아래는 지금 앨범의 트랙 목록(누르면 그 곡부터)
                    - 플레이리스트도 크레이트에 꽂음(항목 k: 'pl'). 플레이리스트는 LP가 아니라 곡 목록이 적힌 클립보드 모양(fillClip, 사용자 결정). 찾기 창 탭: 앨범 · 플레이리스트 · 내 플레이리스트. 지금 판 = context가 플레이리스트면 그 플레이리스트(ctxKey), 아니면 곡의 앨범. 플레이리스트 트랙은 /playlists/{id}/items(없으면 /tracks)
                    - 3D 턴테이블(2026-11-11): public/3d/deck3d.js(three r170, 같은 폴더에 필요한 파일만 둠, importmap으로 'three'). (2026-11-12부터 안 씀) 모델 deck.glb 1.4MB = 사용자가 AI로 만든 모델(Drive 947cec14…zip 안 base_basic_pbr.glb, 23MB)을 Claude가 손봄: 로고 3곳 지움(굴곡 평평 + 텍스처 칠), 뒤쪽 뭉개진 면 삭제, AI 플래터는 울퉁불퉁해서 버리고(빈 노드 platter = 회전축) 둘레 비탈을 평평하게, 톤암 떼어 armYaw > armLift(관절 원점 = 축), 톤암 흔적 지움, 면 22%로, 텍스처 1024 webp, meshopt. 손보는 스크립트 scripts/deck-model.mjs
                      좌표 +Y 위 +Z 앞, 플래터 중심 (-0.18, 0, -0.035), 톤암 축 (0.645, 0, -0.4), 재생 각 -0.355 ~ -0.65(곡 진행). 플래터(반지름 0.645, 옆면 스트로브 점 4줄)·매트·축·판(반지름 0.6)은 deck3d.js가 코드로 만듦. 얇은 판이라 밑에 RoundedBox 받침을 댐
                      window.Deck3D { ok, setPlaying(on, 진행 0~1), setLabel, drop(a, slam), shake }. 뜨면 body.d3로 CSS 턴테이블을 숨김. WebGL이 안 되면 CSS 턴테이블 그대로. 판 갈기 모션도 3D(앨범 3초 슬리브, 플레이리스트 1.9초 클립보드), 소리 시각은 그대로
                    - 3D 완성(2026-11-12): AI 모델(deck.glb)을 버리고 본체까지 전부 코드(deck3d.js). 작동 조작부: START/STOP·큐 레버 = 재생/정지(Deck3D.onButton), 33/45(판 회전만), 볼륨 슬라이더(onVolume ↔ setVolume), 안티스케이팅 다이얼(장식). 먼지 덮개(멈춘 채 25초면 닫힘, 만지면 열림), 바늘 조명(조명 모드), 톤암 클립, 무게추 눈금, 45 어댑터, 고무 발, RCA 케이블. 판 테두리·매트 동심원·크롬 축. 연출: (무지개 반사광은 끔), 먼지, 판 휨, (스트로브 착시는 끔: 재생 중 플래터가 멈춰 보여서), 카메라 숨쉬기(D._camLock으로 끔), 곡 바뀌면 무음 홈 빛남(flashGap)+타자기(#tw). 소리: click·cue·cover·motor·key (surface 판 잡음은 2026-11-12 사용자 요청으로 끔, 함수만 남음)
                    - 앞줄 조작부(2026-11-12): 모두 z 0.645 한 줄, 둥근 버튼 지름 0.042 + 크롬 테 0.028로 통일. 왼쪽 = 전원 노브(장식)·START/STOP·33·45·QUARTZ 등, 오른쪽 = 앰버 시간창(Deck3D.setTime)·RANGE 8/16(장식)·R(볼륨 50). 앨범 바꿀 때: 제목·트랙 목록을 먼저 바꾸고(pending), 크레이트 앞 판의 표지·트랙 목록을 미리 받아(tkCache) 꺼낼 때부터 무음 홈, 판이 내려앉으면 첫 곡 타자
                    - 3D 다듬기(2026-11-12 사용자 선택 2·3·4번): 윗판 단차+깎은 테, 플래터 윗면 선반 결, 버튼 크롬 테·전원 LED, 명판(SD-01), 톤암 받침 복잡하게(2단 받침·나사 6·높이 링·고정 레버·들림 받침대·짐벌 요크·베어링 캡). 반사 환경 = 직접 만든 스튜디오 소프트박스 3개, 역광, LED 후광(스프라이트). 카메라 48도·fov 30, 먼 쪽 흐림(.dof backdrop-filter)·비네팅(.stage::after)
                    - 3D 추가(2026-11-11): 판에 곡 사이 무음 홈(곡 길이 비율), 바늘은 앨범 전체 진행(albumProgress, deck3d yawFor), 판 잡기 스크래치(Deck3D.onScratch: 잡으면 일시정지(이 브라우저면 SDK, 아니면 API), 놓으면 잡은 시점+돌린 만큼 seek 후 다시 재생, 한 바퀴 1.8초), 조명 버튼(기본 켬, 끄면 music.lamp=false · body.night · Deck3D.setNight), 슬리브 낡음(항목 p = 들은 횟수, 판 갈 때 +1, 20번이면 최대)
                    - 디자인 A+E(2026-11-11 사용자 선택): 3D 본체·받침 헤어라인 알루미늄, 앞면 각인(SABATHIA · DIRECT DRIVE TURNTABLE · 33⅓ · 45 RPM), 실제 그림자(shadowMap + ShadowMaterial 바닥), 턴테이블 칸 바닥 리넨. 앨범 표지 대표색 3개(paletteOf, --a1~a3)로 화면 배경(.amb) 전체를 물들이고 앨범이 바뀌면 1.6초에 넘어감, 위·아래 바·칸은 반투명 유리, 밤 조명이 앨범 색을 머금음(Deck3D.setTint)
                    - 밀봉 신보(2026-11-11): 설정에 위클리·데이리스트 링크(music.special). 회차 키(위클리 = 그 주 월요일, 데이리스트 = 날짜+아침/오후/저녁/밤)가 music.opened와 다르면 크레이트 위에 비닐째 뜸 → 가로로 70% 넘게 그으면 찢어짐 → 슬리브 누르면 판 모션(sealed: 플레이리스트여도 슬리브). 표지를 못 읽으면 sealArt()로 그림
                    - 평가 후 손봄(2026-11-11): 3D는 조용할 때(멈춤·움직임 없음·2초 넘게 안 만짐) 초당 10번, 덮개가 닫히면 2번만 그림(deck3d calm, poke). 라벨·색·시간창은 값이 바뀔 때만 깨움
                      트랙은 다음 페이지를 따라 500곡까지 받음(allItems). 곡이 많으면 무음 홈 띠를 가늘게. 토큰 갱신은 navigator.locks로 탭끼리 하나만(브라우저 탭+PWA 동시 갱신 때 로그아웃되던 문제)
                    - 지금 재생 탭(2026-11-12 사용자 요청): 오른쪽 칸 위 탭 '지금 재생 · 크레이트'(기본 지금 재생, music.tab에 기억). renderNow()/tickNow()
                      큰 앨범 슬리브(640px 표지)가 떠서 포인터를 따라 기울고 빛이 흐름, 재생 중이면 판이 옆으로 빠져나와 돎, 칸 전체에 표지 번짐(.np-glow), 곡 바뀌면 슬리브가 들어오는 모션. 제목·아티스트·앨범·연도·TRACK n/m·진행 막대. 슬리브 누르면 재생/정지. 트랙 목록은 두 탭 공통
                      재생 모션 5개(2026-11-12 사용자 요청): 새 판이 들어오거나(표지 바뀜) 멈췄다 재생을 시작하면 npMotion()이 1~5 중 바로 전과 다른 하나를 골라 #np에 data-m + .go
                      1 떠오름 · 2 카드 뒤집기(판이 굴러 나옴) · 3 위에서 떨어져 쿵(바닥 그림자 퍼짐, 판 굴러 나옴) · 4 튀어 오름(판이 위로 솟았다 옆으로) · 5 화면 앞에서 쾅(번쩍·흔들림). 판은 슬리브 30px 뒤(translateZ -30px), 처음엔 숨김
                    - 판 갈기 모션 5개(2026-11-12 사용자 요청, 앨범만): D.drop이 0~4 중 바로 전과 다른 하나를 고름(drop.v, D._dropV로 고정). 0 옆으로 꺼내기(기존) · 1 세로로 뽑기(뒤로 기댄 슬리브에서 위로 뽑아 눕힘) · 2 프리스비(왼쪽 앞 슬리브 → 판이 플래터 둘레를 돌며 빙글빙글) · 3 공중 한 바퀴(앞쪽 슬리브 → 뒤로 빠져 한 바퀴 뒤집힘) · 4 쏟기(오른쪽 위 슬리브가 기울고 흔들리며 판이 미끄러져 나옴)
                      모두 3초, 0.76까지 플래터 위 0.12, 0.84(2.52초)에 내려앉음 → 효과음·타자 시각 공통. 1~4는 albumPath()(쿼터니언), 0은 stepDrop 안 기존 코드. 플레이리스트(클립보드 쾅)는 그대로
                    - 모션 뒤에 음악(2026-11-12 사용자 요청): 앨범을 바꾸면 지금 곡을 멈추고(ctl pause) dropLP가 돌려주는 약속이 풀릴 때 play를 보낸다. 손놀림(3D, Deck3D.cue/brush):
                      판 내려앉음 2.52초 → 2.9초 스타트(cue 'spin', 플래터만 돎) → 브러시로 먼지 털기 1.5초(앨범만) → 4.8초 톤암을 들어 가장자리 위(cue 'lead') → 트랙 목록이 올 때까지 최대 3초 띄워 둠 → 큐 레버 내림(cue 'down', 천천히) = play 요청 + 첫 곡 타자. 플레이리스트는 1.6초 스타트, 브러시 없음
                      그동안 제목 줄·지금 재생 탭은 첫 곡 이름(S.pending.track, nameFirst)을 미리 보여 줌. 판 가는 중 트랙 목록은 새 판 것(tkKey). 다른 기기에서 바뀐 판(external)은 예전처럼 모션만. 움직임 줄이기면 바로 재생. 대기 16초
                    - 크레이트 모션 C+E(2026-11-12 사용자 선택, 시안 https://claude.ai/artifact/RfzkgoDXyZedxTsFHkHC84): 위치 cf(소수)를 drawCrate()가 매 프레임 그림(lpPose 연속 자세, CSS transform 전환 없음)
                      손으로 훑기: 좌로·아래로 밀면 다음 판, 판이 손가락을 따라 기움(판 하나 = 상자 폭·높이의 22%). 놓으면 속도×0.17만큼 더 가서 스프링(springTo, k150 d19)으로 멈춤. 반올림이 바뀔 때 pos 저장·넘김 소리(cfCommit). 버튼·키·휠도 springTo, 끝이면 덜컹(crateBump). 폰 세로는 좌우만(pan-y), 넓은 가로는 위아래도(touch-action none)
                      표지 클로즈업: 멈추면 .crate-view.focus — 상자 1.07배(아래 고정), 뒤 판 흐림(place의 blur), 표지 위 빛(.sheen), 정보 쪽지 #cinfo(LP·연도·곡 수·들은 횟수). 움직이기 시작하면 바로 풀림
                    - 크레이트 보관함(2026-11-13 사용자 요청): 크레이트 위 칩 줄을 없애고, 크레이트 탭에 들어오면 보관함(목록, #cstore, cpanel data-cv='store')부터. 타일을 누르면 그 크레이트(data-cv='crate', 최대 540px로 크게, 아래 트랙 목록은 크레이트 탭에서 접음), '← 보관함'(#clBtn)으로 돌아감. 예전 #clist 창은 없앰
                    - 크레이트 목록(2026-11-12 사용자 요청, 크레이트 10개 넘음): (지금은 보관함 화면) 타일마다 지금 위치부터 표지 3장 묶음·이름·LP 수·들은 횟수, 지금 크레이트는 빨간 불
                      찾기(크레이트 이름 + 담긴 앨범·아티스트, 앨범이 맞으면 '일치하는 앨범 n장'·누르면 그 앨범 위치로), 정렬 내 순서(o)·최근(u)·많은 순·이름(music.csort). 내 순서일 때 ‹ › 로 이웃과 자리 바꿈(swapO, 동기화됨), ✎ = 이름 바꾸기·지우기(openCrateDlg). 누르면 그 크레이트 + 크레이트 탭
                    - 플레이리스트를 틀면 1.9초 모션: 클립보드가 날아와 턴테이블 위에 쾅(턴테이블 판 흔들림·빨간 충격파·진동) → 옆으로 걷어내면 밑에서 판이 돈다. 효과음 sfx: 넘김·슬리브·판 꺼냄·내려앉음·바늘 지직·쾅. Web Audio 합성(파일 없음), 설정 창에서 끔(music.sfx)
                    - 잼 모드(2026-11-12, public/jam/): 위 줄 JAM 버튼 → 불이 꺼지고 카세트 라디오(3D, jam/boombox.js) + J카드(손글씨 셋리스트, 나눔손글씨 펜)만 남음. jam.js는 처음 누를 때 import
                      잼 하나 = 새 Spotify 공동 작업 플레이리스트 "JAM 11.12"(POST /me/playlists, 실패하면 /users/{id}/playlists). 권한 playlist-modify-private/public을 SCOPES에 더함 → 예전 토큰은 다시 로그인 필요(토큰에 scope 저장 music.tok.s, MusicCore.hasScope)
                      곡 넣기: J카드 빈 줄/'+ 곡 넣기' → 찾기(곡 · 앨범 통째로) → POST /playlists/{id}/items(없으면 /tracks). 친구는 Spotify 앱에서 넣음(초대는 Spotify 앱 '공동 작업자 초대'). 4초마다 읽어 새 줄을 손글씨로 적음, 넣은 사람 이름(added_by → /users/{id})
                      첫 곡이 들어오면 자동 재생(context = 그 플레이리스트). 지금 곡 형광펜 · 들은 곡 줄 긋기 · 곡이 바뀌면 앨범 표지 폴라로이드가 데크 옆에 꽂힘. 릴은 잼 전체 진행만큼 감김(양쪽 테이프 덩어리 크기), 재생 중 회전, 스피커 엠블럼이 박자처럼 떨림
                      건반(3D 누름): PLAY · PAUSE · FF 다음 · REW 이전 · REC(장식, 잼 중 걸려 있음) · STOP/EJ 멈춤, 멈춘 채 한 번 더(또는 J카드 '잼 끝' 두 번) = 문이 열리고 테이프가 튀어나와 JAM 크레이트(c-jam)에 꽂힘. 키보드: 스페이스 · ←/→ · ?
                      카세트 디자인 18종(jam/tapes/*.webp = Stitch "Cassette Front Cover Designs" 마지막 판에서 잘라냄, shell.json = 옆면 색; 투명 아크릴만 코드로). 잼 id로 고르고 바로 전 잼(music.jamTape)과 겹치지 않게(tapeFor)
                      JAM 크레이트 항목은 k 'pl' + t(카세트 키, merge.js가 남김). 크레이트에서 누르면 턴테이블 대신 카세트로 다시 듣기(replay). 진행 중 잼은 music.jam에 저장 → 새로고침해도 이어 함. 잼 중엔 숨은 턴테이블의 판 갈기 모션을 하지 않음(window.MusicJamOn)
                      배경(2026-11-12 사용자 요청, jam/sea.js): 어둑한 망망대해 위 낚싯배. 라디오는 갑판 위 생선 상자(No.7)에, 왼쪽 등불(따뜻한 점광원·깜빡임), 밧줄 사리, 뱃전. 하늘·별·흐린 달, 물결 셰이더(사인파 4개, 해석적 법선, 달빛 길, 안개). 바다·하늘이 천천히 기울어 배가 흔들리는 느낌. 캔버스는 화면 전체, 라디오는 setFrame(왼쪽 칸)에 setViewOffset으로 맞춤
                      'Loan Shark 느낌'(사용자 요청, 분위기만): 탁한 초록빛 밤바다·짙은 안개, 세로 340px로 그려 CSS pixelated로 키움(LOWRES) + 4x4 바이어 디더 겹침(.jam-dith). 재생 중 스피커에서 음표(♪♫♬♩ 스프라이트)가 피어오름
                      p(황제펭귄, 사용자 요청: Penguin Lifter처럼 실제 같은 모습·눈 안 보임, 이름 p, 성격 '지 맘대로', 행동 과장): 회전체 몸 + 정점 색(검은 등·흰 배·노란 가슴·주황 귀 무늬), 긴 부리, 납작한 날개. sea.js 상태 기계 — dance(크게 까딱)·wander(뒤뚱)·slide(배로 미끄럼)·stare(바다 보기)·preen·sleep(Z, 음악에 깸)·sulk(등 돌림), 무작위로 바뀜
                      혼자(5분 넘게 친구 곡 없음)이고 지금 곡이 마지막이면 잼 안 아티스트(없으면 cur.seed)로 곡을 찾아 넣음(곡마다 한 번, 공중제비 'add'). 남이 넣은 곡은 25초 지나면 1/7 확률로 라디오까지 걸어가 쪼아서 FF(penguinSkip, 곡마다 한 번, 마지막 곡·p 곡은 안 넘김). p를 누르면 무시·꽥·벌러덩 중 하나(poke). 말풍선(penguinAt) + 꽥 소리. J카드에 'p'(music.jam.peng에 uri)
                      index.html이 window.MusicCore(api·toast·LS·targetDevice·state·poll·saveJam·relogin)를 넘겨준다. 효과음은 jam.js 안 합성(music.sfx 따름): 스위치·핀 조명·문·꽂힘·건반·감기·펜
public/mag/   잡지 MAG (2026-11-13). 위 줄 MAG 버튼 → mag.js(처음 누를 때 import). 화면 전체를 덮는 겹 하나를 Shadow DOM으로 그림(앱 CSS와 안 섞이게)
                    - (2026-11-13 사용자 요청) 우편함 탭은 없앰. 신간은 음악 앱을 열 때 팝업(#magPop: 신간 도착 · 지금 뜯기 / 나중에 = mag.later 12시간). 안 연 호는 책장에 비닐째 NEW로 꽂혀 누르면 상자부터. mag.js openIssue(id)
                    - 상자(안 연 호) → 테이프를 가로로 그어 자르기 → 비닐을 가로로 그어 찢기 → 한 장씩 넘겨 읽기 → 마지막 장 부록 싱글(비닐에 싸여 테이프로 붙음)
                    - 책장: 읽은 호가 출판사별 선반에 꽂힘(표지는 지면 HTML을 그대로 작게 그림), 누르면 바로 펼침. 저장 mag.opened {id: 시각}, mag.page {id: 넘긴 장}
                    - 지면 = issues/<id>/issue.html (펼침마다 <template class="sp">, 이미지 파일 같은 폴더). 펼침을 두 배 폭으로 그리고 반쪽씩 보여 줘서 넓은 화면은 두 쪽 펼침, 폰은 한 쪽씩
                    - 목록 issues/index.json (id, 잡지, 호, 날짜, 출판사, 색, crate{id,name,o}, tracks[{t,a}] = 부록 싱글 순서). 헤더 MAG 버튼의 빨간 점 = 안 연 호
                    - 부록은 호마다 큰 싱글 한 장(그 호의 곡 전부 + 라이너 노트 쪽). 누르면 테이프가 떨어지고 곡을 찾아 비공개 Spotify 플레이리스트 '<잡지> <호>'를 만들어(mag.pl[id]에 기억, 실패하면 곡 목록만 재생) 플레이리스트로 재생(MusicCore.playAlbum), 출판사 크레이트(c-pub-drop/fb/cy/mo)에 꽂음(MusicCore.addToCrate)
                    - 부록 LP(2026-11-13 사용자 요청): 싱글을 12인치 LP로. 투명 비닐(PVC) 커버 너머 검은 판이 보이고 비닐에 잡지사 시그니처(제호·줄임 마크·대표색)가 인쇄됨
                      그림 mag/sleeves/<mag>.webp(커버 800px) · <mag>-l.webp(판 라벨). 원본 scripts/mag-sleeves.html, 다시 뽑기 node scripts/mag-sleeves.cjs <출력 폴더>(Playwright, png → webp)
                      지면: mag.js lp12()가 .single7.bigs 안에 커버 그림을 끼움(테이프는 그대로). 크레이트 항목 = k 'pl' + m(잡지 키) + img(/music/mag/sleeves/…, merge.js가 이 경로만 허용)
                      m이 있으면 클립보드가 아니라 LP: 크레이트에 커버 그림, 판 갈기는 앨범 슬리브 모션(slam 아님), 3D 판 라벨은 잡지사 라벨 그림 그대로(deck3d lblSrc, 글자 안 얹음)
                    - 33⅓은 유저마다 다름(2026-11-13): index.json에 dynamic: true면 issue.html은 CSS만 쓰고 지면은 mag/m33.js build(MusicCore)가 만든다. 호 id = mo-YYYY-MM(달마다 새 호)
                      재료: /me, /me/top/tracks·artists(short_term), /me/player/recently-played, 이 기기 재생 기록 LS music.plays(index.html logPlay: poll 때마다 날짜별 곡 초·횟수·시간대, 62일 보관, 한국 시각. 앱이 열려 있을 때만 쌓임)
                      지면: 표지(앨범 표지 4장 원본 그대로 · 이름 · 청취 시간) · 편지·목차 · TOP 20 + 1위 · 언제 듣나(히트맵) + 아티스트 다섯 · 허세 카드(최대 6장, 카드마다 근거 숫자) · 부록(TOP 5 싱글)
                      권한 user-top-read·user-read-recently-played를 SCOPES에 더함 → 예전 토큰은 지면에 '다시 로그인' 버튼(data-act=relogin)
                    - 첫 호 4권: Drop Vol.01(U2), feedback vol.01(Kings of Leon), Cypher Vol.01(Aesop Rock & Blockhead), 33⅓(유저별 자동, 정적 mo-00은 CSS만). 사진은 Flickr CC(Openverse 경유), 저작자는 각 호 판권 쪽
                    - 편집 방침·성격·로직: docs/magazine/ (editorial-logic.md, mags/*.md 바이블, logo-prompts.md). 시안 원본은 docs/magazine/issues/
                    - 지면 만드는 법(지금은 수작업): 세션 스크래치에서 HTML 시안 → 이미지 data URI를 파일로 빼고 펼침을 template으로 감싸 issue.html. 다음 단계는 예약 편집 세션이 자동으로
                    - 친구 접속 손봄(2026-11-13): 크레이트는 Spotify 계정마다 따로(LS music.crates.<id>, 서버 k='music.u.<id>', 요청에 X-Spotify 토큰 → 서버가 /me로 확인). 로그인 전엔 동기화 안 함
                      예전 공유 문서 k='music'은 처음 동기화한 계정이 가져감(k='music.owner'). 그 계정 기기의 예전 LS music.crates는 합치고, 다른 계정 기기는 버림
                      잼 손님: 친구는 /music/#jam(또는 JAM 버튼, 초록 점 = 열린 잼)에서 jam/guest.js 창으로 곡을 보냄(로그인 없으면 '곡 이름 · 가수' 글자나 Spotify 링크). 서버 대기열 jam_q → 호스트 jam.js pullGuests()가 4초마다 가져가 자기 토큰으로 넣고 done. 셋리스트·지금 곡은 publish()로 k='music.jam'(8시간 지나면 끝난 것). 넣은 사람 이름은 music.jam.guests[uri]. 검증 test/music-api.mjs
                      잼 참가(같은 날, 사용자 요청): 로그인한 친구는 손님 창 대신 같은 잼에 들어온다(jam.js join, music.jam.guest). 셋리스트는 서버에서(호스트 publish가 uri·ms·img·지금 곡·재생 여부·위치 ps를 올림, 서버가 pu=서버 시각, 읽을 때 now를 줘서 시계 차이 보정)
                      친구 기기는 follow(): 호스트 지금 곡부터 uris로 자기 Spotify에 틀고, 곡이 다르거나 4초 넘게 어긋나면 다시(6초에 한 번까지), 호스트가 멈추면 멈춤. Premium 아니면 듣기만 빠짐
                      친구 건반·J카드 누르기 = /api/music/jam/ctl(jam_q kind 'ctl') → 호스트 runCtl이 실행 → 모두 따라감. 곡 넣기도 서버 대기열. 참가자 표시 /api/music/jam/hello(2초, 서버는 10초에 한 번만 씀) → J카드 '함께:'. 친구의 STOP/EJ 두 번·'나가기' = leave(잼은 계속), 호스트가 끝내면 친구 화면도 닫힘
                      로그인 안 한 친구는 예전처럼 guest.js 창(곡만 보냄)
                    - 친구용 링크 /deck/(2026-11-13 사용자 요청: 친구는 새 링크, 내 /music/은 그대로, 친구 관리는 사용자가 Spotify User Management로): Worker가 /deck/에 /music/index.html을 그대로 내줌(src/index.js). 화면 맨 위 스크립트 window.FRIEND = /deck 경로 → 제목 Deck, 매니페스트 public/deck/manifest.webmanifest(scope /deck/, 따로 설치), html.friend
                      친구 모드: Client ID 입력·안내·바꾸기 없음(GET /api/music/cid는 토큰 없이 열림, 값 없으면 '준비 안 됨'), Client ID 올리지 않음, Redirect URI = <주소>/deck/(사용자가 Spotify 대시보드 Redirect URIs에 추가). .owner-only/.friend-only로 설정 창 문구를 나눔. 내 설정 창에 '친구용 링크' 복사. 잼 공유 링크도 /deck/#jam
                      아이콘: 턴테이블 블루프린트(scripts/deck-icon.svg → node scripts/deck-icon.cjs → public/deck/icon-192·512·maskable-512.png)
                      Device not found: api()가 /me/player 404면 recoverDevice(기기 목록 다시 → 고르기 pickDevice → transfer → 같은 요청 다시). PC 브라우저 플레이어는 다시 연결. 폰·패드도 SDK를 다시 띄움(2026-11-13 사용자: '원래 브라우저에서도 됐었음'). 다만 폰·패드에선 자동으로 고르지 않고 기기 목록에서 'Sabathia'를 직접 골라야 씀, 죽은 기기면 reconnectSdk
                      버벅임: 유리 바·칸 backdrop-filter와 .dof 끔, 3D는 해상도 1.5배까지 · 평소 재생 30fps · 그림자는 움직일 때만 · 잼/숨김/화면 밖이면 안 그림. 라디오(boombox)는 잼 끝나면 멈춤(전엔 뒤에서 계속 그림), 그림자 1024 · 2번에 한 번
                    - 아이폰 사파리 탭 닫힘 대응(2026-11-13, 친구 제보 '문제가 반복적으로 발생'): 메모리 초과. 책은 지금 장 ±2만 내용을 넣고 나머지 장은 비워 display:none(mag.js near(), faces). 잡지가 열려 있으면 body.magon으로 뒤 앱(header·main·.amb·footer)을 숨기고 Deck3D.suspend(true)로 3D를 멈춤(닫으면 되돌림)
                    - LP 전체화면(2026-11-13): 턴테이블 줄 '전체화면' 버튼 또는 F 키. body.lpfull → 턴테이블 칸이 화면을 덮고 3초 손대지 않으면 위·아래 줄이 사라짐(lpidle), 왼쪽 아래 곡 이름 크게. Esc로 나감
## 잡지 개편 계획 (2026-11-13 논의, 아직 코딩하지 않음 — 사용자: '아직 코딩하지마')
- 목표: '진짜 연재 수준'의 글과 실제 잡지 수준의 디자인. 지금 Vol.01도 만족하지만 그 이상을 원함
- 글 방향(사용자 결정): 신곡은 Claude가 추천하고 그 아티스트를 깊게 해설하는 것만. 앨범 평가·점수는 하지 않음(Claude는 음악을 들을 수 없음 → 들은 척 금지)
- 연재 수준의 조건(합의한 안): 공개 인터뷰·다큐·기사·크레딧 교차 취재(인용은 출처 + 짧게), 기사 뼈대(장면으로 여는 첫 문단 → 왜 지금 → 전개 → 되돌아오는 끝), 형식 바꾸기(인물 탐구·에세이·한 곡 해부·연표·지도·공개 인터뷰 재구성), 잡지마다 고정 필진 1~2명(문체·버릇 고정), 호를 넘는 연재 코너(회차·지난 회 잇기·다음 회 예고), 편집부 기억 파일(지난 점수·다룬 아티스트·연재 진행·예고), 초고 → 사실 확인 → 편집장 재작성, 특집 6천~1만 자
- 참고 매체(사용자: 실제 잡지·평론 사이트 참고): Drop = Pitchfork·The Quietus·The Wire·IZM / feedback = Rolling Stone·The New Yorker 장문·Stereogum·weiv / Cypher = 리드머·HipHopDX·Pitchfork 랩 특집 / 33⅓ = 33⅓ 책 시리즈 형식. 문장은 베끼지 않고 쓰는 방식만
- 읽기(사용자: '지금 잡지가 읽기 조금 어색'): 지면(디자인, 넘겨 봄) + 읽기 모드(본문 덩어리·'▶ 계속' 누르면 지면 위로 올라오는 큰 글씨 한 단 스크롤, 그 잡지 글꼴·색, 끝에서 다음 기사). 화면용 판형(폰 세로·태블릿 가로, 펼침 반 자르기 그만). 본문 기준: 폰 최소 16px · 한 줄 30~38자 · 줄 간격 1.7 · keep-all
- 디자인 수준(솔직히 말한 것): 타이포·판짜기 8~9할, 데이터 그래픽은 그 이상, 사진 지면 6~8할(사진이 변수 → 사진 약한 아티스트는 타이포·일러스트 표지로), 손맛은 흉내 수준
- 손맛·사진 재료: 핀터레스트 사진은 쓰지 않음(저작권, 공개 주소) → 분위기 참고용으로만. 재료는 Smithsonian Open Access(CC0) · NYPL 퍼블릭 도메인 · 미국 의회도서관 · The Met/레이크스 오픈 액세스 · Rawpixel 퍼블릭 도메인 · Unsplash/Pexels · Openverse. 인쇄 실수 흉내(리소 판 어긋남·망점·복사기 질감·비뚤어진 붙임), 콜라주 규칙. 손글씨는 사용자가 찍어 주면 편집장 표식으로(선택)
- AI 이미지는 일러스트·질감·추상 그래픽에만. 실존 아티스트 얼굴·공연 사진처럼 보이는 것은 만들지 않음
- 커넥터: Adobe 연결됨(2026-11-13, 로그인 계정). 쓸 수 있는 것 = 사진 보정·배경 따기·망점·그레인·색 처리(Photoshop/Lightroom), 벡터화, Adobe Fonts 찾기·키트, Adobe Stock 무료 검색. 이 환경에선 생성형 AI(이미지 생성·생성형 채우기)는 안 됨(바깥으로 늘리기만). Unsplash는 연결했다고 했으나 세션에 아직 안 보임 → 새 세션에서 확인. Canva 연결됨(보조). Figma 보류
- 다음 순서: 참고 매체 조사·분석 문서 → 시험 원고 2~3편(같은 아티스트, 형식 다르게) + 지면·읽기 모드 시안 + 실제 지면과 나란히 비교 → 사용자 선택 → 필진·연재·편집 규칙 문서 → 그 뒤 시스템(예약 편집 세션, PR 검수 후 발행)
- 아직 사용자에게 받을 것: 시험 원고 잡지·아티스트, 특집 분량, 발행 주기

## 사용자 선호
- 답변은 짧고 직접적으로. 이모지 쓰지 않기. 한국어
- 안드로이드 폰 기준 안내, 아이패드·컴퓨터(가로 화면)도 많이 씀
- 시안을 여러 개 보여 주고 고르게 하는 방식을 좋아함. 질문은 적극적으로
