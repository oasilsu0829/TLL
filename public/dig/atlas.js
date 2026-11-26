// T/L/L 디깅 — 장르 지도(2026-11-26). Claude가 손으로 짠 표. 엔진(engine.js)이 이것만 보고 고른다(외부 AI 호출 없음)
// 한 줄 = [id, 이름, 묶음(fam), 성질, 찾는 말(정규식, 소문자 태그에 맞춤), 한 줄 설명, 대표 앨범]
//   성질 = 숫자 7개(0~9): 에너지 · 어쿠스틱(9 = 생악기, 0 = 전자) · 그루브 · 어두움 · 보컬 중심 · 실험성 · 시대(0 = 1950년대 … 9 = 2020년대)
//   대표 앨범 = '아티스트|앨범|연도' 를 ; 로 이음. Spotify 찾기로 실제 판을 잡는다. 못 찾으면 그 장이름으로 아티스트를 찾는다
//   이름이 '*'로 시작하면 '집' 전용(사용자를 놓는 자리만 하고 추천지로는 안 씀): 흔한 장르를 받아 주는 칸
// 묶음 fam이 같으면 '가까운 동네'. WORLD 묶음은 지역 음악(멀리 떠나는 카드)
export const FAMS = {
  rock: '록', pop: '팝', elec: '전자', hiphop: '힙합', soul: '소울·펑크', jazz: '재즈', folk: '포크', metal: '메탈', roots: '블루스·컨트리',
  reggae: '레게', classical: '현대음악', brazil: '브라질', latin: '라틴', africa: '아프리카', mena: '중동·남아시아', asia: '아시아', europe: '유럽', korea: '한국',
};
export const WORLD = new Set(['brazil', 'latin', 'africa', 'mena', 'asia', 'europe', 'korea']);
export const TRAITS = ['에너지', '어쿠스틱', '그루브', '어두움', '보컬', '실험성', '시대'];

const RAW = [
  // ── 록
  ['krautrock', '크라우트록', 'rock', '6452172', 'kraut|motorik|kosmische', '반복되는 한 박자로 끝없이 달리는 70년대 독일 록', 'Can|Tago Mago|1971;Neu!|Neu!|1972;Can|Ege Bamyasi|1972;Harmonia|Musik von Harmonia|1974;Faust|Faust IV|1973'],
  ['prog', '프로그레시브 록', 'rock', '6614272', 'prog|symphonic rock|zeuhl', '길고 복잡한 구성, 변박과 긴 연주', 'King Crimson|In the Court of the Crimson King|1969;Yes|Close to the Edge|1972;Gentle Giant|Octopus|1972;Premiata Forneria Marconi|Storia di un minuto|1972;Magma|Mekanïk Destruktïw Kommandöh|1973'],
  ['canterbury', '캔터베리 신', 'rock', '4724372', 'canterbury', '재즈 화성과 영국식 유머가 섞인 부드러운 프로그', 'Caravan|In the Land of Grey and Pink|1971;Soft Machine|Third|1970;Robert Wyatt|Rock Bottom|1974;Hatfield and the North|Hatfield and the North|1974'],
  ['postpunk', '포스트펑크', 'rock', '7546454', 'post-punk|post punk|dance-punk', '날 선 기타와 앞으로 나온 베이스, 차가운 리듬', 'Joy Division|Unknown Pleasures|1979;Wire|Pink Flag|1977;Gang of Four|Entertainment!|1979;The Raincoats|The Raincoats|1979;ESG|Come Away with ESG|1983'],
  ['noiserock', '노이즈 록', 'rock', '8526375', 'noise rock|no wave|noise-rock', '기타 소음을 악기처럼 쓰는 거친 록', 'Sonic Youth|Daydream Nation|1988;Shellac|At Action Park|1994;Big Black|Songs About Fucking|1987;Swans|To Be Kind|2014'],
  ['coldwave', '다크웨이브·콜드웨이브', 'rock', '5257463', 'darkwave|coldwave|cold wave|gothic rock|goth rock|deathrock|minimal wave', '신스와 드럼머신 위의 어둡고 춤출 수 있는 노래', 'Molchat Doma|Etazhi|2018;The Cure|Pornography|1982;Siouxsie and the Banshees|Juju|1981;Clan of Xymox|Clan of Xymox|1985'],
  ['shoegaze', '슈게이즈·드림팝', 'rock', '4426553', 'shoegaze|dream pop|dreampop|nu gaze', '소리가 번지고 목소리가 안개 속에 묻히는 록', 'My Bloody Valentine|Loveless|1991;Slowdive|Souvlaki|1993;Cocteau Twins|Heaven or Las Vegas|1990;Mazzy Star|So Tonight That I Might See|1993'],
  ['slowcore', '슬로코어', 'rock', '1608636', 'slowcore|sadcore', '아주 느리고 조용하게, 한 음을 오래 두는 록', 'Low|Things We Lost in the Fire|2001;Red House Painters|Red House Painters|1993;Codeine|Frigid Stars|1990;Duster|Stratosphere|1998'],
  ['mathrock', '매스록·미드웨스트 이모', 'rock', '6634346', 'math rock|math-rock|midwest emo|emo revival', '반짝이는 기타 아르페지오와 엇박', 'American Football|American Football|1999;toe|For Long Tomorrow|2009;Don Caballero|American Don|2000;Cap\'n Jazz|Analphabetapolothology|1998'],
  ['postrock', '포스트록', 'rock', '5508166', 'post-rock|post rock', '노래 대신 긴 고조와 폭발로 이야기하는 록', 'Talk Talk|Spirit of Eden|1988;Slint|Spiderland|1991;Godspeed You! Black Emperor|Lift Your Skinny Fists Like Antennas to Heaven|2000;Tortoise|TNT|1998;Mogwai|Young Team|1997'],
  ['garage60', '60년대 개러지·사이키', 'rock', '8653541', 'garage rock|garage punk|freakbeat|acid rock|psychedelic rock', '거칠게 녹음한 60년대 기타 밴드', 'The Sonics|Here Are the Sonics|1965;The 13th Floor Elevators|The Psychedelic Sounds of the 13th Floor Elevators|1966;The Stooges|Fun House|1970;Love|Forever Changes|1967'],
  ['stoner', '스토너·데저트 록', 'rock', '8536442', 'stoner|desert rock|sludge', '두껍고 느린 퍼즈 기타, 사막의 열기', 'Kyuss|Blues for the Red Sun|1992;Queens of the Stone Age|Songs for the Deaf|2002;Sleep|Dopesmoker|2003;Earthless|Rhythms from a Cosmic Sky|2007'],
  ['baroque', '바로크·체임버 팝', 'pop', '3725731', 'baroque pop|chamber pop|sunshine pop', '현악·관악을 곁들인 공들인 60년대 팝', 'The Zombies|Odessey and Oracle|1968;Scott Walker|Scott 4|1969;Van Dyke Parks|Song Cycle|1968;The Left Banke|Walk Away Renée/Pretty Ballerina|1967'],
  ['artpop', '아트 팝', 'pop', '5444767', 'art pop|art-pop|avant-pop', '팝의 틀 안에서 소리와 목소리를 실험', 'Kate Bush|Hounds of Love|1985;Björk|Homogenic|1997;Laurie Anderson|Big Science|1982;Arthur Russell|World of Echo|1986'],
  ['yacht', '요트 록·소피스티 팝', 'pop', '3575934', 'yacht rock|soft rock|sophisti-pop|adult oriented rock|aor', '매끈한 화성과 스튜디오 연주자들의 70~80년대', 'Steely Dan|Aja|1977;Sade|Diamond Life|1984;Prefab Sprout|Steve McQueen|1985;Michael Franks|The Art of Tea|1976'],
  ['hyperpop', '하이퍼팝', 'pop', '9070489', 'hyperpop|glitchcore|bubblegum bass|digicore', '과장된 목소리와 깨지는 전자음의 팝', '100 gecs|1000 gecs|2019;SOPHIE|Oil of Every Pearl\'s Un-Insides|2018;Charli xcx|how i\'m feeling now|2020'],
  ['exotica', '이그조티카·라운지', 'pop', '2562352', 'exotica|lounge|space age pop|easy listening', '새소리와 비브라폰, 상상 속 남국의 50년대 팝', 'Martin Denny|Exotica|1957;Les Baxter|Ritual of the Savage|1951;Arthur Lyman|Taboo|1958'],
  ['library', '라이브러리·영화음악', 'pop', '4553263', 'library music|soundtrack|spaghetti western|giallo|film score', '60~70년대 영화와 방송을 위해 만든 연주곡', 'Ennio Morricone|The Good, the Bad and the Ugly|1966;Piero Umiliani|To-day\'s Sound|1973;Broadcast|The Noise Made by People|2000;Alessandro Alessandroni|Industrial|1972'],
  // ── 전자
  ['ambient', '앰비언트', 'elec', '0108097', 'ambient|drone|dark ambient', '박자 없이 공간을 채우는 소리', 'Brian Eno|Ambient 1: Music for Airports|1978;Stars of the Lid|And Their Refinement of the Decline|2007;William Basinski|The Disintegration Loops|2002;Gigi Masin|Wind|1986'],
  ['kankyo', '환경음악(일본 앰비언트)', 'asia', '0305094', 'kankyo|kankyō|japanese ambient|environmental music', '80년대 일본에서 공간을 위해 만든 맑은 미니멀 앰비언트', 'Hiroshi Yoshimura|Music for Nine Post Cards|1982;Midori Takada|Through the Looking Glass|1983;Satoshi Ashikawa|Still Way|1982'],
  ['fourth', '포스 월드·뉴에이지', 'elec', '1434077', 'new age|fourth world|4th world', '세계 각지 리듬과 전자음이 섞인 명상적인 소리', 'Jon Hassell|Fourth World, Vol. 1: Possible Musics|1980;Laraaji|Day of Radiance|1980;Suzanne Ciani|Seven Waves|1982'],
  ['idm', 'IDM', 'elec', '4064186', '\\bidm\\b|braindance|glitch|intelligent dance', '듣기 위한 전자음악, 꼬인 비트와 따뜻한 신스', 'Aphex Twin|Selected Ambient Works 85-92|1992;Boards of Canada|Music Has the Right to Children|1998;Autechre|Amber|1994;Squarepusher|Hard Normal Daddy|1997'],
  ['triphop', '트립합', 'elec', '3274556', 'trip hop|trip-hop|downtempo|bristol sound', '느린 힙합 비트에 어두운 영화 같은 분위기', 'Massive Attack|Mezzanine|1998;Portishead|Dummy|1994;DJ Shadow|Endtroducing.....|1996;Tricky|Maxinquaye|1995'],
  ['jungle', '정글·드럼앤베이스', 'elec', '8085265', 'jungle|drum and bass|drum & bass|\\bdnb\\b|liquid funk|atmospheric drum', '아주 빠르게 쪼갠 브레이크비트와 깊은 베이스', 'Goldie|Timeless|1995;Roni Size|New Forms|1997;LTJ Bukem|Journey Inwards|2000;Squarepusher|Feed Me Weird Things|1996'],
  ['ukg', 'UK 개러지·2스텝', 'elec', '6086366', 'uk garage|2-step|2 step|future garage|speed garage|dubstep', '엇갈린 하이햇과 잘린 보컬의 런던 클럽 음악', 'Burial|Untrue|2007;The Streets|Original Pirate Material|2002;MJ Cole|Sincere|2000;Mount Kimbie|Crooks & Lovers|2010'],
  ['footwork', '풋워크', 'elec', '9093388', 'footwork|juke', '시카고의 160bpm 발재간 춤곡, 잘게 쪼갠 샘플', 'DJ Rashad|Double Cup|2013;Jlin|Black Origami|2017;RP Boo|Fingers, Bank Pads & Shoe Prints|2015'],
  ['techno', '디트로이트 테크노', 'elec', '7084165', 'detroit techno|techno|electro$|minimal techno', '기계 리듬 위의 공상과학과 소울', 'Drexciya|Neptune\'s Lair|1999;Carl Craig|More Songs About Food and Revolutionary Art|1997;Robert Hood|Minimal Nation|1994;Underground Resistance|Interstellar Fugitives|1998'],
  ['deephouse', '딥하우스', 'elec', '5293346', 'deep house|chicago house|garage house|soulful house', '재즈·소울 샘플을 품은 느긋한 4박 춤곡', 'Moodymann|Mahogany Brown|1998;Theo Parrish|First Floor|1998;Mr. Fingers|Cerebral Hemispheres|2018;St Germain|Tourist|2000'],
  ['frenchhouse', '프렌치 하우스·누디스코', 'elec', '7092247', 'french house|filter house|nu disco|nu-disco|space disco|cosmic disco', '필터를 열고 닫는 디스코 샘플의 반복', 'Daft Punk|Homework|1997;Todd Terje|It\'s Album Time|2014;Lindstrøm|Where You Go I Go Too|2008;Air|Moon Safari|1998'],
  ['disco', '디스코·부기', 'soul', '8193233', 'disco|boogie|post-disco|hi-nrg|italo', '현악과 베이스가 춤추는 70년대 말 무도장', 'Chic|Risqué|1979;Cerrone|Supernature|1977;Giorgio Moroder|From Here to Eternity|1977;Change|The Glow of Love|1980'],
  ['synthpop', '초기 신스팝·일렉트로팝', 'elec', '5174243', 'synthpop|synth-pop|electropop|new wave|techno-pop|technopop|minimal synth', '신시사이저와 드럼머신으로 만든 70~80년대 팝', 'Kraftwerk|Trans-Europe Express|1977;Yellow Magic Orchestra|Solid State Survivor|1979;OMD|Architecture & Morality|1981;Heaven 17|Penthouse and Pavement|1981'],
  ['protoelec', '전자음악 선구자', 'elec', '3044281', 'musique concr|electroacoustic|moog|early electronic|radiophonic|tape music', '모그 신스와 테이프로 만든 60~70년대 괴짜 전자음악', 'Mort Garson|Mother Earth\'s Plantasia|1976;Silver Apples|Silver Apples|1968;Bruce Haack|The Electric Lucifer|1970;Raymond Scott|Soothing Sounds for Baby, Vol. 1|1964'],
  ['vapor', '베이퍼웨이브', 'elec', '2263386', 'vaporwave|mallsoft|future funk', '80년대 광고·쇼핑몰 음악을 느리게 늘인 인터넷 음악', 'Macintosh Plus|Floral Shoppe|2011;Saint Pepsi|Hit Vibes|2013;Hiroshi Yoshimura|Green|1986'],
  // ── 힙합
  ['jazzrap', '재즈 랩·붐뱁', 'hiphop', '5276546', 'jazz rap|boom bap|conscious hip hop|east coast hip hop|golden age', '재즈 샘플과 둥근 드럼 위의 90년대 랩', 'A Tribe Called Quest|The Low End Theory|1991;Digable Planets|Reachin\' (A New Refutation of Time and Space)|1993;Gang Starr|Moment of Truth|1998;Pete Rock & C.L. Smooth|Mecca and the Soul Brother|1992'],
  ['beats', '비트 신(인스트 힙합)', 'hiphop', '3384177', 'instrumental hip hop|beat music|beats|wonky|jazzy hip hop|lo-fi beats', '랩 없이 샘플과 비트만으로 노래하는 힙합', 'J Dilla|Donuts|2006;Nujabes|Modal Soul|2005;Madlib|Shades of Blue|2003;Flying Lotus|Los Angeles|2008'],
  ['abstract', '추상 힙합', 'hiphop', '6267567', 'abstract hip hop|experimental hip hop|industrial hip hop|underground hip hop', '꼬인 비트와 빽빽한 말, 실험적인 랩', 'Madvillain|Madvillainy|2004;Death Grips|The Money Store|2012;Aesop Rock|Labor Days|2001;Shabazz Palaces|Black Up|2011'],
  ['grime', '그라임', 'hiphop', '9175565', 'grime|uk drill|uk hip hop', '140bpm 런던 지하철 같은 차가운 랩', 'Dizzee Rascal|Boy in da Corner|2003;Skepta|Konnichiwa|2016;Wiley|Treddin\' on Thin Ice|2004'],
  // ── 소울·펑크
  ['psychsoul', '사이키델릭 소울·펑크', 'soul', '6283652', 'psychedelic soul|p-funk|funk rock|psychedelic funk', '퍼즈 기타와 늘어지는 그루브, 70년대 흑인 음악의 실험', 'Sly & The Family Stone|There\'s a Riot Goin\' On|1971;Funkadelic|Maggot Brain|1971;Shuggie Otis|Inspiration Information|1974;Curtis Mayfield|Super Fly|1972'],
  ['sweetsoul', '스위트 소울·필리 소울', 'soul', '4682832', 'philly soul|philadelphia soul|sweet soul|northern soul|chicago soul', '현악과 팔세토 화음의 달콤한 70년대 소울', 'The Delfonics|La La Means I Love You|1968;The Stylistics|The Stylistics|1971;The O\'Jays|Back Stabbers|1972;Bill Withers|Just As I Am|1971'],
  ['neosoul', '네오 소울', 'soul', '3584747', 'neo soul|neo-soul|alternative r&b', '느슨한 박자와 재즈 화성의 90년대 말 소울', 'D\'Angelo|Voodoo|2000;Erykah Badu|Baduizm|1997;Jill Scott|Who Is Jill Scott? Words and Sounds Vol. 1|2000;Lauryn Hill|The Miseducation of Lauryn Hill|1998'],
  ['gospel', '가스펠 소울', 'soul', '6772921', 'gospel|spirituals', '교회에서 온 목소리와 합창', 'Aretha Franklin|Amazing Grace|1972;The Staple Singers|Be Altitude: Respect Yourself|1972;Mahalia Jackson|Mahalia Jackson Sings the Best-Loved Hymns of Dr. Martin Luther King, Jr.|1968'],
  // ── 재즈
  ['spiritual', '스피리추얼 재즈', 'jazz', '5845362', 'spiritual jazz|cosmic jazz', '기도처럼 길게 뻗는 색소폰과 하프', 'Pharoah Sanders|Karma|1969;Alice Coltrane|Journey in Satchidananda|1971;John Coltrane|A Love Supreme|1965;Kamasi Washington|The Epic|2015'],
  ['hardbop', '하드밥·모달', 'jazz', '5951241', 'hard bop|modal jazz|bebop|post-bop|cool jazz', '50~60년대 블루노트의 뜨거운 콤보 재즈', 'Miles Davis|Kind of Blue|1959;Art Blakey & The Jazz Messengers|Moanin\'|1959;Lee Morgan|The Sidewinder|1964;Herbie Hancock|Maiden Voyage|1965'],
  ['fusion', '재즈 펑크·퓨전', 'jazz', '6675343', 'jazz fusion|jazz-funk|jazz funk|fusion|crossover jazz', '전기 악기와 펑크 그루브를 만난 70년대 재즈', 'Herbie Hancock|Head Hunters|1973;Weather Report|Heavy Weather|1977;Roy Ayers Ubiquity|Everybody Loves the Sunshine|1976;Donald Byrd|Places and Spaces|1975'],
  ['ukjazz', '런던 신재즈', 'jazz', '7774358', 'uk jazz|london jazz|nu jazz|broken beat', '아프로비트·그라임을 먹고 자란 2010년대 런던 재즈', 'Sons of Kemet|Your Queen Is a Reptile|2018;Ezra Collective|You Can\'t Steal My Joy|2019;Yussef Kamaal|Black Focus|2016;Nubya Garcia|Source|2020'],
  ['vocaljazz', '보컬 재즈', 'jazz', '2933920', 'vocal jazz|jazz vocal|torch song|traditional pop', '작은 밴드 앞에서 속삭이는 목소리', 'Billie Holiday|Lady in Satin|1958;Chet Baker|Chet Baker Sings|1954;Ella Fitzgerald & Louis Armstrong|Ella and Louis|1956;Nina Simone|Wild Is the Wind|1966'],
  ['ecm', 'ECM·노르딕 재즈', 'jazz', '2905166', 'ecm|nordic jazz|chamber jazz|scandinavian jazz', '북유럽의 차갑고 넓은 여백, 맑은 녹음', 'Keith Jarrett|The Köln Concert|1975;Jan Garbarek|Dis|1977;Esbjörn Svensson Trio|Seven Days of Falling|2003;Tomasz Stańko Quartet|Lontano|2006'],
  ['freejazz', '프리·아방 재즈', 'jazz', '7934392', 'free jazz|avant-garde jazz|avant jazz|free improvisation', '박자와 화성의 틀을 깨는 즉흥', 'Ornette Coleman|The Shape of Jazz to Come|1959;Charles Mingus|The Black Saint and the Sinner Lady|1963;Sun Ra|Lanquidity|1978;Albert Ayler Trio|Spiritual Unity|1965'],
  // ── 포크
  ['britfolk', '브리티시 포크', 'folk', '2914822', 'british folk|folk rock|english folk|psych folk|acid folk|celtic', '영국 민요를 다시 부른 60~70년대 포크', 'Nick Drake|Pink Moon|1972;Pentangle|Basket of Light|1969;Fairport Convention|Liege & Lief|1969;Vashti Bunyan|Just Another Diamond Day|1970'],
  ['primitive', '아메리칸 프리미티브 기타', 'folk', '2915091', 'american primitive|fingerstyle|acoustic guitar|solo guitar', '기타 한 대로 연주하는 블루스와 찬송의 풍경', 'John Fahey|The Transfiguration of Blind Joe Death|1965;Leo Kottke|6- and 12-String Guitar|1969;Robbie Basho|Venus in Cancer|1969'],
  ['freakfolk', '프릭 포크', 'folk', '3924673', 'freak folk|new weird america|anti-folk|psychedelic folk', '동화처럼 이상한 목소리와 낯선 악기', 'Joanna Newsom|Ys|2006;Devendra Banhart|Rejoicing in the Hands|2004;The Incredible String Band|The 5000 Spirits or the Layers of the Onion|1967'],
  ['bluegrass', '블루그래스', 'roots', '7962827', 'bluegrass|newgrass|old-time|appalachian', '밴조·만돌린·피들이 내달리는 산골 현악', 'Punch Brothers|The Phosphorescent Blues|2015;Billy Strings|Home|2019;Alison Krauss & Union Station|So Long So Wrong|1997'],
  ['outlaw', '아웃로·코즈믹 컨트리', 'roots', '4823832', 'outlaw country|cosmic country|alt-country|americana|country rock|honky tonk', '반골 기질의 70년대 컨트리와 그 후예', 'Willie Nelson|Red Headed Stranger|1975;Gram Parsons|GP|1973;Townes Van Zandt|Townes Van Zandt|1969;Sturgill Simpson|Metamodern Sounds in Country Music|2014'],
  ['hillblues', '델타·힐컨트리 블루스', 'roots', '5966822', 'delta blues|hill country blues|country blues|chicago blues|electric blues|^blues$', '한 코드로 끝없이 흔드는 미시시피 블루스', 'R.L. Burnside|Too Bad Jim|1994;Junior Kimbrough|All Night Long|1992;Robert Johnson|King of the Delta Blues Singers|1961;Muddy Waters|Folk Singer|1964'],
  // ── 메탈
  ['postmetal', '포스트메탈·드론 메탈', 'metal', '6507377', 'post-metal|drone metal|doom metal|atmospheric sludge', '느리고 거대한 소리의 파도', 'Isis|Panopticon|2004;Boris|Pink|2005;Sunn O)))|Monoliths & Dimensions|2009;Neurosis|Through Silver in Blood|1996'],
  ['blackgaze', '블랙게이즈', 'metal', '9518578', 'blackgaze|atmospheric black metal|post-black|black metal', '블랙메탈의 속도에 슈게이즈의 빛', 'Deafheaven|Sunbather|2013;Alcest|Souvenirs d\'un autre monde|2007;Wolves in the Throne Room|Two Hunters|2007'],
  // ── 레게
  ['dub', '루츠 레게·덥', 'reggae', '3392175', 'dub|roots reggae|rocksteady|ska\\b|lovers rock|reggae', '에코와 베이스로 공간을 만드는 자메이카 소리', 'Lee "Scratch" Perry & The Upsetters|Super Ape|1976;Augustus Pablo|King Tubbys Meets Rockers Uptown|1976;The Congos|Heart of the Congos|1977;Burning Spear|Marcus Garvey|1975'],
  // ── 현대음악
  ['minimal', '미니멀리즘', 'classical', '2803183', 'minimalism|minimal music|holy minimalism|post-minimalism', '작은 무늬를 조금씩 바꾸며 반복', 'Steve Reich|Music for 18 Musicians|1978;Philip Glass|Glassworks|1982;Terry Riley|A Rainbow in Curved Air|1969;Arvo Pärt|Tabula Rasa|1984'],
  ['neoclass', '모던 클래식·포스트클래시컬', 'classical', '1806078', 'neoclassical|modern classical|post-classical|contemporary classical|chamber', '피아노와 현악, 영화 같은 정적', 'Max Richter|The Blue Notebooks|2004;Jóhann Jóhannsson|Orphée|2016;Nils Frahm|Spaces|2013;Ólafur Arnalds|re:member|2018'],
  // ── 브라질
  ['tropicalia', '트로피칼리아', 'brazil', '6644653', 'tropic[aá]lia|brazilian psychedelia', '록·삼바·전위를 섞은 60년대 말 브라질의 반란', 'Os Mutantes|Os Mutantes|1968;Caetano Veloso|Caetano Veloso|1968;Gal Costa|Gal Costa|1969;Tom Zé|Estudando o Samba|1976'],
  ['mpb', 'MPB', 'brazil', '3843832', '\\bmpb\\b|clube da esquina|musica popular brasileira|samba', '브라질 대중가요의 정점, 풍성한 화성', 'Milton Nascimento|Clube da Esquina|1972;Elis Regina|Elis & Tom|1974;Chico Buarque|Construção|1971;Jorge Ben|A Tábua de Esmeralda|1974'],
  ['bossa', '보사노바', 'brazil', '1872820', 'bossa nova|bossa', '속삭이는 목소리와 나일론 기타의 리듬', 'João Gilberto|Chega de Saudade|1959;Stan Getz|Getz/Gilberto|1964;Marcos Valle|Samba \'68|1968;Astrud Gilberto|The Astrud Gilberto Album|1965'],
  ['brfunk', '브라질 소울·펑크', 'brazil', '6682642', 'brazilian funk|brazilian soul|samba soul|samba-rock|brazilian jazz', '70년대 리우의 소울, 현악과 퍼커션', 'Tim Maia|Racional, Vol. 1|1975;Arthur Verocai|Arthur Verocai|1972;Azymuth|Light as a Feather|1979;Marcos Valle|Previsão do Tempo|1973'],
  // ── 라틴
  ['salsa', '살사·부갈루', 'latin', '8873733', 'salsa|boogaloo|bugalu|latin soul|son cubano|latin jazz|mambo|cuban', '뉴욕 라티노의 관악과 퍼커션 폭발', 'Willie Colón|El Malo|1967;Joe Bataan|Riot!|1968;Rubén Blades|Siembra|1978;Buena Vista Social Club|Buena Vista Social Club|1997'],
  ['cumbia', '쿰비아·안데스 사이키', 'latin', '6782563', 'cumbia|chicha|digital cumbia|champeta|vallenato', '콜롬비아 해안의 걷는 리듬, 페루의 사이키 기타', 'Totó la Momposina|La Candela Viva|1993;Bomba Estéreo|Amanecer|2015;Chancha Vía Circuito|Amansara|2014;Meridian Brothers|¿Dónde Estás María?|2014'],
  ['nueva', '누에바 칸시온', 'latin', '2814930', 'nueva canci[oó]n|nueva trova|andean|chilean folk|argentine folk', '기타 한 대로 부르는 남미의 노래와 시', 'Mercedes Sosa|Mujeres Argentinas|1969;Violeta Parra|Las Últimas Composiciones|1966;Silvio Rodríguez|Días y Flores|1975;Víctor Jara|Te Recuerdo Amanda|1971'],
  ['tango', '탱고 누에보', 'latin', '5933263', 'tango|nuevo tango|bandoneon', '반도네온이 끌고 가는 긴장과 슬픔', 'Astor Piazzolla|Tango: Zero Hour|1986;Gotan Project|La Revancha del Tango|2001;Bajofondo|Bajofondo Tango Club|2002'],
  // ── 아프리카
  ['ethiojazz', '에티오 재즈', 'africa', '5675442', 'ethio|ethiopian|ethiopiques|éthiopiques', '아디스아바바의 다섯 음계와 비브라폰', 'Mulatu Astatke|Mulatu of Ethiopia|1972;Mahmoud Ahmed|Éthiopiques, Vol. 7: Erè Mèla Mèla|1999;Hailu Mergia & The Walias|Tche Belew|1977;Mulatu Astatke|Inspiration Information|2009'],
  ['afrobeat', '아프로비트', 'africa', '8885453', 'afrobeat|afro-funk|afro funk|afro-jazz', '라고스의 긴 그루브와 관악, 저항의 노래', 'Fela Kuti|Expensive Shit|1975;Fela Kuti|Zombie|1977;Ebo Taylor|Love and Death|2010;Tony Allen|Black Voices|1999'],
  ['highlife', '하이라이프', 'africa', '6873733', 'highlife|palm-wine|burger-highlife', '가나의 밝은 기타와 관악, 춤추는 행진', 'Ata Kak|Obaa Sima|2015;Pat Thomas|Pat Thomas & Kwashibu Area Band|2015;K. Frimpong|K. Frimpong & His Cubano Fiestas|1976'],
  ['zamrock', '잠록', 'africa', '8553552', 'zamrock|zambian', '70년대 잠비아의 퍼즈 기타 록', 'WITCH|Lazy Bones!!|1975;Amanaz|Africa|1975;Ngozi Family|45,000 Volts|1977'],
  ['desert', '사막 블루스', 'africa', '6764643', 'desert blues|tuareg|tishoumaren|assouf|malian|mali', '사하라 투아레그의 돌고 도는 기타', 'Tinariwen|Tassili|2011;Mdou Moctar|Afrique Victime|2021;Bombino|Agadez|2011;Ali Farka Touré|Talking Timbuktu|1994'],
  ['mande', '만데·코라', 'africa', '2954631', 'kora|mande|griot|wassoulou|senegal|mbalax', '서아프리카 그리오의 하프 코라와 노래', 'Ali Farka Touré|In the Heart of the Moon|2005;Amadou & Mariam|Dimanche à Bamako|2004;Oumou Sangaré|Mogoya|2017;Toumani Diabaté|Kaira|1988'],
  ['safrica', '남아공 재즈·음바카냐', 'africa', '6873622', 'mbaqanga|south african jazz|township|kwela|maskanda|amapiano', '타운십의 흥겨운 베이스와 합창', 'Hugh Masekela|Home Is Where the Music Is|1972;Mahlathini and the Mahotella Queens|Thokozile|1987;Abdullah Ibrahim|Mannenberg - \'Is Where It\'s Happening\'|1974'],
  ['morna', '모르나(카보베르데)', 'africa', '2873820', 'morna|coladeira|cape verde|cabo verde', '바다 건너온 그리움, 맨발의 디바', 'Cesária Évora|Miss Perfumado|1992;Cesária Évora|Café Atlântico|1999'],
  // ── 중동·남아시아
  ['anatolian', '아나톨리아 록', 'mena', '6662652', 'anatolian|turkish psych|turkish rock|turkish folk', '사즈와 퍼즈 기타가 만난 70년대 터키', 'Erkin Koray|Elektronik Türküler|1974;Selda Bağcan|Selda|1976;Barış Manço|2023|1975;Altın Gün|Gece|2019'],
  ['maghreb', '라이·마그레브', 'mena', '7863742', '\\bra[iï]\\b|maghreb|algerian|gnawa|gnaoua|chaabi|nubian|arabic', '알제리·모로코의 떨리는 목소리와 춤', 'Khaled|Khaled|1992;Rachid Taha|Diwân|1998;Hamza El Din|Escalay (The Water Wheel)|1971'],
  ['qawwali', '카왈리', 'mena', '6865962', 'qawwali|sufi', '수피의 황홀경으로 치닫는 파키스탄 성가', 'Nusrat Fateh Ali Khan|Shahen-Shah|1989;Nusrat Fateh Ali Khan|Mustt Mustt|1990'],
  ['raga', '인도 라가·인도 사이키', 'mena', '4766472', 'raga|hindustani|carnatic|indian classical|sitar|bollywood|filmi', '시타르와 타블라, 끝없이 펼쳐지는 선율', 'Ananda Shankar|Ananda Shankar|1970;Ravi Shankar|Three Ragas|1956;Charanjit Singh|Synthesizing: Ten Ragas to a Disco Beat|1982'],
  ['persian', '이란 70년대 팝', 'mena', '5663742', 'persian|iranian', '혁명 전 테헤란의 퍼즈 기타와 노래', 'Kourosh Yaghmaei|Back from the Brink: Pre-Revolution Psychedelic Rock from Iran 1973-1979|2011;Googoosh|Googoosh|1975'],
  // ── 아시아
  ['citypop', '시티팝', 'asia', '5182854', 'city pop|citypop|kayokyoku|kayōkyoku|showa', '버블 시대 도쿄의 매끈한 밤 드라이브', 'Tatsuro Yamashita|For You|1982;Taeko Onuki|Sunshower|1977;Mariya Takeuchi|Variety|1984;Anri|Timely!!|1983'],
  ['shibuya', '시부야계', 'asia', '6382765', 'shibuya-kei|shibuya kei', '샘플과 라운지, 프렌치 팝을 오려 붙인 90년대 도쿄', 'Cornelius|Fantasma|1997;Pizzicato Five|Made in USA|1994;Flipper\'s Guitar|Doctor Head\'s World Tower|1991'],
  ['jfolk', '일본 70년대 포크록', 'asia', '3814831', 'japanese folk|japanese rock|happy end|new music', '일본어로 록을 처음 부른 밴드들', 'Happy End|Kazemachi Roman|1971;Haruomi Hosono|Hosono House|1973;Haruomi Hosono|Tropical Dandy|1975'],
  ['jjazz', '와재즈', 'asia', '3945242', 'japanese jazz|j-jazz|wajazz', '70년대 일본 재즈의 정갈한 피아노 트리오', 'Ryo Fukui|Scenery|1976;Ryo Fukui|Mellow Dream|1977;Takeshi Terauchi|Let\'s Go Classics|1967'],
  ['molam', '태국 몰람·루크퉁', 'asia', '7873642', 'mor lam|molam|luk thung|thai|cambodian|khmer', '태국 이산의 피리 켄과 퍼즈 기타의 춤', 'Paradise Bangkok Molam International Band|21st Century Molam|2014;Khruangbin|The Universe Smiles Upon You|2015;Dengue Fever|Escape from Dragon House|2005'],
  ['throat', '투바·몽골 목노래', 'asia', '6847681', 'throat singing|tuvan|mongolian|khoomei', '한 목에서 두 음이 나는 초원의 노래', 'The HU|The Gereg|2019;Huun-Huur-Tu|60 Horses in My Herd|1993'],
  // ── 유럽
  ['chanson', '프렌치 팝·샹송', 'europe', '3635731', 'chanson|ye-ye|yé-yé|french pop|variété|nouvelle chanson', '속삭이는 프랑스어와 60~70년대 편곡', 'Serge Gainsbourg|Histoire de Melody Nelson|1971;Françoise Hardy|Tous les garçons et les filles|1962;Brigitte Fontaine|Comme à la radio|1969;Michel Polnareff|Polnareff\'s|1971'],
  ['italia', '이탈리아 칸타우토레', 'europe', '4744742', 'cantautor|canzone|italian|musica leggera', '이탈리아 싱어송라이터의 서정과 실험', 'Lucio Battisti|Anima latina|1974;Fabrizio De André|Crêuza de mä|1984;Franco Battiato|La voce del padrone|1981'],
  ['fado', '파두', 'europe', '1983930', 'fado', '포르투갈 기타와 운명을 노래하는 목소리', 'Amália Rodrigues|Busto|1962;Mariza|Fado em Mim|2001;Ana Moura|Casa Guilhermina|2022'],
  ['flamenco', '플라멩코', 'europe', '7864853', 'flamenco|rumba catalana|nuevo flamenco|spanish', '손뼉과 기타, 찢어지는 노래', 'Camarón de la Isla|La Leyenda del Tiempo|1979;Paco de Lucía|Almoraima|1976;Rosalía|El Mal Querer|2018;Rosalía|Los Ángeles|2017'],
  ['balkan', '발칸 브라스·집시', 'europe', '9873562', 'balkan|gypsy|romani|klezmer|brass band|gypsy jazz|manouche', '숨 가쁜 관악대와 홀수 박자', 'Fanfare Ciocărlia|Iag Bari|2001;Beirut|Gulag Orkestar|2006;Django Reinhardt|Djangology|1961'],
  // ── 한국
  ['kpsych', '한국 70년대 사이키·그룹사운드', 'korea', '6754542', 'korean psych|korean rock|group sound|그룹사운드|신중현', '신중현과 그 주변, 퍼즈 기타의 70년대 서울', '신중현과 엽전들|신중현과 엽전들|1974;김정미|Now|1973;산울림|아니 벌써|1977'],
  ['kfolk', '한국 포크·언더그라운드', 'korea', '2813921', 'korean folk|한국 포크|통기타|underground korean', '70~80년대 통기타와 시처럼 쓴 노래', '김민기|김민기|1971;들국화|들국화|1985;어떤날|어떤날 1960·1965|1986;시인과 촌장|푸른 돛|1986'],
  ['gugak', '국악 퓨전', 'korea', '7865575', 'gugak|korean traditional|pansori|판소리|국악|sanjo', '판소리·가야금·거문고를 밴드 소리로', '이날치|수궁가|2020;잠비나이|A Hermitage|2016;Black String|Mask Dance|2016;씽씽|Sing Sing|2017'],
  // ── 집(추천지로 쓰지 않음): 흔한 장르를 받아 둔다
  ['kpop', '*K-팝', 'korea', '7380589', 'k-pop|kpop|korean pop|k-pop girl group|k-pop boy group|케이팝', '', ''],
  ['kballad', '*한국 발라드', 'korea', '2504818', 'korean ballad|k-ballad|발라드|ballad', '', ''],
  ['kindie', '*한국 인디', 'korea', '5544648', 'k-indie|korean indie|k-rock|korean r&b|k-r&b|k-hip hop|korean hip hop|k-rap|korean|k-', '', ''],
  ['jpop', '*J-팝·애니송', 'asia', '7360688', 'j-pop|jpop|j-rock|anime|vocaloid|japanese|j-', '', ''],
  ['pop', '*팝', 'pop', '6370688', 'pop|dance pop|electropop|teen pop|bedroom pop|indie pop|singer-songwriter|soft pop', '', ''],
  ['classicrock', '*클래식 록', 'rock', '7633531', 'classic rock|hard rock|blues rock|album rock|heavy metal|metal|rock and roll', '', ''],
  ['indierock', '*인디·얼터너티브 록', 'rock', '6634567', 'indie rock|alternative rock|alt rock|modern rock|indie|alternative|britpop|grunge|emo|pop punk|punk|rock', '', ''],
  ['rnb', '*R&B', 'soul', '4473878', 'r&b|rnb|contemporary r&b|urban contemporary|soul|funk|motown', '', ''],
  ['hiphop', '*힙합', 'hiphop', '7276678', 'hip hop|hip-hop|rap|trap|drill|cloud rap|plugg|melodic rap', '', ''],
  ['edm', '*EDM·클럽', 'elec', '8070478', 'edm|electro house|big room|progressive house|future bass|electronic|dance|house|electronica|lo-fi', '', ''],
  ['jazz', '*재즈', 'jazz', '4933343', 'jazz|swing|big band', '', ''],
  ['folk', '*포크', 'folk', '2913724', 'folk|acoustic|country|bluegrass', '', ''],
  ['classical', '*클래식', 'classical', '2905034', 'classical|orchestra|opera|piano|baroque|romantic era|soundtrack|score|ost', '', ''],
  ['latin', '*라틴 팝', 'latin', '8272778', 'latin|reggaeton|urbano|bachata|latin pop|mexican', '', ''],
];

const dig = (c) => Number(c) / 9;
export const GENRES = RAW.map(([id, name, fam, tr, kw, desc, seeds]) => ({
  id, name: name.replace(/^\*/, ''), home: name.startsWith('*'), fam, world: WORLD.has(fam),
  tr: [...tr].map(dig), kw: new RegExp(kw, 'i'), desc,
  seeds: seeds ? seeds.split(';').map((s) => { const [artist, album, year] = s.split('|'); return { artist, album, year: +year || 0 }; }) : [],
}));
export const BY_ID = Object.fromEntries(GENRES.map((g) => [g.id, g]));
