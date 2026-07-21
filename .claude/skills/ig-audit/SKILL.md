---
name: ig-audit
description: 혼술맵 가게 인스타 핸들 전수 감사 + 프랜차이즈 누락 지점 발굴·등록. "인스타 감사", "핸들 검증해", "지점 찾아서 추가해", "IG 계정 확인" 류 요청에 사용.
---

# 혼술맵 인스타 전수 감사 · 지점 발굴 파이프라인

목표: spots(바) 전체 IG 핸들 검증 + 프차 브랜드별 누락 지점 발굴·등록 + `docs/bars-franchise-list.md` 갱신.
**전 과정 로그인·유료 API 없이 무료로 된다** (2026-07 야화/제주아홉 대확장에서 검증). 유료(HikerAPI)는 잔여분 보험일 뿐.

## 철칙 (어기면 사고남 — 실제 사고 이력)

1. **핸들 패턴 추측으로 DB에 쓰지 마라.** 변형이 많다: `9.jeju13`(점), `9__jeju38`(밑줄2), `9___jeju51`(밑줄3), `yahwabar_dasan`(`yahwa.bar_`에서 점 빠짐), `junseok2ok`(개인계정형인데 실제 지점), `jeju_jajac3_izakaya`(접미사).
2. **신뢰 소스 구분** — 등록해도 되는 것 vs 안 되는 것:
   - ✅ **가게가 직접 등록한 링크** = 네이버 플레이스 상세의 IG 링크, 공식 홈페이지의 지점 IG → 이건 추측이 아니라 가게 본인이 밝힌 것. 등록 가능.
   - ✅ **og:title/풀네임이 지점명과 일치** = 확정.
   - ❌ **패턴 추측·구글 스니펫만** = DB 쓰기 전 반드시 프로필 실확인.
3. **스팟 삭제는 무조건 형 컨펌.** 삭제 전 딸린 데이터(stories·spot_claims·chat_rooms·benefits 카운트)를 보여주고 승인받아라. 중복처럼 보여도 사장 클레임이 붙은 행일 수 있다(헤르츠 사고).
4. 스크래핑 부하는 신경 쓰지 마라 (형 지시).

## 파이프라인

### 1단계 · 발굴 (지점 + 핸들 찾기) — 무료 경로, 위→아래 순

1. **공식 홈페이지 / 바이오링크 명부** ⭐가장 효율적(대형 프차): 알려진 본사 핸들 하나의 `external_url`(바이오 링크)을 web_profile_info로 얻어 → 그 사이트의 "매장찾기"를 `WebFetch`로 긁으면 전 지점이 주소까지 한 번에. (야화 `yahwabar.com` → 37지점)
2. **네이버 플레이스 스윕** ⭐좌표·place_id 확보: `worker_venv/Scripts/python.exe scripts/_naver_place_sns.py "브랜드명" "브랜드명 지역" ...` → 지점명·주소·좌표·place_id + 가게가 직접 걸어둔 IG 링크. **데스크톱 UA 필수**(스크립트에 설정됨, 모바일 UA면 0건). 쿼리당 최대 20곳이라 지역별로 나눠 던져라("브랜드 서울" "브랜드 경기" "브랜드 부산").
3. **구글 도킹** (한글 브랜드 발굴 최적): `WebSearch`로 `site:instagram.com "브랜드명" 지역`. 네이버에 IG 안 걸어둔 지점의 핸들을 검색엔진 색인에서 잡는다.
4. **연관계정(추천) 그래프**: web_profile_info의 `edge_related_profiles` → 인스타 *알고리즘 추천* ~20개(자매/유사 혼술바, 크로스브랜드 노이즈). 본사가 실제 팔로우한 게 아니라 정확도 낮음, 익명 가능. 미등록 가게 발굴 보조용.
5. **본사 팔로잉 목록** = 가장 정확(본사가 실제 팔로우 = 대부분 자기 지점, 노이즈 없음) **but 로그인 필수**. 익명은 `api/v1/friendships/{uid}/following/` → **401 `require_login`**(2026-07-17 실측). 형 sessionid 쿠키를 받으면 `credentials:'include'`로 본사 팔로잉 전량 취득 → false-negative 0. IG 검색창도 동일(로그인 필요).

### 2단계 · 검증 (DB 쓰기 전 필수)

- **HTML 프로필 페이지로 검증** (스로틀 안전): `scripts/_ig_bio.py handle1 handle2 ...` → `https://www.instagram.com/{h}/`의 og:title. "가게명(@handle) • Instagram" 나오면 실계정, 지점명 일치 확인. 30초 타임아웃/로그인월 = 죽은 계정.
- **web_profile_info JSON API**(bio·external_url·프사·연관계정 필요할 때): `https://www.instagram.com/api/v1/users/web_profile_info/?username=X` + 헤더 `x-ig-app-id: 936619743392459`. 익명 200. **단 ~6~9회 연속 호출 후 401 스로틀** → 브라우저 새로 열거나 시간 두고 재개. HTML 페이지(og:title/og:image)는 401 와중에도 200이니 검증·프사는 그쪽으로.
- ⚠️ **401은 IP밴 아님** — 프로필 페이지는 계속 200. 세션단위 스로틀일 뿐, 형 계정/집IP 무관. (로그인 스크래핑이 아니라 안전)

### 3단계 · 등록 (DB)

- 스크립트는 `scripts/_*.ts`에 만들고 `npx tsx`로 실행 (dotenv `.env.local` → `SUPABASE_SERVICE_ROLE_KEY`). `/tmp`는 node_modules 못 찾음.
- upsert: `sb.from('spots').upsert({ name, slug, instagram_id, region, city, address, lat, lng, naver_place_id, category:'bar' }, { onConflict:'slug' })`. 공유계정(본사 핸들만 있는 지점)은 그대로 넣되 중복 핸들 감안, IG 없으면 `instagram_id:null`.
- 주소·좌표·place_id는 **네이버 플레이스 실데이터만**. 근사치면 address에 명시 + 문서 미해결에 남겨라.
- **지역코드 없으면**: `src/lib/types.ts`(Region 유니온·REGIONS·VALID_REGIONS, 새 city면 City·CITIES·VALID_CITIES도) + `MapClient.tsx`의 `CITY_CENTER`(새 city 시) 추가 → 최신 마이그레이션 패턴(`2026-07-16_siheung_gwangju.sql`: city_check + region_check 전체 재생성) SQL 작성 → **SQL은 형이 Supabase SQL Editor에서 실행**(CLI 없음). 실행 전 그 지역 등록 불가. tsc로 exhaustive 맵 누락 확인.
- 일회성 스크립트는 실행 후 삭제. 재사용 툴만 남긴다.

### 4단계 · 프사 마커 (선택)

- web_profile_info의 `profile_pic_url_hd` **또는** HTML 페이지 og:image → 이미지 다운로드 → Supabase Storage(`spot-avatars`, 스크립트가 자동 생성) 업로드 → `spots.avatar_url` 갱신. IG CDN URL은 만료되므로 바이트를 우리가 보관.
- 툴: `scripts/_populate_avatars.py [개수|all]`. ⚠️ 현재 JSON API를 써서 ~6곳 후 401 → **og:image(HTML) 방식으로 바꾸면 스로틀 없이 전량 가능**. 마커는 avatar_url 있으면 원에 표시, 없으면 기본 아이콘 폴백(구현됨).

### 5단계 · 마무리

1. `docs/bars-franchise-list.md` 갱신 — 헤더 카운트, 브랜드 표, 지점 상세, 변경 이력, **미해결 섹션(이 문서가 미해결의 단일 소스 — 스킬에 하드코딩 금지)**.
2. 결과 보고: 신규 N곳(등록 근거=플레이스 링크/og:title 명시), 핸들 교정 N건, 미해결 잔여.

## 브랜드 목록 (검색어 · 핸들 계열)

제주아홉(9_jeju·9.jeju·9__jeju), 야화(yahwa.bar_·yahwabar_), 헤르츠(hertzbar_), 제주연(jeju_ye0n_), 블렌딩바(blending_bar), 고도(godo_), 곁/제주곁(gyut), 미열(miyeol_), 내잔(naejan_), 도란(doran_), 오내(onae_), 지문인식(jimuninsik_), 서울림(seoulrim), 될대로(ehlfeofh_), 자유의지(freewill.), 엮은이(the_editor_), 자작(jeju_jajac), 43번지(43st_), 유사길(yusagil_), 헌집(old.house_jeju), 혼술바제비(bar_jebi), 제주보름(jejumoon_), 날걷(nalgeod_)

## 툴킷 (scripts/)

- `_naver_place_sns.py "브랜드" "브랜드 지역"` — 네이버 지점+IG링크+좌표+place_id (데스크톱 UA)
- `_ig_bio.py h1 h2 …` — og:title 실계정 검증(+bio·@멘션)
- `_probe_naver.py "쿼리" …` — 네이버 후보 원본 덤프(주소/좌표/id)
- `resync_one.py <slug>` — 단건 스팟 네이버 지오코딩(좌표 갱신)
- `_populate_avatars.py [개수|all]` — 프사 → Storage → avatar_url (og:image 전환 권장)
- 관련 메모리: `ig-handle-discovery.md`
