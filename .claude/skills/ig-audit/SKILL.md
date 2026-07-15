---
name: ig-audit
description: 혼술맵 가게 인스타 핸들 전수 감사 + 프랜차이즈 누락 지점 발굴·등록. "인스타 감사", "핸들 검증해", "지점 찾아서 추가해", "IG 계정 확인" 류 요청에 사용.
---

# 혼술맵 인스타 전수 감사

목표: spots 테이블의 바 전체 IG 핸들 검증 + 프차 브랜드별 누락 지점 발굴·등록 + `docs/bars-franchise-list.md` 갱신.

## 철칙 (어기면 사고남 — 실제 사고 이력 있음)

1. **핸들 패턴 추측으로 DB에 쓰지 마라.** 실제 핸들은 변형이 많다: `9.jeju13`(점), `9__jeju38`(밑줄 2개), `9___jeju51`(밑줄 3개), `yahwabar_dasan`(브랜드 표기 `yahwa.bar_`에서 점 빠짐), `junseok2ok`(개인계정형인데 실제 지점 계정), `jeju_jajac3_izakaya`(접미사).
2. **DB에 쓰기 전 전건 프로필 실확인.** `scripts/_ig_bio.py handle1 handle2 ...` — og:title에 프로필 제목이 나온다. 지점명과 일치해야 통과. **30초 타임아웃 = 죽은/없는 계정**이다 (죽은 계정은 로그인월로 넘어가 og:title이 없음).
3. **스팟 삭제는 무조건 형 컨펌.** 삭제 전 딸린 데이터(stories·spot_claims·chat_rooms·benefits 카운트)를 보여주고 승인받아라. 중복처럼 보여도 사장 클레임이 붙은 행일 수 있다.
4. 스크래핑 부하는 신경 쓰지 마라 (형 지시).

## 발굴 경로 (우선순위순)

1. **로그인된 인스타 검색** (가장 강력 — false negative 없음): 형 브라우저의 로그인 세션이나 sessionid 쿠키를 요청해서 써라. 검색창에 브랜드명을 치면 지점 계정이 다 나오고, 본사 계정 팔로잉 목록에서도 지점을 수집할 수 있다. 비로그인은 검색 API가 429로 막힌다.
2. **네이버 플레이스 스윕**: `scripts/_naver_place_sns.py "브랜드명" "브랜드명 지역" ...` — 플레이스 검색(쿼리당 최대 20곳) 후 각 플레이스 상세에서 가게가 직접 걸어둔 IG 링크를 추출. 이름·주소·좌표·place_id·IG를 한 번에 얻는다. **데스크톱 UA 필수** (스크립트에 이미 설정돼 있음 — 모바일 UA로 바꾸면 검색 0건).
3. 구글/웹 검색: 보조용. 지점 존재 여부 확인엔 좋지만 핸들 확정엔 부족.

## 브랜드 목록 (검색어)

제주아홉(9_jeju·9.jeju·9__jeju 계열), 야화(yahwa.bar_·yahwabar_), 헤르츠(hertzbar_), 제주연(jeju_ye0n_), 블렌딩바(blending_bar), 고도(godo_), 곁/제주곁(gyut), 미열(miyeol_), 내잔(naejan_), 도란(doran_), 오내(onae_), 지문인식(jimuninsik_), 서울림(seoulrim), 될대로(ehlfeofh_), 자유의지(freewill.), 엮은이(the_editor_), 자작(jeju_jajac), 43번지(43st_), 유사길(yusagil_), 헌집(old.house_jeju), 혼술바제비(bar_jebi), 제주보름(jejumoon_), 날걷(nalgeod_)

## DB 조회·등록

- 조회/쓰기 스크립트는 `scripts/` 안에 만들고 `npx tsx`로 실행 (dotenv로 `.env.local` 로드 → `SUPABASE_SERVICE_ROLE_KEY`). `/tmp`에 만들면 node_modules 못 찾는다.
- 등록 upsert 패턴: `sb.from('spots').upsert({ name, slug, instagram_id, region, city, address, lat, lng, naver_place_id, category: 'bar' }, { onConflict: 'slug' })`
- 주소·좌표·place_id는 네이버 플레이스 실데이터만 사용. 근사치를 쓸 수밖에 없으면 address에 명시하고 문서 미해결에 남겨라.
- region 코드가 없는 지역이면: `src/lib/types.ts` 3곳(Region 유니온·REGIONS·VALID_REGIONS)에 추가 + `src/data/migrations/2026-07-13_more_regions.sql` 패턴으로 전체 목록 재생성 SQL 작성 → **SQL은 형이 Supabase SQL Editor에서 직접 실행** (CLI 링크 없음). SQL 실행 전엔 해당 지역 등록 불가.
- 일회성 스크립트는 실행 후 삭제. 재사용 가치 있는 것만 남긴다.

## 마무리

1. `docs/bars-franchise-list.md` 갱신 — 헤더 카운트(총·브랜드·지점·단독), 브랜드 표, 지점 상세, 변경 이력, 미해결 섹션. **현재 미해결 목록은 이 문서의 "미해결 (보류 중)" 섹션이 단일 소스다 — 스킬에 하드코딩하지 말 것.**
2. 결과 보고: 신규 등록 N곳(근거 포함), 핸들 교정 N건, 미해결 잔여. 등록 근거(플레이스 링크 + og:title)를 명시해서 형이 검증 방법을 확인할 수 있게.
