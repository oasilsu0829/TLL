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
- 친구용 버그 수정(2026-11-17, v1.12.1, 로컬 Playwright + 가짜 Spotify로 확인): 폰에서 기기 목록(.devs)이 오른쪽 화면 밖으로 나가 화면이 흔들림 → 760px 이하는 오른쪽 맞춤, Esc로 닫힘 · 개발 모드 User Management에 없는 계정은 Spotify가 403(글자 본문)을 줘서 '재생할 기기가 없습니다'로 보였음 → api()가 알아보고 ERR.UNREG(설정 창에도), 서버 /me 확인도 403 · 친구는 로그인할 때마다 서버 Client ID(fetchCid(true), 주인이 바꾸면 예전 값으로 계속 실패하던 것) · 잼 링크(#jam)로 와서 로그인하면 돌아올 때 #jam 유지(music.pkce.h) → 바로 참가 · 손님 창 '내 잼 새로 시작'은 서버 잼(하나뿐)을 덮어써 주인 잼을 끊었음 → 'Spotify로 로그인하고 같이 듣기'로 바꿈 · 동기화 오류 문구의 Sabathia '일정 앱 토큰' 안내 지움
- 아이폰 수정(2026-11-17, v1.12.4, 친구가 아이폰): pickCid의 뒤돌아보기 정규식((?<!…))이 iOS 16.4 전 사파리에서 메인 스크립트 전체를 깨뜨림 → 뺌. importmap도 16.4부터라 three를 '/3d/three.module.min.js' 경로로 직접 import(deck3d·boombox·RoundedBox, index.html의 importmap은 남겨 둠). 새 코드에 뒤돌아보기·importmap 의존 금지. IOS 상수: 기기 없음 안내('Spotify 앱을 열어 잠깐 재생한 뒤'), 홈 화면 앱 로그인에서 확인값을 잃으면 사파리에서 로그인하라는 안내. 실제 아이폰은 미확인
- 턴테이블 뒤 배경(2026-11-17, v1.13.1~1.14.0, 사용자 선택 2·5·6·7): body.night .deckp 배경 = 그레인·옅은 가로 결 + 위에서 떨어지는 원뿔 빛·바닥 웅덩이(--a3) + 어둠 덮개 --bgl(@property, 멈추면 .32, 곡 사이 .gap 숨 쉼). 3D 바닥 그림자 0.35
  - 시안(1~4안): https://claude.ai/artifact/HVbj3vHKXAD9cRrLeuQU5U
  - 온더락 잔(deck3d.js bar): 본체 오른쪽 가죽 코스터 위 갓파더(호박색 술·큰 각얼음), 잔 테에 걸친 시가(띠 T/L/L, 불씨 깜빡임), 연기 스프라이트 42개. 유리는 transmission을 쓰지 않는다(화면 뒤 CSS 배경을 못 담아 탁해짐) → 프레넬 셰이더 fres()(미리 곱한 알파 더하기 섞기, 크리스털 컷은 화면 미분 각진 면). 연기 때문에 조용할 때도 초당 15번 그림
  - 유리 v1.14.1(사용자 선택 D + 소리 S3): 프레넬 자체 발광은 조명에 비해 너무 밝아 버림. GMODE = PC·패드 'c'(실제 굴절: prepass가 4프레임에 한 번 잔 뒤 장면을 반 해상도 RT로 그림 — 앱 배경과 같은 그라데이션 판 backdrop을 카메라 앞 먼 곳에 세움, 술은 liqPre로 바꿔 넣음 → 굽·얼음·술이 refrM 셰이더로 굴절·분산·투과색, 술은 높이별 산란 빛) / 폰 'b'(조명 반응 반투명). 얇은 벽·컷 면·테는 둘 다 specM(검은 바탕 반사만 더하기). 밝기는 잔 위 조명 lamp를 따라감, 코스터에 호박색 맺힌 빛. 강제 localStorage tll.glass = "b"|"c"
  - 보드카·각얼음 v1.15.0(사용자 선택 B + 각얼음, 원래 갓파더 호박색 → 보드카 투명): 술은 물처럼 꺾이는 투명(C 굴절 str 0.06 + 수면 근처 아지랑이 shim, B 옅은 반투명). 수면 RingGeometry 64×12 꼭짓점으로 메니스커스 + 누르면 잔물결(shapeSurf), 수면 경계 은빛 고리
    술 다리(C만): 수면 위 안쪽 벽 clearcoatMap 줄무늬, 누르면 9초 흘러내림 · 잔 밖 성에·물방울(frost) + 흘러내리는 물방울 겹(runs, offset) · 각얼음은 BoxGeometry 4분할을 모서리 쳐 내고 흔든 각진 덩어리, 속에 공기 기둥 스프라이트·금 두 장·기포 점, 녹은 자국(clearcoatMap)
    녹기: 10분에 크기 88%·술 3% 늘어남, 판을 바꾸면(D.drop) 새 얼음. 코스터 맺힌 빛은 하얗게, 폰(b)에선 방사선 무늬가 져서 끔
  - 시가·재떨이 v1.18.0(2026-11-18 사용자 요청: 시가와 잔 분리 · 크리스털 재떨이 · 홈 대신 대각선 대칭 아트 문양 음각 · 리본 연기 · 한 모금): bar 안 tray(잔 앞, deck 기준 (1.17, -0.196, 0.56)). 팔각 두꺼운 유리(LatheGeometry 8면) + 둥근 우묵한 속, 유리는 잔과 같은 refrM(C)/옅은 반투명(B) + specM. 음각 = 캔버스 문양(sym8: 90도 4번 × 거울 = 8방향 대칭, 별·해살·8각 띠·대각선 부채꼴·마름모·X 격자·갈매기)을 더하기 섞기 흰 선으로 바닥(floorEng)·옆면 여덟 칸(sideEng), 밝기 nightK. 재 덩이는 조명 없는 재질(불씨 빛에 주황으로 물들어서)
    시가는 tray 자식(CIG_P·CIG_R): 불씨·재는 속 위, 머리는 테 밖 앞 왼쪽. 연기 = 리본 3가닥(stepRibbons: 화면을 향한 띠, 높이 RIB_H 0.5, 위로 갈수록 꼬이고 넓어짐) + 그 위 흩어지는 스프라이트 18개
    한 모금(재떨이 누름, act 'cig' → bar.puff, 소리 sfx.puff·exhale): 0~1.1초 scene.attach로 떼어 카메라 앞(nearPose: 오른쪽 아래 머리 → 왼쪽 위 불씨, 거리 0.55)으로 · 1.1~2.7초 빨기(불씨 emissive·emberL 세게) · 2.7~3.9초 돌아감 · 2.9초부터 입 앞에서 결 있는 연기 스프라이트(wispTex, 40개) 내뿜음 · 돌아온 뒤 리본이 2.2초에 걸쳐 다시 자람. 그동안 bar.lively()로 매 프레임
    확인: 로컬 Playwright(가짜 시계 pg.clock.pauseAt + runFor로 프레임 고정, swiftshader). 실제 폰·패드 성능은 미확인
  - 황동 실린더 전축 v1.22.0(2026-11-24 사용자 요청 '시가를 꾹 누르면 갓파더에 담긴 뒤 꺼내 불이 꺼지고, 토치로 다시 붙이면 연기가 나면서 실린더 황동전축으로, 시가도 시가렛으로' + 선택: 토치는 자동 연출 · 되돌리기는 같은 동작 · 실린더 판 갈기도)
    public/3d/phono.js(buildPhono): 마호가니 상자(앞면 금박 T/L/L) + 황동 모터 상자·조속기(돌수록 공이 벌어짐)·만드릴(왼쪽 모터, 오른쪽 빈 끝)·이송 나사·안내 막대·캐리지(재생기, 진동판 위) + 천 감은 고무관 + 고정 나팔 + 왼쪽 태엽 손잡이
    나팔(2026-11-25 사용자 '나팔 디자인이 마음에 안 듦' → 시안 5개 중 2 나팔꽃 + 사진(HMV 그라모폰)처럼 '훨씬 크게, 황동 느낌'): HORN 표(swan·glory·edison·side·cabinet, 미리보기 localStorage tll.horn), 기본 glory
      나팔꽃 R1 0.62(기계보다 넓음), 기계 뒤 위에서 앞을 내려다봄, 꽃잎 열 장(petal 0.035) + 꽃잎 따라 말린 테. 두드림 황동 그림(판마다 데이지·잎 덩굴·점 테두리 돋을새김 bumpMap, 솟은 이음매), 안쪽은 금빛으로 조금 스스로 빛남. 굵은 황동 크레인
      나팔마다 카메라 phono.cam {look, fit}(나팔꽃은 1.62배 멀리, deck3d resize)
    실린더 = 앨범: 표지 대표색(채도 가중 평균, sRGB) 셀룰로이드 + 홈 + 곡 사이 무음 홈 + 오른쪽 끝 띠에 제목·아티스트 각인. 재생기가 앨범 진행만큼 왼쪽→오른쪽. 멈추면 캐리지가 들림. 전축을 누르면 재생/정지(멈춰 있으면 태엽 감기 + sfx.crank)
    판 갈기(phono drop, 3초·소리 시각은 턴테이블과 같음): 옛 실린더가 오른쪽으로 빠짐 → 마분지 통(표지·제목 라벨)이 날아와 섬 → 뚜껑 튐 → 실린더 솟음 → 눕혀 만드릴 오른쪽 → 2.52초에 끼워짐. 플레이리스트(1.9초)는 통이 떨어져 0.646초에 쾅
    전축일 때 숨은 턴테이블 판은 모션 없이 바꿔 둠(phonoDrop). 브러시·판 잡기·먼지 덮개는 끔. 카메라는 나팔 때문에 조금 위·뒤(LOOK.phono)
    꾹 누르기(deck3d bar.dunk, 0.65초 · 누르는 동안 불씨가 밝아짐, 톡은 한 모금 그대로): 0~0.9 잔 위로 → 불 쪽을 술에 담금(1.25초 sfx.hiss, 불 꺼짐·재 떨어짐·김·잔물결) → 꺼내 물방울 셋 → 재떨이로 → 3.2초 토치(가스 제트, 오른쪽 뒤에서 겨눔)·3.8~5.0 파란 불꽃(sfx.torch), 끝이 달아오름 → 5.1 큰 연기(sfx.whoosh) + 카메라 앞 장막 → 6.0에 바꿔 치기(setMode) → 7.9까지 걷힘
    멈춤 버그(2026-11-25 사용자 제보 '한 번 불 끄고 토치가 안 나오고 앱이 멈춤', v1.22.1): 토치 불빛(PointLight)을 그때 더하고, 바꿔 치기 때 턴테이블·전축 속 불빛이 숨거나 나타나 불빛 수가 바뀜
      → three.js가 화면의 모든 재질 셰이더를 다시 만듦(53 → 94 → 148개, 폰에선 몇 초 멈춤·그래픽 죽음). 고침: 불빛은 처음부터 장면에 두고 세기만 바꿈(불씨 빛 하나를 시가·시가렛이 같이 씀, 라이터 불빛 lighterL, 전축 불빛 phLights는 deck3d가 만들어 buildPhono에 넘김),
      턴테이블을 숨길 땐 불빛이 든 묶음은 속만 숨김(setMode vis). 꾹 누른 순간 이번 연출에 나올 것을 잠깐 보이게 해 compileAsync + 굴절 그림판(bar.withRT)용까지 미리 만듦. 이제 연출 내내 셰이더 수 그대로(Deck3D._prog로 확인)
    라이터(2026-11-25 사용자 사진: 듀퐁 라인 2. 상표는 빼고 뚜껑에 T/L/L · PARIS): 3.7×6×1.2cm × 1.3배, 팔라듐 틀 + 검은 옻칠 판, 오른쪽 위 세로 홈 원통, 왼쪽 경첩 뚜껑, 굴뚝, 눈물 모양 노란 불꽃(파란 뿌리)
      순서: 2.35 시가를 재떨이 위 허공으로 들어 끝을 아래로 → 3.0 라이터가 올라옴 → 3.55 뚜껑 열림(sfx.cling) → 3.85 휠 딸깍·불똥(sfx.strike) → 3.9~5.0 불꽃(시가를 천천히 돌림, 4.2부터 달아오름) → 5.05 닫힘(sfx.clang) → 시가는 재떨이로
    피우기·연기(2026-11-26 사용자 '연기에서 그래픽 버그·랙 심함, 피우는 과정이 없음', v1.22.2): 라이터로 붙인 뒤 5.05~6.0 입으로(nearPose) → 6.0~7.2 빨기(불씨 dkDraw) → 7.25 살짝 내뿜음 → 7.6~8.7 한 번 더 → 8.75 길게 내뿜음(sfx.exhale·whoosh)
      화면 덮는 연기는 큰 스프라이트 34장 + 장막 4장 겹침 → 화면 전체 판 한 장(fog, 클립 좌표, 잡음 fbm 셰이더: 입 자리에서 번져 8.75~9.3 다 덮고 9.65~11.3 위로 흐르며 걷힘, 굴절 앞 그리기에선 숨김) · 9.45 바꿔 치기 · 11.4 끝
      입 앞 연기 결(exh)은 한 번에 14장까지(blow, 한 모금 때도 같음)
    황동(2026-11-25 사용자 '더 현실적으로'): 전축 황동·니켈은 따로 만든 반사 환경(어두운 바 + 갓등·전구·창 띠, PMREM)을 씀 → 밤에도 금속이 비친 것으로 빛남(밤낮에 따라 0.7~1.15). 닦은 황동 색 + 녹 얼룩 map + 광낸 결·손때·지문 거칠기, 나팔은 밝은 황동 두드림 그림 + 옅은 클리어코트, 겉 발광 없앰
    시가렛: 지름 8mm·84mm, 흰 종이·코르크 필터·금줄·T/L/L, 불씨·짧은 재·숯 단면(footM). 다시 붙인 뒤 재는 4분에 걸쳐 길어짐. 연기 리본은 0.55 굵기
    저장 localStorage tll.deck = 'tt' | 'phono'(기기마다). Deck3D.mode · setMode · dunk · dunking · onMode(index.html이 토스트) · _prog(셰이더 수)
    확인: 로컬 Playwright(가짜 시계로 담그기 9단계·실린더 갈기 9단계·토치 근접·폰 390px, 실제 마우스 꾹 누르기 → 전환). 실제 폰·패드 성능과 소리는 미확인
  - 소리 S3(sfx.clink): 얼음 달그락 두 번(6.5kHz 대역 잡음 + 딱) → 5.52k·5.546k 맥놀이 핑 + 8.3k·11k 배음
  - 재즈바 배경은 넣었다가 사용자 요청으로 지움(사진이 별로). 3D 재즈바 계획(카운터·술장·무대·펜던트, 폰 가벼운 판)은 '다음에'로 미룸. 잔을 누르면 잔이 코스터 위에서 살짝 돌고(용수철, 누를 때마다 방향 바꿈) 얼음이 흔들리며 쨍(sfx.clink)
  - 시가(로부스토): 겉잎 그림(얼룩·사선 이음매·잎맥, bump) + 손말이 굵기 흔들림, 세 겹 캡과 잘린 단면, 금박 띠(metalnessMap, 메달 T/L/L·RESERVA), 탄 띠·불씨 고리(emissiveMap 흐름)·겹 재(금 간 회백)
- 디깅(2026-11-26, v1.23.0 → v1.24.0, 사용자 요청 '평소 듣던 장르에서 벗어나면서도 좋아할 만한 독특한 장르의 앨범 찾기' + 시안 '디깅 덱 셔플'. 같은 날 사용자 '카드 디자인 바이시클처럼, 디그 버튼 없애고 온더락·시가 옆에 카드덱, 따로 화면 말고 LP 화면에서 카메라 이동')
  - 화면: 따로 뜨던 DIG 겹 화면(dig/dig.js)과 위 줄 DIG 버튼은 지움. 카드덱이 턴테이블 장면(deck3d.js) 바닥, 재떨이 왼쪽 앞에 놓여 있다(public/dig/table.js createDigTable)
    덱을 누름(clickables act 'dig', D.digOpen) → 카메라가 턴테이블 앞으로 내려옴(blendCam: deck3d가 평소 카메라를 정한 뒤 camW만큼 디깅 카메라로 섞음) → 시안 그대로 섞기 · 펼침 · 웨이브 · 네 장(아래 필터) → 고른 카드가 4바퀴 돌며 앨범 표지로 + 정보 창
    좌표: 시안의 미터 단위를 묶음 G(P0 (0.12, -0.196, 1.07), 배율 3)에 그대로. 디깅 카메라도 G 안에서 시안 fit()로 계산(lookAt 도우미는 꼭 카메라 객체: Object3D는 +Z를 봐서 반대로 봤음)
    불빛 digSpot·digFront는 deck3d가 처음부터 장면에 두고 세기만 바꿈(불빛 수가 바뀌면 셰이더 전부 다시 만듦). 디깅 중엔 calm이 아니고 pointerdown·pointermove는 dig가 먼저 가져감(턴테이블 조작 막음), 앱 키(스페이스·F)는 Deck3D.digging()이면 무시
    글자(칸 이름 · 판 고르는 중 · 닫기 × · 취향 다시 읽기 ↻ · 정보 창)는 body의 #digUi Shadow DOM(fixed, 캔버스 자리에 맞춤). 정보 창은 화면 700px 이상이면 캔버스 오른쪽 옆 창, 폰은 아래 시트
    닫기: × · Esc(공개 중이면 카드로) · '턴테이블에 올리기'(카드를 덱으로 모으고 카메라가 돌아온 뒤 MusicCore.playAlbum) · 곡 목록 줄 누름. 판 데이터가 늦으면 웨이브 끝(HOLD)에서 기다림
  - 앞면(숫자·무늬 쪽)은 v1.25.1에서 시안의 색 바탕 트럼프로 되돌림(사용자 '숫자랑 기호 써져 있는 부분은 전 게 더 좋았음'): table.js colorFace(320×447) — 장식 카드는 팔레트 PAL 18개, 뽑힌 네 장은 takeHand 때 앨범 대표색(faceOf) + 아래 장르 띠. 그래서 HOLD를 다시 웨이브 전(SP1 − 0.02)으로(뒤집히기 전에 앞면을 바꿔 둠). 아래 '흰 앞면' 설명은 v1.24.0~1.25.0 것
  - 카드 그림(고전 트럼프, 바이시클 같은 모양. 상표·천사 그림은 쓰지 않음): 뒷면 = 흰 테두리 + 빨강(#b0182a) 바탕에 흰 실선 네 잎 장미 격자 · 이중 테 · 모서리 소용돌이 · 가운데 타원 메달(판 동심원 + 위아래 날개, 점대칭). 앞면 = 흰 바탕, 세리프 숫자 + 무늬 색인(빨강 #c4122f · 검정), 전통 무늬 배치,
    그림 카드 J·Q·K = 테두리 상자 안 위아래 마주 보는 반신(왕관/모자 · 얼굴 · 빨강·파랑·노랑 띠 옷), 스페이드 에이스 = 큰 무늬 + 고운 고리 + 'T / L / L PLAYING CARDS'. 52장 중 36장을 처음 펼칠 때 만든다(canvas 400×559)
  - 필터 + 네 장(2026-11-26 사용자 '필터로 내가 원하는 범위 안에서, 4장, 하나는 아예 다른 장르, 나머지 3개는 필터 안', v1.25.0): 디깅 줄 '필터' 버튼 → 창(#flt, 정보 창과 같은 자리)에서 갈래(FAMS 18개)·시대(50~20년대)·에너지(조용 <.4 · 보통 · 강렬 ≥.7, 성질 0번)·소리(생악기 ≥.45 · 전자 ≤.55, 성질 1번) 칩을 여러 개 고름. 빈 칸 = 전부
    engine.deal: 1~3번 = 필터 안(inFilter, 연대는 대표 앨범 연도로: 그 연대 판이 있는 장르만, 판도 그 연대에서 pickSeed), 취향 점수로 위 7개에서 뽑고 같은 묶음은 ×0.35. 필터가 비면 이름 '취향 추천', 있으면 '범위 안'. 모자라면 필터 안 장르들 성질 중심에 가까운 바깥 장르로 채움('범위 근처', relaxed)
    4번 = '완전 다른 곳': 필터 밖 + 1~3번과 다른 묶음, 점수 = √취향 × (1 − 그 묶음 듣는 비율×3, 최대 .8), 위 12개에서 덜 치우치게. 카드 이름표는 폰에선 숫자만(다른 곳만 글자)
    저장 LS dig.v1.filter + fu(고친 시각) → doc.dig로 동기화(merge.js: fu 늦은 쪽). '이 범위로 섞기' = 저장 + 미리 고른 판 버림(gen으로 늦게 온 옛 판 무시) + 다시 섞기
    3D: NP = 4, T_END = FL0 + 3·FG + FD, 세 장 자리 slotP는 네 칸(간격 0.071, 거리 0.152/(tan·aspect) 이상), 키 1~4
  - 새 방식(2026-11-26 v1.26.0, 사용자 선택 '개선안 2(태그 그래프 + 실제 인기 앨범) + 3(씨앗에서 출발) + UI 깔끔하게'): 위 필터·장르 지도 방식은 Last.fm 키가 없을 때의 대신(취향 모드)과 넷째 장 대신으로만 남음
    도구줄(#tb): × · 취향|태그|씨앗(LS dig.cfg {mode, tags, dec, seed}, 기기마다) · 모드 버튼(취향 = ↻ 다시 읽기, 태그 = 고른 태그, 씨앗 = 씨앗 표지·이름). 아래 한 줄 설명(.cap). 설정 창 #pan 하나(태그·씨앗), 정보 창 = 장르 칩·칸 이름 · 제목 · 아티스트·연도·곡 수 · 왜 · 턴테이블에 올리기 · 아이콘 줄(좋아요·별로·담기·다시 섞기·다른 카드) · 곡 목록 접기(폰은 접힘)
    서버 src/lastfm.js: /api/music/lf?m=…(Last.fm, 허용 메서드만, 키는 Worker secret LASTFM_KEY — 없으면 501 nokey) · /api/music/lb/similar?mbid=(ListenBrainz labs 비슷한 아티스트, 키 없음). 캐시 7일(차트 1일)
    순수 로직 public/dig/tagx.js(test/dig.mjs): 장르 아닌 태그 거르기(JUNK: seen live·female vocalists·국적·연대·느낌 말), 너무 넓은 태그(BROAD: indie·rock·pop·k-pop…)는 목적지에서 뺌, related() = 낱말·합성어 겹침, homeTags · neighborTags(집에서 센 태그 > .2 제외, 별로 태그 ×0.05, 좋아요 ×1.6) · farTags(집·이웃·고른 태그와 낱말 안 겹침) · pickSpread(서로 안 겹치게) · pickAlbum(본 판·내 아티스트·모음집/라이브 제외, 인기 위 25에서) · seedSteps(한 다리는 위 6명 건너뜀)
    data.js: 취향 tasteHand = 내 아티스트 6명 → artist.getsimilar(4~30위, 내가 듣는 아티스트 제외) 16명 → 그들의 태그 → 이웃 태그 세 개 → tag.gettopalbums → Spotify에서 실제 판. 태그 tagHand = 고른 태그를 돌아가며(시대 필터는 Spotify 발매 연도로 맞을 때까지). 씨앗 seedHand = 씨앗 아티스트 → 비슷한(한 다리) · 그 옆(두 다리), Last.fm이면 대표 태그가 서로 다른 아티스트로, 판은 artist.gettopalbums → 없으면 Spotify 'artist:' 검색 첫 정규 앨범
    넷째 장 farCard = 차트 태그 200 + 장르 지도의 영어 태그 중 피할 태그와 안 겹치는 것의 인기 판. 키가 없거나 못 찾으면 장르 지도의 '완전 다른 곳'
    키 없을 때: 취향 = 예전 장르 지도(makeHand), 태그 = 창에 '키 필요' 안내·버튼 꺼짐, 씨앗 = MusicBrainz MBID → ListenBrainz 비슷한 아티스트 → Spotify 검색
    좋아요·별로 id는 't:<태그>'(merge.js GID가 받음). 취향 프로필 dig.prof에 P.arts(아티스트 40명 + 태그)를 같이 둠, Last.fm 태그 캐시 LS dig.lft 30일
    확인: 로컬 Playwright + 가짜 Last.fm·ListenBrainz·Spotify(1280×800 · 390×844, 키 있음/없음): 세 모드 네 장, 태그 창 입력·추천·70년대, 씨앗 창 지금 듣는 판, 정보 창. 실제 Last.fm 응답·태그 품질은 키를 넣은 뒤 확인할 것
  - 장르 지도 public/dig/atlas.js(Claude가 손으로 짠 표, 추천지 약 80장르 + '*' 집 칸): 장르마다 묶음(fam) · 성질 7개(에너지·어쿠스틱·그루브·어두움·보컬·실험성·시대, 숫자 0~9) · 태그 정규식 · 한 줄 설명 · 대표 앨범 2~5장('아티스트|앨범|연도'). 태그는 위에서부터 처음 맞는 칸 → 좁은 장르를 위에, 넓은 집 칸은 아래에(순서 중요, test/dig.mjs가 확인)
  - 엔진 public/dig/engine.js(순수, AI 호출 없음): 취향 = 아티스트 태그 → 칸 무게(w)·묶음 비율(fam)·성질 중심(c). 점수 = 성질 거리 가우스(σ .24, 좋아요한 장르 중심과도) × (1 − 듣는 정도), 많이 듣는 칸(w > .45)은 제외. 별로 ×0.12(같은 묶음 ×0.82), 좋아요 ×1.5, 최근 9장르 ×0.15
    (v1.23~1.24의 세 칸 옆 동네·건너 동네·먼 나라는 v1.25.0 필터 + 네 장으로 바뀜.) why() = 가장 가까운 내 장르와 같은 성질·다른 성질·연대(판 연도)로 한두 문장
  - 데이터 public/dig/data.js(처음 덱을 누를 때 import): 취향 readTaste(LS dig.prof 3일 캐시, ↻ 다시 읽기) = /me/top/artists 세 기간(3 · 2.2 · 1.5배) + 크레이트 아티스트(MusicCore.crateAlbums). 장르는 Spotify genres → 비었으면(개발 모드 앱은 자주 빔) /api/music/tags(src/tags.js, MusicBrainz 태그, 캐시 30일, 503이면 쉬었다 다시, LS dig.tags)
    makeHand: Spotify /search album:… artist:…(market=from_token) → 점수(아티스트 필수·이름·연도·컴필 감점) → 못 찾으면 그 아티스트 정규 앨범 중 연도 가까운 것 → /albums/{id}. 그래도 없으면 seen에 miss로 적고 같은 장르 다른 판. 표지 그림·대표색(paletteOf) → 공개 카드 표지 · 정보 창 포인트 색
  - 정보 창: 장르·칸·제목·아티스트·곡 수·레이블·왜·장르 설명·곡 목록(누르면 그 곡부터) · 턴테이블에 올리기 · 크레이트에 담기(DIG 크레이트 c-dig, T/L/L 폴더 기본) · 좋아요/별로(장르 단위) · 다시 섞기 · 다른 카드
  - 기록 LS dig.v1 { fb: {장르: {v, u}}, seen: {판 키: {t, g, miss?}}, recent } → fb·seen은 계정 문서 doc.dig로 동기화(merge.js cleanDig/mergeDig, magFold/magOut에 같이). 대표 앨범을 다 보면 그 장르는 안 나옴 → 지도에 앨범을 더 넣을 것
  - 확인: 로컬 Playwright(가짜 MusicCore, swiftshader): 1280×800 · 1180×820 · 390×844에서 덱 누름 → 카메라 이동 → 섞기 → 세 장 → 공개 → 담기·좋아요 → 턴테이블에 올리기(카메라 복귀 후 재생), 다시 섞기 · Esc · 섞는 중 × 닫기, 오류 0. 실제 Spotify 찾기 적중률·MusicBrainz·폰 성능·전축 모드에서 덱 위치는 미확인
- 테스트: `npm test` (test/music.mjs 합치기·잡지 기록, test/music-api.mjs API — node:sqlite, test/lyrics.mjs 가사 LRCLIB·NetEase, test/dig.mjs 디깅 지도·고르기·기록 합치기)

## 구조
```
public/index.html   앱 화면(예전 public/music/index.html). /deck/도 Worker가 이 파일을 내준다(window.FRIEND)
public/shell.js     예전 기록 가져오기(#from=, 한 번), /sw.js 등록
public/version.js   버전 하나(v·date·notes). 배포할 때마다 v를 올리고 notes 맨 앞에 바뀐 것을 적는다. sw.js가 importScripts로 읽어 캐시 이름(tll-<v>)으로 쓰므로 이 파일이 바뀌면 서비스 워커가 새로 설치된다
public/sw.js        캐시 먼저 + 뒤에서 갱신. /version.js?check 는 항상 네트워크
                    업데이트 확인(shell.js, 2026-11-16): 열 때 3초 뒤·돌아올 때(10분 간격)·30분마다 /version.js?check 와 비교. 새 버전이면 위쪽 띠(notes 3줄, 나중에 = tll.skip에 그 버전 저장). '업데이트' = reg.update() → 새 워커 설치·활성화(controllerchange) → 다시 열기, 8초 넘으면 새로고침. 열린 모달이 있으면 그 안에 popover로 띄운다. 설정 창 '버전 … · 최신 / 새 버전 있음' + 업데이트 확인 버튼. Shell.version · Shell.checkUpdate · Shell.update
public/lyrics.js    전체화면 가사(LRC 읽기·지금 줄 따라가기). 처음 전체화면 켤 때 import
public/merge.js     크레이트 합치기(화면·서버 공용). 예전 /music/mag/sleeves/ 그림 경로는 /mag/sleeves/로 바꾼다
public/3d · jam · mag · deck   턴테이블 3D(deck3d.js) + 황동 실린더 전축(phono.js) · 잼 · 잡지 · 친구용 매니페스트·아이콘
src/index.js        라우터(/deck/, 예전 /music/… → 새 경로 301, /api/music/*)
public/dig/          디깅(table.js 턴테이블 장면 안 카드덱·화면 · data.js 취향·판 찾기·Last.fm/ListenBrainz · tagx.js 태그·씨앗 고르기 · engine.js·atlas.js 장르 지도(키 없을 때)) · src/lastfm.js 프록시 · src/tags.js 아티스트 태그(MusicBrainz, /api/music/tags)
src/music.js        음악 API · src/util.js 테이블 준비(settings, jam_q) · src/lyrics.js 가사(LRCLIB · NetEase 프록시, /api/music/lyrics)
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
                    - 3D 추가(2026-11-11): 판에 곡 사이 무음 홈(곡 길이 비율), 바늘은 앨범 전체 진행(albumProgress, deck3d yawFor), 판 잡기 스크래치(Deck3D.onScratch: 잡으면 일시정지(이 브라우저면 SDK, 아니면 API), 놓으면 잡은 시점+돌린 만큼 seek 후 다시 재생, 한 바퀴 1.8초), 조명(2026-11-13부터 늘 켬: 버튼 없앰, <body class="night"> · Deck3D.setNight(true)), 슬리브 낡음(항목 p = 들은 횟수, 판 갈 때 +1, 20번이면 최대)
                    - 디자인 A+E(2026-11-11 사용자 선택): 3D 본체·받침 헤어라인 알루미늄, 앞면 각인(SABATHIA · DIRECT DRIVE TURNTABLE · 33⅓ · 45 RPM), 실제 그림자(shadowMap + ShadowMaterial 바닥), 턴테이블 칸 바닥 리넨. 앨범 표지 대표색 3개(paletteOf, --a1~a3)로 화면 배경(.amb) 전체를 물들이고 앨범이 바뀌면 1.6초에 넘어감, 위·아래 바·칸은 반투명 유리, 밤 조명이 앨범 색을 머금음(Deck3D.setTint)
                    - 밀봉 신보(2026-11-11): 설정에 위클리·데이리스트 링크(music.special). 회차 키(위클리 = 그 주 월요일, 데이리스트 = 날짜+아침/오후/저녁/밤)가 music.opened와 다르면 크레이트 위에 비닐째 뜸 → 가로로 70% 넘게 그으면 찢어짐 → 슬리브 누르면 판 모션(sealed: 플레이리스트여도 슬리브). 표지를 못 읽으면 sealArt()로 그림
                      (2026-11-15 버그) 비닐이 크레이트 칸 안에 있어서 폰에선 화면 밑에 깔리고, 판 꺼내기를 누르면 화면 밖 턴테이블에서 모션이 돌아 '판이 안 나옴' → #seal을 body로 옮겨 화면 전체 겹(z 300)으로, playSeal이 턴테이블을 화면에 끌어옴, 비닐이 뜨면 잡지 신간 팝업을 내림. 지금 재생·크레이트 탭 줄에 WEEKLY·DAYLIST 단추(#spW·#spD, 폰은 위클리·데일리): 누르면 언제든 뜸(이번 회차를 이미 뜯었으면 슬리브만, 링크가 없으면 설정 창). 새 회차면 불 켜짐(spxPaint)
                      컬러 바이닐(2026-11-16 사용자 요청): 위클리·데이리스트 판은 슬리브 그림(sealArt)과 같은 색(위클리 파랑·청록·연두, 데이리스트는 시간대 색) 그라데이션 + 동심원. index.html vcFor(key)가 music.special 링크와 맞으면 색을 L.vc로 넘기고 deck3d drawRecord가 판 윗면·옆면을 칠함, 지금 재생 판은 .np-disc.vc
                      남은 것: Spotify가 개발 모드 앱의 자동 플레이리스트(위클리·데이리스트) 읽기를 막아 이름·표지·트랙 목록은 못 받음(재생은 됨)
                      회차 기록(2026-11-17, v1.16.0, 사용자 요청 '커버 변동 없게 · 곡 목록 · 제목의 장르·느낌 반영'): LS music.spx {weekly|daylist: {key, id, title, tags, colors, img, tracks}}. ensureSpx가 회차마다 한 번 만들고 그 회차 동안 표지·판 색이 그대로(지금 재생 슬리브도 곡 표지 대신 회차 표지, entryFor·vcFor가 spxById로 읽음)
                        곡 목록: 서버 GET /api/music/spx?id(src/spx.js, open.spotify.com/embed/playlist/<id>의 __NEXT_DATA__, 15분 캐시, 로그인 없음). 위클리(디스커버 위클리)는 여기서 30곡이 옴. 데이리스트는 계정 전용이라 임베드가 'daylist' 0곡을 줄 수 있음 → 그 판을 트는 동안 /me/player/queue로 20초마다 채움(spxCapture). 비닐 밑 #sealTk에 보임
                        장르·느낌: tagsOf(제목)가 GENRES·MOODS 정규식(영어·한국어)으로 뽑음 → 색 = 첫 느낌, 무늬 = 첫 장르(dots·stripes·waves·grid·rings), 큰 글씨 = 요일·시간대 뺀 제목. 제목을 못 읽으면 비닐 창 '제목 넣기'(prompt)로 사용자가 넣음(그때만 표지 다시 그림). 실제 데이리스트로 임베드가 제목을 주는지는 미확인
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
                    - 크레이트 폴더(2026-11-24 사용자 요청 'T/L/L 크레이트 폴더', v1.22.0): 보관함 맨 위에 폴더 타일(마분지 폴더, 기본 T/L/L 폴더는 검은 가죽 + 금박). 누르면 그 폴더의 크레이트, '← 보관함'(#clUp)으로 맨 위
                      문서 folders {id: {id, name, o, u} | del} + 크레이트 f(폴더 id · '' = 일부러 밖 · 없음 = 기본: JAM(c-jam)·잡지(c-pub-*) 크레이트는 T/L/L(f-tll), 나머지는 밖). merge.js가 폴더도 u 늦은 쪽으로 합침(test/music.mjs)
                      새 폴더(+ 새 폴더 타일, #fdlg), 크레이트 편집 창에 폴더 고르기(#cdFold), 폴더 안에서 만든 크레이트는 그 폴더로. 폴더를 지우면 안의 크레이트는 맨 위로. 찾기 중엔 폴더 없이 전부(폴더 이름 표시). 담을 크레이트 고르기(#into)는 폴더별 optgroup
                      주의: 전역 .front 규칙(크레이트 앞판)이 있어 폴더 앞판 클래스는 .ffr
                      기존 크레이트 넣기(2026-11-25 사용자 요청, v1.22.3): 폴더 안 '+ 기존 크레이트 넣기' 타일 → #pkdlg(openPickDlg) 체크 목록(이 폴더 · 맨 위 · 다른 폴더별). 체크 = 그 폴더(c.f), 풀면 '' = 맨 위
                    - 보관함 정렬 줄(#clSort)·찾기 칸(#clQ) 뺌(2026-11-25 사용자 요청 '공간 확보', v1.22.4). 늘 내 순서(o), ‹ ›로 자리 바꿈. 아래 '크레이트 목록'의 찾기·정렬 설명은 예전 것
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
                      두들 2D(2026-11-22 사용자 요청 '잼을 3D에서 두들스타일 2D로', v1.19.0): boombox.js·sea.js(three)를 지우고 jam/doodle.js(캔버스 2D) 하나로. createBoombox 모양은 그대로라 jam.js는 import만 바꿈
                        낙서 붓: 선 굵기는 화면에서 늘 2.3px(장면 단위 U = 1/S), 손 떨림은 좌표 해시(처음엔 130ms마다 떨렸으나 v1.20.0부터 고정), 마커 칠은 선에서 어긋남, 빗금 칠. 그리기 재생·움직임 중 24fps, 아니면 15fps
                        장면(단위, 무대 가운데 0,0 · 720x540): 라디오 (-70,20) 440x280(건반 6개는 위에 꽂힘, 스피커 둘, 가운데 문 = 아래 경첩으로 열림, 카세트는 문 안), 생선 상자 No.7, 왼쪽 장대 등불, 오른쪽 밧줄 사리, 뱃전·갑판, 뒤 하늘·별·달·달빛 길·물결(배 흔들림 = 바다만 기울임)
                        카세트 18종은 그림 파일 대신 낙서 라벨(TCOL·labelArt, 껍데기 색은 tapes/shell.json). tapes/*.webp는 이제 안 씀
                        p: 옆모습 낙서(눈 없음), 상태 기계는 sea.js 그대로 2D로 옮김(dance·wander·slide·stare·preen·sleep·sulk·topeck/peck·add·squawk·ignore·flop)
                        종이 두 가지: paper(흰 스케치북·검은 펜, 기본) · night(검은 종이·흰 젤펜). 달을 누르면 바뀜(LS music.jamLook, .jam[data-look])
                        확인: 로컬 Playwright(가짜 MusicCore로 replay, 1180x820 · 390x844), 건반 PLAY 누름·펭귄 쪼기·꺼내기·달. 실제 폰은 미확인
                        안정되게(2026-11-22 사용자 '글꼴과 전체 디자인 좀 더 안정되게', v1.20.0): 글꼴 Nanum Pen Script → Gaegu(jam.js 크기 0.8배, doodle text 0.82배), 선 떨림 boil 끔(boil = 0, JA 0.75), 마커 어긋남 줄임, 스피커 빗금 → 동심원, 별 28개
                      금지곡(2026-11-22 사용자 요청 '20년대 이후 발라드나 아이브·에스파·아일릿 노래가 들리면 강제로 잼 종료', v1.20.0): jam.js checkBan(tick마다, 곡마다 한 번). 잼 중 재생되는 곡(잼 플레이리스트 밖이어도)이
                        아티스트에 IVE·에스파·아일릿(참여 포함, 이름 정규화 nm) → 또는 앨범 발매 2020년 이상 + (발라드 가수 목록 BALLAD 또는 /artists 장르에 ballad·발라드) → 멈춤 + 펭귄 말풍선 + 토스트 → 1.4초 뒤 end()(참가자는 leave). 개발 모드 앱은 장르가 비어 올 수 있어 목록을 같이 씀. 확인: 가짜 MusicCore로 7가지(IVE·에스파 피처링·장르 발라드·목록 발라드 → 끝남, 2008 발라드·2024 록 → 계속)
                      펭귄 p 새로(2026-11-22 사용자 요청 '대사 다 지우고 모션 부드럽게·행동으로 표현, 몰랑이 삐약이처럼 통통·귀엽게, 실제 펭귄 울음 비슷한 소리, 눈동자는 하얀색, 뚱뚱하게', v1.21.0):
                        모습(doodle.js drawPeng): 아래가 퍼진 공 몸(반폭 63·높이 106), 검은 머리·등 + 흰 얼굴·배(face에 따라 옆으로 밀려 고개 돌린 듯), 노란 볼 무늬·목, 볼터치(blush), 작은 부리(울 때·하품 때 벌어짐), 흰 눈(open·blink·happy·closed·squeeze·wide·angry·dizzy), 짧은 지느러미(+ 밖으로 듦, - 배·얼굴 쪽), 작은 발, 그림자
                        움직임: 상태는 목표 자세 T만 정하고 P가 지수 감쇠로 따라감(RATE), 한 번에 정해야 하는 것(깡충 높이·공중제비·찌부)만 D로 바로. 30fps(잘 땐 20)
                        상태: stand·wander(뒤뚱)·moon(달 보기)·preen(배 쓰담)·sit(철퍼덕, 발 까딱)·sleep(z, 코골이)·shiver·yawn / 재생 중 dance·bop·hop·spin·clap·slide / 사건 add(한 바퀴)·topeck/peck·cheer(새 곡, 지느러미 번쩍)·poke(squish·shy·boing·flop)·angry(금지곡: 부풀고 발 구름)·sulk. 30~70초마다 고개 들고 울음(재생 중엔 50~110초)
                        대사 없앰: jam.js bubble·PENG_LINES 등·.jam-bub CSS 지움. 소리는 doodle → api.onSfx(k) → jam.js sfx: call(황제펭귄 나팔: 톱니파 둘 7% 차이 + 28Hz 떨림 + 대역 통과, 세 음절) · peep(새끼 삐약) · honk(깜짝 꽉) · bray(화남, 히호) · snore
                        확인: 로컬 Playwright(가짜 MusicCore), 누르기 4번·멈춤·금지곡(화남 → 잼 끝)·폰. 소리는 오류 없이 도는 것까지만 확인(귀로는 미확인)
                      (아래 3D 시절 메모는 기록으로 남김)
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
                      부록 그림도 7인치 싱글로(같은 날 사용자 요청): mag-sleeves.html 기본이 7인치(label7: 큰 구멍을 피해 위·아래 띠에 글자, 45 RPM, '부록 싱글'), 예전 LP는 ?size=12. 화면 글자 '부록 LP' → '부록 싱글'
                      턴테이블 위에선 7인치 싱글(2026-11-13 사용자 요청: 실제 싱글 크기): deck3d kindOf(L.m) = SINGLE(반지름 0.35 = 12인치의 7/12, 그룹 scale, 라벨 크게, 가운데 큰 구멍 + 노란 45 어댑터 그림), 슬리브도 7¼인치. 내려앉으면 45 rpm 불 + 뒤 구석 어댑터 숨김(kindOn), 톤암·홈 빛·잡기 반지름은 지금 판 종류(recK). 지면 그림은 그대로 LP 비닐 커버
                      겹침 버그(같은 날): 판 갈기 도중 또 갈면(잡지가 열려 3D가 멈춘 동안 특히) 옛 판이 장면에 남아 새 판과 겹쳤음 → D.drop이 옛 판을 이어받아 사라지게, 내려앉을 때 장면에 남은 판을 치움
                    - 33⅓은 유저마다 다름(2026-11-13): index.json에 dynamic: true면 issue.html은 CSS만 쓰고 지면은 mag/m33.js build(MusicCore)가 만든다. 호 id = mo-YYYY-MM(달마다 새 호)
                      재료: /me, /me/top/tracks·artists(short_term), /me/player/recently-played, 이 기기 재생 기록 LS music.plays(index.html logPlay: poll 때마다 날짜별 곡 초·횟수·시간대, 62일 보관, 한국 시각. 앱이 열려 있을 때만 쌓임)
                      지면: 표지(앨범 표지 4장 원본 그대로 · 이름 · 청취 시간) · 편지·목차 · TOP 20 + 1위 · 언제 듣나(히트맵) + 아티스트 다섯 · 허세 카드(최대 6장, 카드마다 근거 숫자) · 부록(TOP 5 싱글)
                      권한 user-top-read·user-read-recently-played를 SCOPES에 더함 → 예전 토큰은 지면에 '다시 로그인' 버튼(data-act=relogin)
                    - 뜯은 기록 동기화(2026-11-13 사용자 '한 번 뜯어도 기록이 안 됨, 싱글이 계속 추가됨'): mag.opened·mag.pl이 기기마다 localStorage에만 있어서 다른 기기·홈 화면 앱에서 또 새 호로 뜨고, 부록을 누를 때마다 Spotify 플레이리스트를 새로 만들어 크레이트에 또 꽂혔음
                      → 크레이트 계정 문서에 mag { opened, pl }를 같이 실음(merge.js cleanMag/mergeMag: opened 합집합, pl 먼저 만든 것). index.html magFold/magOut가 LS ↔ doc.mag, mag.js는 뜯거나 부록을 만들면 MusicCore.magSaved(), 잡지 열 때 magPull(최대 3초). 신간 팝업은 첫 동기화(최대 6초)를 기다린 뒤 고름
                      부록 재사용: 이 기기 기록 → 크레이트에 꽂힌 같은 LP(MusicCore.findMagLp, 잡지 키 + 이름) → 내 Spotify 플레이리스트 중 같은 이름('<잡지> <호> 부록') → 그때만 새로 만듦. 크레이트의 같은 잡지·같은 이름 LP는 clean()이 한 장만 남김(이미 겹친 것도 정리). 비닐 뜯는 동안 넘김 화살표(#prev/#next)를 숨김(마우스 기기에서 양끝을 가렸음)
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
                    - LP 전체화면(2026-11-13): 턴테이블 칸 오른쪽 위 아이콘(#fullBtn .fsb) 또는 F 키. body.lpfull → 턴테이블 칸이 화면을 덮고 3초 손대지 않으면 아래 줄·단추가 사라짐(lpidle), 왼쪽 아래 곡 이름 크게. Esc로 나감
                      가사(같은 날 사용자 요청, 애플 뮤직처럼·전체화면에서만): 3D를 왼쪽으로 밀고(.deck3d right = --lyrw 44%) 오른쪽에 가사(#lyr, public/lyrics.js). 세로 화면은 턴테이블 위·가사 아래(--lyrh 46%)
                      가사 = /api/music/lyrics?t&a&al&d → src/lyrics.js가 LRCLIB(lrclib.net, 무료·키 없음) /get → /search(제목 그대로·feat./Remaster 뗀 제목·q) 순, 길이 5초 넘게 다르면 버림, Workers 캐시(찾음 7일·못 찾음 1일)
                      가사 개편(같은 날 사용자 '가사 너무 안 떠, 특히 한국 가사'): LRCLIB + NetEase(music.163.com 공개 검색·가사, K-pop·한국 곡 많음)를 같이 찾음. 시간 맞춘 가사 LRCLIB > NetEase > 그냥 가사. Spotify 이름(영문 제목·한글 가수 이름 '아이유')과 가사 쪽 이름('IU (아이유)')이 달라 못 찾던 것 → 괄호 속 다른 이름, 띄어쓰기·기호 무시 비교, 제목만 검색 후 가수·길이(8초)로 고르기, 가수가 달라도 제목이 똑같고 길이 2.5초 안이면 통과(NetEase는 한국 가수를 중국어 이름으로 둠). 화면은 가수 전부(a 여러 번)를 보냄. 캐시 키 v3(연주 크레딧 'Piano by：' 줄 빼면서 올림), 못 찾음 6시간. 시험 24곡(한글 가수 이름) 예전 20 → 24. Musixmatch 비공식 토큰은 쓰지 않음, 벅스 API는 막힘
                      지금 줄은 위 30%에 맞춰 부드럽게 올림(0.25초 먼저 켬), 지난 줄 더 흐리게, 빈 줄·긴 전주 = 점 세 개. 손으로 굴리면 3.5초 따라가지 않음. 줄 누르면 그 시각으로(MusicCore.seekMs). 시간 없는 가사는 그냥 글. 배경은 앨범 색(--a1·--a2)을 머금은 어둠
                      깊이·물결(2026-11-17 사용자 요청, 개선안 2·3): 지금 줄에서 떨어진 줄 수(data-d 0~5)만큼 흐림(손으로 굴릴 땐 없음). 스크롤은 바로 옮기고 지금 줄 위 8~아래 16줄을 원래 자리(--y)에서 줄마다 38ms씩 늦게(--dl) 되돌림. 1.2화면 넘게 뛰거나 화면 크기 바뀜·움직임 줄이기면 그냥 옮김. 1.13.1: 물결 1.1초 + 살짝 넘치는 곡선, 줄마다 55ms. 지금 줄 불빛(text-shadow)이 .lyr-sc 가장자리(overflow로 잘림)에서 잘려 선처럼 보이던 것 → .lyr-sc를 음수 margin + 같은 padding으로 넓힘. 남은 개선안: 단어별 채움(NetEase yrc 확인 필요), 간주 차오르는 점, 가사지 모드, 흐르는 배경, 턴테이블 연동, 가사 카드
                    - 싱글 7인치(2026-11-13 사용자 요청: '싱글로 분류돼 있으면 싱글로'): Spotify album_type 'single'(EP 포함) 앨범 + 잡지 부록 = isSingle(a). 종류는 LS music.atype {id: 's'|'a'}(찾기 결과 toAlbum · 지금 곡 render · 크레이트에서 모르는 것은 fillTypes가 /albums?ids= 20장씩, 막히면 한 장씩)
                      보이는 곳: 3D 판(Deck3D drop/prebuild/setLabel에 single → deck3d kindOf), 크레이트 .lp.s7(작은 슬리브, 밑을 받쳐 올림), 지금 재생 .np.s7(0.6배 · 큰 라벨 · 큰 구멍), 정보 쪽지 '7" 싱글', '이 싱글 듣기'
                    - UI 정리(2026-11-13 사용자 요청: 버튼이 많음): 턴테이블 위 줄(셔플·반복·조명·전체화면·SPOTIFY CONNECT·기기 표시)을 없앰. 셔플·반복은 아랫줄 이전/다음 양옆 아이콘(.sq.ghost, 켜지면 포인트 색 + 점, 한 곡 반복은 1 표시), 전체화면은 턴테이블 칸 오른쪽 위 아이콘, 기기는 아랫줄 기기 단추만
## 잡지 개편 계획 (2026-11-13 논의. 같은 날 사용자 '첫 시험 호를 만들어줘' → feedback vol.02로 실행, 아래 '개편 첫 시험 호')
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
- 사용자는 '독자이고 싶다'(2026-11-13): 편집 결정은 Claude가 한다. 시안을 고르게 하지 말고 완성된 호를 내놓을 것(결과에 대한 의견만 받음)
- Claude가 정한 것: 발행 = 한 주에 한 권씩 돌아가며(1주 Drop 금 · 2주 feedback 월 · 3주 Cypher 수, 33⅓은 매달 자동). 특집 7천 자 안팎 + 짧은 꼭지 4~6개. 첫 시험 호 = feedback(밴드 아티스트 해설은 장문에 가장 잘 맞음), 아티스트는 그 주 신보를 조사해 Claude가 고름
- 더 붙이면 좋은 커넥터: Melon(국내 차트·아티스트·뮤직스토리, Cypher 국내 취재), Spotify 커넥터(신보·트랙 확인). Unsplash는 새 세션에서 확인. Viberate는 유료라 보류

## 개편 첫 시험 호 — feedback vol.02 (2026-11-13)
- 커버 브레인스토리 [Shoebox Days](11/13 Big Crown, 롱비치 작업실 '슈박스'에 바치는 EP). 점수 없음. 커버 스토리 약 6,400자 + 편집장의 글 · 이번 주 밴드(웨이브스·앤벌린) · 이 판과 어울리는 밤 · 새 연재 '방' 1회(빅 핑크) · 앞줄(신인 두 팀: 잔물결·아이우에오, 출처 2곳 기준으로 세 팀 못 채움) · 공연 소식 · 편집 노트(출처 31곳) · 부록 LP 11곡
- 판형 2(index.json `fmt: 2`): issue.html에 쪽마다 `<template class="pg">`(2:3), 기사 본문 `<template class="art" data-id data-title>`. 폰은 한 쪽씩, 820px 이상은 표지 한 쪽 → (1,2)(3,4)… 두 쪽 펼침(반 자르기 없음). 예전 호(sp 펼침)는 그대로 열림
- 읽기 모드(mag.js openReader): 지면의 `[data-read=기사][data-at=문단]`(▶ 계속 읽기) 또는 위 줄 '본문 읽기'(지금 쪽의 data-art) → 아래에서 올라오는 한 단 스크롤. 폰 17px · 700px 이상 19px, 줄 간격 1.7, 최대 36em(태블릿 한 줄 약 34자), keep-all. 끝에 '다음 기사'. Esc·'지면으로'로 닫힘. 그 잡지의 글꼴·색은 issue.html의 `--rd-*` 변수와 `.x2r` 규칙
  - 폰 한 줄은 화면 폭 때문에 20자 안팎(16px 이상을 지키면 30자는 안 됨)
- 만드는 법: 원고 `docs/magazine/issues/<id>/articles.md` + 지면 `pages.html` → `python3 scripts/mag-issue.py docs/magazine/issues/<id>` → `public/mag/issues/<id>/issue.html`. 지면 클래스는 `x-` 접두어로 `.x2` 아래에만(같은 Shadow DOM에 다른 호 CSS가 함께 들어오고, mag.js의 전역 h2 규칙도 있음)
- 취재 노트·설계도·데스크 기록 `docs/magazine/issues/fb-02/notes.md`, 편집부 기억 `docs/magazine/memory/feedback.md`, 바이블 맨 위 '개편' 항목
- 사진 없음: 이 세션은 이미지 호스트(Openverse·Wikimedia·Unsplash)와 WebFetch가 막혀 웹 검색 요약으로만 취재했다. 표지는 신발 상자 라벨 타이포 + CSS/SVG 그림(지도·연표·상상 평면도·분홍 집). 네트워크가 열린 세션에서 사진을 넣을지는 사용자 의견을 보고 정할 것
- 검증: 로컬(Playwright, 390×844 · 1180×820)에서 18쪽 넘김, 넘치는 글 0, 읽기 모드 열기·다음 기사·닫기, 상자·비닐 뜯기, 책장 표지, 예전 fb-01 열림 확인. 실제 폰·Spotify 부록 재생은 미확인
- 다음: 사용자 의견 받기. Drop · Cypher는 예약 편집 세션이 판형 2로 낸다(아래)

## 발행 시스템 (2026-11-13, 사용자 결정: 연재 시스템 '둘 다' + 예약 세션이 만든 호는 '바로 발행')
- 규칙 문서 `docs/magazine/system.md` 하나가 예약 편집 세션의 지시서. 순환: 2026-11-09 주 = 0, n%3 → 0 Drop(금) · 1 feedback(월) · 2 Cypher(수). 차례가 아니거나 같은 날짜 호가 있으면 아무것도 안 바꾸고 끝
- 예약 작업 3개(이 계정, 매주, 새 세션): Drop 금 18:47 · feedback 일 21:43 · Cypher 화 21:41 (한국 시각). 프롬프트는 'system.md대로 <잡지> 다음 호'. 첫 실제 발행 = Cypher 11/24 밤(11/25 자)
- 발행 = 브랜치 mag/<id> → PR → 바로 병합(squash, 사용자 허락). 관문은 `node scripts/mag-check.mjs <id>`(구조·금지어·점수 표기·가사 의심 인용·출처 10곳·연재 회차·폰/태블릿 넘침·읽기 모드·스크립트 오류). 오류가 남으면 '[발행 보류]' PR만 두고 끝
- 사진 `python3 -I scripts/mag-photo.py <원본> <id> <이름> --credit --src --look plain|duo|halftone|riso|xerox` → webp + docs/magazine/issues/<id>/credits.json. ND 라이선스는 거부
- 연재 `public/mag/serials.json`: feedback '방'(노암 갤러거, 1회 fb-02) · Drop '정전 해부'(고한석) · Cypher '언더그라운드 연대기'(돈까스). 앱 책장 위 '연재' 탭(회차 누르면 그 글을 읽기 모드로, mag.js openArticle), 연재 글 끝에 지난 회·다음 회(예고)
- 편집부 기억 `docs/magazine/memory/<feedback|drop|cypher>.md`, 바이블마다 맨 위 '개편' 항목(점수 없음, 필진, 연재)
- 기본 브랜치(claude/practical-mccarthy-1catzl)에 이 시스템이 병합돼 있어야 예약 세션이 돈다
- 특별판 세 권(2026-11-14 사용자 요청, 정기 순환 밖, mag-new.mjs --force 후 날짜를 11.14로): Drop Vol.02 스노 알레그라 [Legendary Love] · feedback vol.03 슬립워크 [View From The Outside] · Cypher Vol.02 황지상 [#800080]. 연재 정전 해부 1회([Voodoo]) · 방 2회(노란 집) · 연대기 1회(2004). index.json 항목에 special: true
  - 고친 도구: mag-issue.py가 지면의 상대 경로 그림을 /mag/issues/<id>/로 바꿈(전엔 Shadow DOM에서 앱 주소 기준으로 풀려 사진이 안 보였음, mag-check가 상대 경로를 오류로 잡음) · mag-check 점수 검사에서 URL 제외(2026/10 같은 주소가 '6/10'으로 걸렸음) · mag-photos.py Commons 원본 대신 썸네일(429·400 회피)
- 컨셉 먼저(2026-11-14 사용자: '정해진 스킬대로보다 매주 새 컨셉에 맞게 알아서 쓰는 게 재밌을 듯, 지금은 글도 재미가 없어'): system.md 4장을 '컨셉 → 재미 규칙'으로 바꿈. 고정은 사실 약속·출처·편집 노트·부록·연재 한 회·판형 2 기술뿐. 정형 소제목 금지, 사진은 Unsplash·Adobe 커넥터 먼저(6장)
- Unsplash·Adobe 필수(2026-11-14 사용자: '콜라주·아트워크 만들려면 필수'): system.md 6장. 확인한 길 = Unsplash download_asset → curl → Adobe asset_initialize/PUT/finalize → image_remove_background·image_apply_effects → curl → mag-photo.py `--alpha`(새 옵션, 투명 유지). Unsplash 주소를 Adobe에 바로 넣으면 거절됨. 호마다 콜라주·아트워크 쪽 하나 이상
- 빨리 만들기(2026-11-13): 스킬 `.claude/skills/mag-issue/SKILL.md`. `node scripts/mag-new.mjs <drop|fb|cy>` = 차례 검사 + 뼈대(TODO는 mag-check가 오류로 잡음), `python3 -I scripts/mag-photos.py search|get` = 커넥터 없이 Commons·Openverse·의회도서관·시카고 미술관에서 쓸 수 있는 라이선스 사진만 받아 mag-photo.py로(400KB 자동 축소). mag-check는 사진 파일·크레딧·8장 한도도 검사. 이 세션은 claude.ai 커넥터 전부가 502로 실패했다(Commons는 429가 잦지만 기다리면 됨, Openverse는 504)

## 사용자 선호
- 답변은 짧고 직접적으로. 이모지 쓰지 않기. 한국어
- 안드로이드 폰 기준 안내, 아이패드·컴퓨터(가로 화면)도 많이 씀
- 시안을 여러 개 보여 주고 고르게 하는 방식을 좋아함. 질문은 적극적으로
