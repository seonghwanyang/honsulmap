---
name: discover-bars
description: 특정 지역(대전·수원·인천 등)의 신규 혼술바를 네이버로 전수 발굴 → DB 중복 제외 → 순수 혼술바만 등록. "OO지역 혼술바 찾아 넣어", "지역 발굴", "대전 혼술바 등록" 류 요청에 사용. 프차 핸들 감사는 ig-audit 스킬.
---

# 지역 신규 혼술바 발굴·등록

목표: 지정 지역의 혼술바를 네이버로 전수 스윕 → **DB에 이미 있는 곳 제외** → **순수 혼술바만** → 검증 후 등록.

## 핵심 원칙

1. **DB 중복 제외가 최우선** — 이미 등록된 가게(제주아홉 지점 등)를 또 넣으면 안 된다. `discover_new_bars.py`가 naver_place_id·instagram_id로 자동 대조해 신규만 출력한다. 절대 이 dedup을 건너뛰지 마라.
2. **순수 혼술바만** (형 결정 2026-07-22) — 칵테일바·위스키바·오마카세·LP바·클럽·식당 제외. 판정: ① 스윕 결과의 `혼술` 플래그(가게명에 혼술/혼자) ② IG og:title에 "OO혼술바" 명시. 애매하면 제외하고 형에게 회색지대 목록만 따로 보고.
3. **등록 전 형 승인** — 신규 순수혼술바 리스트를 먼저 보여주고 OK 받은 뒤 등록.

## 파이프라인

### 1. 발굴 (Haiku 병렬 — 지역/구 단위로 분산)
- 도구: `worker_venv/Scripts/python.exe scripts/discover_new_bars.py "쿼리1" "쿼리2" ...`
  - 네이버 스윕 → 각 플레이스의 IG 링크 추출 → **DB place_id/ig 대조로 신규만** → TSV(name·addr·latlng·place_id·ig·혼술flag) 출력.
- 쿼리는 **구·동 그리드 + 키워드**로: `"{시} 혼술바"`, `"{구} 혼술바"`, `"{동} 혼술바"`, `"{시} 혼술"`. 쿼리당 네이버 최대 20곳이라 동 단위로 쪼갤수록 촘촘.
- **Haiku 서브에이전트 병렬**: 지역이 넓으면 구별로 Haiku 에이전트를 띄워 각자 `discover_new_bars.py`를 자기 구 쿼리로 돌리고 TSV를 반환하게 한다(네이버는 레이트리밋 없어 병렬 안전). 오케스트레이터가 TSV들을 합치고 **place_id로 다시 dedup**(구 경계 중복 제거).
  - 왜 Haiku: 발굴은 스크립트가 팩트를 쥐고(가게명·주소·좌표·IG는 네이버 실데이터) 모델은 취합만 하므로 싼 모델로 충분, 할루시네이션 여지 낮음.

### 2. 필터 (순수 혼술바)
- `혼술` 플래그 있는 행 우선 채택. 플래그 없어도 IG og:title에 "혼술바"면 채택.
- 칵테일/위스키/오마카세/클럽/식당/카페 성격은 제외. 확신 안 서면 "회색지대"로 분리해 형에게 판단 요청(자동 등록 금지).

### 3. 검증 (선택·가벼움)
- IG 링크는 **가게가 네이버에 직접 등록한 것**이라 신뢰도 높음(추측 아님) → 대량 og:title 재검증은 불필요.
- 다만 IG 없는(`-`) 곳, 혼술바 여부 애매한 곳만 `scripts/_ig_bio.py handle` 로 og:title 확인. **익명 조회는 ~6~9회 후 401**(IP밴 아님, ig-audit 참고) → 소량만.

### 4. 등록
- ig-audit 스킬의 "등록" 규칙 그대로: `scripts/_*.ts` upsert(onConflict slug), 좌표·주소·place_id는 스윕 실데이터, 지역코드 없으면 types.ts + 마이그레이션(형이 SQL 실행). IG 없으면 `instagram_id:null`로 넣되(지도 밀도), IG 사냥에 시간 쓰지 말 것.
- 등록 후 `docs/bars-franchise-list.md` 단독 섹션 카운트 갱신, 일회성 스크립트 삭제.

## 지역코드 팁
- 새 구/시가 나오면 `src/lib/types.ts`(Region·REGIONS·VALID_REGIONS, 새 city면 City·CITIES·VALID_CITIES + `MapClient.tsx` CITY_CENTER) 추가 → 최신 마이그레이션 패턴으로 city_check+region_check 전체 재생성 SQL → 형이 Supabase에서 실행. tsc로 누락 확인.
- 대전 예상 신규 구: `daejeon_jung`(중구)·`daejeon_seo`(서구, 기존)·`daejeon_yuseong`(유성, 기존) — 중구만 추가하면 대부분 커버.

## 산출물
- 형에게: **신규 순수혼술바 N곳**(이름·주소·IG) + **회색지대 M곳**(칵테일/위스키 등, 판단요청) + **IG없음 K곳**. 승인 후 등록 → 총 바 수 보고.
