# 스크래퍼 복구 여정 (storysaver Turnstile → storiesig API)

> 2026-06-17~18. IG 스토리 수집이 storysaver.net의 Cloudflare Turnstile로 중단된 걸
> **무료로** 복구하는 과정 기록. dead end 포함 — 같은 길 다시 안 파려고 남긴다.

## 문제
- `worker/scrape_adaptive.py`가 storysaver.net을 Scrapling 스텔스로 긁었는데, storysaver가
  **폼 제출에 Cloudflare Turnstile(임베디드 위젯)**을 걸면서 `stories=0` 지속.
- 원인: Cloudflare/Turnstile 강화 + storysaver가 managed 모드로 전환(`cf_migrate` 흔적).
  Scrapling은 임베디드 위젯을 "진짜로 푸는" 솔버가 없고 쉬운 자동통과에 의존했는데 그게 막힘.

## 시도한 dead end (전부 실패)
1. Scrapling 0.4.7 headless → `turnstile-still-present`, `cf-turnstile-response` 토큰 빈 채
2. Scrapling 0.4.9 업뎃 → `No headers...` 헤더 생성 회귀 버그(아예 못 씀) → 0.4.7로 롤백
3. `solve_cloudflare=True` → `No Cloudflare challenge found` (전면 챌린지 전용, 임베디드 위젯 X)
4. `headless=False`(headful) → 여전히 실패 (+ 우리 IP가 IG밴/반복실패로 평판 저하 추정)
5. **nodriver** (`nodriver_storysaver_test.py`) → 페이지는 더 잘 렌더(473KB)했지만 위젯 못 풂
6. 직접 IG(`src/app/api/cron/scrape`) → **IP 밴** (사용자 확인)
7. 유료 솔버(CapSolver/2captcha) → 사용자 정책상 **제외**

## 돌파구: storiesig API (Turnstile 없음)
경로 추적 순서:
- `storiesig_api_probe.py` → 옛 fabula 경로(`/api/userInfoByUsername`) = **404(폐기됨)**
- `storiesig_discover.py` → 라이브 사이트 JS grep → 현재 prefix **`/api/v1/instagram/`** 발견
- `storiesig_dig.py` → app.js 정밀 분석 → 호스트 **`api-wh.storiesig.info`**, 엔드포인트
  (stories/userInfo/posts), 보호 = 자체 이미지캡차(whToken) + 서명된 body
- `storiesig_browser_test.py` → **WINNER ✅**: 브라우저로 storiesig 구동하면 사이트 JS가
  서명을 알아서 처리 → `/api/v1/instagram/stories` JSON 응답 캡처 성공. **Turnstile/캡차 없음.**

## 채택 방식 (최종)
1. **브라우저(Scrapling)로 `storiesig.info` 구동**, 검색칸에 `https://www.instagram.com/stories/{handle}`
   입력 → 제출. (URL 형태로 넣어야 stories 엔드포인트가 트리거됨)
2. 사이트가 `POST https://api-wh.storiesig.info/api/v1/instagram/stories` (body `{username}`, 서명 포함)
   를 호출 → `page.on("response")`로 그 JSON을 가로챈다.
3. 응답 = **IG 비공개 API 포맷**: `result[].{ pk, taken_at, image_versions2.candidates[].url,
   video_versions[].url, user }`. cdninstagram URL이 raw로 들어있음(우리 데이터 계약 동일).
   (`url_wrapped`/`url_downloadable`은 storiesig 프록시 → 무시, raw `url`만 사용)
4. 매핑은 `src/app/api/cron/scrape/route.ts`의 `fetchStories`를 그대로 미러:
   `pk`→instagram_media_id, `video_versions[0].url`(영상)|`image_versions2.candidates[0].url`(이미지)→media_url,
   `taken_at*1000`→posted_at, +24h→expires_at. → **stories 행 구조 100% 동일.**

## 다음 (TODO)
- [ ] `worker/storiesig_client.py`: 위 fetch+capture+매핑 구현 (print-only 검증 먼저, DB 안전)
- [ ] `worker/scrape_adaptive.py`: storysaver 경로를 storiesig로 교체 (스케줄/upsert 로직은 유지)
- [ ] 죽은 핸들(404 `success:false`) + 활성 스토리 0개 케이스 정상 처리
- [ ] ⚠️ 우리 IP 평판 저하 — storiesig에서도 막히면 다른 네트워크(폰 핫스팟)로 검증

## 스크립트 목록 (보존용 · 실행 가능)
| 파일 | 역할 | 결과 |
|---|---|---|
| `nodriver_storysaver_test.py` | nodriver로 storysaver Turnstile 시도 | dead end |
| `storiesig_api_probe.py` | 옛 api-ig 경로 직접 GET | 404(폐기) |
| `storiesig_discover.py` | 라이브 JS에서 현재 API 경로 발견 | `/api/v1/instagram/` |
| `storiesig_dig.py` | app.js 서명/엔드포인트/호스트 분석 | api-wh + 서명 구조 파악 |
| `storiesig_browser_test.py` | 브라우저 구동 + 응답 캡처 | **WINNER** (stories JSON 획득) |
