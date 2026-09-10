# 혼술맵 CI/CD 파이프라인 점검 보고서

**점검일:** 2026-09-08
**대상:** 웹앱(Next 16 / Vercel) · IG 스크래퍼(worker) · 토스 POS 플러그인 · 모바일 셸(Capacitor) · Supabase 마이그레이션
**방법:** 레포 정적 점검 + `tsc`/`next lint`/`npm audit` 실측 + GitHub API(브랜치 보호·Actions·보안 설정) + Vercel CLI(환경변수·배포 이력)

---

## 0. 한 줄 결론

배포 전에 자동으로 도는 검증은 **Vercel 빌드 성공(= TypeScript 타입체크) 하나**뿐이다.
테스트 0건, 린트는 깨져 있고(Next 16에서 `next lint` 제거), 서버 에러는 어디에도 남지 않으며, 장애·크론·스크래퍼 실패를 알려주는 알림이 없다.
하루 평균 5커밋이 프로덕션에 직행하는 속도(최근 30일 148커밋)에 비해 안전망이 거의 없다.

가장 아픈 증거는 지난주 커밋 `655f41b`다. 8/31 마이그레이션에서 테이블 이름 충돌로 체크인 방문 기록이 **전량 실패했는데 9/7까지 일주일간 아무도 몰랐다.** 마이그레이션 검증 부재 + 에러 수집 부재 + 알림 부재가 한 번에 드러난 사례다.

> **09-10 갱신**: Sentry가 프로덕션에 가동됐다 (`c73f7dc`, main 머지 `389586b`). 점수표 9·10·11번이 바뀌었고, 상세는 10.13·10.18. 테스트·CI·마이그레이션 항목은 아직 그대로다.

---

## 1. 점수표

| # | 영역 | 상태 | 한 줄 |
|---|---|---|---|
| 1 | 비밀정보 보호 (.gitignore, secret scanning) | 🟢 양호 | `.p8`·keystore·session·.env 모두 제외. GitHub secret scanning + push protection ON |
| 2 | 브랜치 보호 / 리뷰 게이트 | 🔴 없음 | main·dev 모두 보호 규칙 없음. 직접 push로 머지 |
| 3 | 빌드 + 타입체크 | 🟢 통과 | `tsc --noEmit` 0 에러. Vercel 빌드가 유일한 게이트 |
| 4 | 린트 | 🔴 깨짐 | `npm run lint` 실행 불가. ESLint 설정 파일 자체가 없음 |
| 5 | 자동 테스트 (웹앱) | 🔴 0건 | 테스트 러너·테스트 파일 없음. 213 파일 / 33,910 라인 / API 70개 |
| 6 | CI 워크플로 | 🔴 없음 | Actions에 수동 실행용 프로브 1개뿐 |
| 7 | 웹 배포 자동화 | 🟢 동작 | Vercel Git 연동. main→Production, dev→Preview, 약 45초 |
| 8 | 프리뷰/스테이징 환경 | 🟡 반쪽 | Preview가 프로덕션 DB + service role 키를 그대로 공유 |
| 9 | 서버 에러 수집 | 🟢 Sentry (09-10) | throw는 자동, 5xx return 92곳은 `serverError()`로 보고. 소스맵은 토큰 등록 후 |
| 10 | 클라이언트 에러 수집 | 🟢 Sentry (09-10) | 브라우저·앱 웹뷰 자동 수집. 터널 경유 수신 확인됨 |
| 11 | 장애/크론/스크래퍼 알림 | 🟡 절반 | Sentry 새 이슈 메일 + `day-close` 크론 모니터 가동. 스크래퍼는 `/api/health/scraper` 배포됨, UptimeRobot 등록만 남음 |
| 12 | 업타임 감시 | 🟡 있음, 점검 필요 | UptimeRobot 모니터가 예전에 등록돼 있음 (09-09 확인). 감시 URL이 `/api/health`인지, 알림 메일이 살아 있는지 점검 |
| 13 | DB 마이그레이션 관리 | 🔴 수동 | SQL 59개를 SQL Editor에서 손으로 실행. 적용 이력 테이블 없음 |
| 14 | 의존성 보안 | 🟡 방치 | `npm audit` 18건(critical 1·high 12). Next 16.2.9에 패치된 취약점 9건. Dependabot OFF |
| 15 | 모바일/플러그인 릴리즈 | 🟡 수동 | iOS는 Codemagic 수동 트리거, Android는 로컬 Gradle, 토스 플러그인은 zip 수동 업로드 |
| 16 | 스크래퍼 운영 | 🟡 무감시 | 갤탭에서 돌지만 감시는 SSH로 로그 tail. 재부팅 시 수동 재시작 |

---

## 2. 현재 파이프라인 지도 (as-is)

```
[로컬 PC] ── git push dev ──▶ [GitHub dev] ──▶ Vercel Preview 자동 배포 (~45s)
                                                  │
                                          사용자가 폰/브라우저로 눈 확인
                                                  │
[로컬 PC] ── git merge dev ── git push main ──▶ [GitHub main] ──▶ Vercel Production 자동 배포 (~45s)
                                                                       │
                                                             롤백 = Vercel 대시보드 수동
```

| 구성요소 | 트리거 | 자동화 | 배포 전 검증 | 실패 감지 |
|---|---|---|---|---|
| 웹앱 (Vercel) | main push | 자동 | 빌드(타입체크)만 | 없음 |
| Vercel cron `day-close` (매일 08:10 KST) | 스케줄 | 자동 | 없음 | 없음 (500 반환만) |
| IG 스크래퍼 (갤탭 Termux, 30초 루프) | 상시 | 자동 | `test_smoke.py` 수동 | SSH 로그 tail 수동 |
| DB 마이그레이션 (`src/data/migrations/*.sql`) | 사람 | 수동 | 없음 | 없음 |
| iOS (Codemagic → TestFlight) | 대시보드 클릭 | 반자동 | 없음 | Codemagic 메일 |
| Android (로컬 Gradle, versionCode 4) | 사람 | 수동 | 없음 | 없음 |
| 토스 POS 플러그인 (webpack → zip → 토스 검수) | 사람 | 수동 | SDK 테스터 수동 | 토스 검수 |

머지 방식: PR #81~#90(8/12~9/1)은 PR로 머지했으나, 그 이후는 `Merge dev` 직접 push로 전환. main에만 있는 머지 커밋 178개. 오늘도 3분·6분·27분 전에 프로덕션 배포가 있었다.

---

## 3. 영역별 상세

### 3.1 소스 관리 · 비밀정보 (🟢 / 🔴)

**잘 된 것**
- `.gitignore`가 촘촘함: `*.p8`, `*.jks`, `session_b64.txt`, `.env*.local`, `.mcp.json`, `client_secret_*.json`. 실제로 tracked 파일 499개 중 비밀 파일 없음.
- GitHub secret scanning + push protection 활성.

**문제**
- **브랜치 보호 없음** (`main`·`dev` 모두 API 404). 빌드가 깨진 커밋도 main에 들어가고, 들어가면 즉시 프로덕션 배포가 시작된다.
- **Dependabot alerts / security updates 꺼짐** → 아래 3.7의 Next 취약점을 알려줄 경로가 없었다.
- `supabase/.temp/*` 9개 파일이 tracked (프로젝트 ref `kmhztgauczzqgqlehuow`, pooler URL). 비밀번호는 없어 위험도는 낮지만 공개 레포에 둘 이유가 없고, 매번 `M supabase/.temp/cli-latest`로 git status를 더럽힌다.
- `CLAUDE.md`는 "Supabase CLI link 없음"이라 하는데 `supabase/.temp/linked-project.json`이 존재한다. 어느 시점에 `supabase link`가 실행됐다. 문서와 실제가 어긋난 상태.
- `android/app/google-services.json` tracked. Firebase 설계상 공개 가능한 파일이라 낮음.

### 3.2 빌드 · 타입체크 · 린트 (🟢 / 🔴)

- `npx tsc --noEmit`: **0 에러**. Next 빌드가 타입체크를 포함하므로 현재 이것이 유일한 자동 게이트다.
- `npm run lint`는 **실행 자체가 안 된다.** Next 16에서 `next lint` 명령이 제거되어 `lint`를 디렉터리 인자로 해석한다:

  ```
  Invalid project directory provided, no such directory: C:\Honsulmap\lint
  ```

  `eslint@9`와 `eslint-config-next`는 설치돼 있지만 루트에 `eslint.config.*`가 없어 ESLint를 직접 돌려도 설정이 없다. 즉 **린트가 0**이고, 언제부터 깨졌는지도 모른다.
- Node 버전 고정 없음 (`engines`·`.nvmrc` 없음). 로컬 22.16, Codemagic 22, Vercel은 기본값.
- `package.json` scripts에 `test`·`typecheck`가 없다.

### 3.3 자동 테스트 (🔴)

| 대상 | 현황 |
|---|---|
| 웹앱 `src/` | 테스트 파일 **0개**, 러너 없음 |
| `worker/test_smoke.py` | storysaver.net을 실제로 호출하는 수동 스모크. CI에 못 올림 |
| `toss-pos-plugin/.../test.e2e.ts` | 토스 SDK 템플릿의 `PluginTester` 실행 1건. 유닛 테스트 아님 |

테스트 없이 돌아가는 **돈·개인정보 흐름**이 특히 위험하다:
- 주문/결제: `api/tossplace/webhook`, `api/tossplugin/feed`, `api/t/[slug]/orders`, `api/partner/spots/[id]/orders`
- 체크인/좌석 토큰: `api/t/[slug]/checkin`, `api/t/[slug]/move`, `lib/seatToken.ts`
- 자동 익명화 크론: `api/cron/day-close` (개인정보 삭제 범위를 날짜 산술로 결정)
- 영업일 경계 08:00 KST: `lib/tableDay.ts`
- 관리자 인증: `lib/adminAuth.ts`, `middleware.ts`
- 레이트리밋 fail-open: `lib/rateLimit.ts`

최근 로그가 보여주는 "테스트가 있었다면 잡혔을" 버그:
- `52ff446` 랭킹 전원 1위: `.in(657 uuid)`가 URL 길이 한도로 **조용히 실패**해 전원 0점.
- `ff2b736` 단자리 좌석 미매칭: `"01"` 0패딩 문자열 비교 불일치.
- `1844ba4` 메뉴 연타 시 수량 증가.
- `5ef5600` 재스캔 자리이동이 실제로는 안 됨 (seat 파라미터 무시).

순수 함수라 지금 당장 유닛 테스트를 붙일 수 있는 모듈: `seatToken`, `tableDay`, `claimCode`, `contentFilter`, `nickname`, `chatNick`, `blocklist`, `adminAuth`, `areas`, `utils.jsonLdScript`.

### 3.4 프로덕션 에러 수집 · 모니터링 (🔴)

**서버 (API 70개 + RSC)**
- 에러 처리 = `console.error` 16곳(7파일) + JSON 500 응답. Vercel 런타임 로그로만 흘러가며 Pro 플랜 기준 1일 뒤 사라진다 (플랜 확인 09-09). 검색은 되지만 집계·알림은 없다.
- `error.tsx`·`global-error.tsx`가 **하나도 없다.** 서버 컴포넌트 렌더 오류는 Next 기본 오류 화면으로 떨어지고 기록되지 않는다.
- 조용히 삼키는 `catch {}`가 27곳(19파일). 대부분 의도된 "로깅 실패 무시"지만, 삼킨 뒤 어디에도 남기지 않으므로 발생 빈도를 알 수 없다.
- `api/tossplace/webhook`이 실패하면 `console.error` 후 끝. 토스가 재전송하지 않으면 결제/취소 이벤트가 유실된다.

**클라이언트**
- `components/ClientErrorLogger.tsx`가 window error · unhandledrejection · SIGNED_OUT을 잡아 `POST /api/client-log`로 보내고, `tossplace_events` 테이블에 `event_type='client.log'`로 저장한다. 세션당 15건 상한, IP당 분당 30건 레이트리밋. **수집 설계는 좋다.**
- 그러나 이 로그를 **읽는 화면이 `src/app/admin`에도 `api/admin`에도 없다.** Supabase SQL Editor에서 직접 쿼리해야만 볼 수 있다. 사실상 "쌓기만 하는" 상태.

**업타임 / 크론 / 스크래퍼**
- `api/health`는 DB까지 찔러 200/503을 반환하고 커밋 SHA를 노출한다. 잘 만들었다. UptimeRobot 모니터는 예전에 등록돼 있었다 (09-09 확인). 다만 어떤 URL을 몇 분 간격으로 보는지, 알림이 어디로 가는지는 점검이 필요하다. 홈 주소만 보고 있다면 DB가 죽어도 200이 나올 수 있으니 `/api/health`로 바꿔야 한다.
- `day-close` 크론이 실패하면 500을 반환할 뿐이다. Vercel cron 실패 알림은 기본 꺼져 있다. 이 크론은 "영업 종료 후 개인정보 자동 만료"라는 **약관상 약속을 집행**하므로 실패를 반드시 알아야 한다.
- 스크래퍼: `docs/tablet-scraper-setup.md`의 모니터링 절차가 `ssh → grep -c processed= ~/scraper.log`다. 하트비트·알림 없음. Termux:Boot 미설정이라 갤탭이 재부팅되면 손으로 다시 켜야 한다. 스토리가 안 올라와도 지도가 "조용해질 뿐" 아무 신호가 없다.

### 3.5 배포 · 환경변수 (🟢 / 🟡)

- Vercel Git 연동은 건강하다. `vercel.json`: 리전 `icn1`, cron 1개. 오늘 프로덕션 배포 3건 모두 Ready, 40~50초.
- 롤백은 Vercel 대시보드 "Instant Rollback" 수동. 절차 문서 없음.
- **Preview 환경이 프로덕션 DB를 그대로 쓴다.** `SUPABASE_SERVICE_ROLE_KEY`·`CRON_SECRET`이 Production·Preview·Development 세 환경에 동일하게 들어가 있다. dev 브랜치 실험 코드가 Preview URL에서 실데이터를 쓰거나 지울 수 있다.
- 환경변수 드리프트 (Vercel Production 22개 vs 코드 참조 약 35개):
  - Vercel에만 있고 코드가 안 쓰는 것: `IG_SESSION_ID`·`IG_DS_USER_ID`·`IG_MID`·`IG_CSRF_TOKEN`·`IG_DID` (죽은 `api/cron/scrape` 전용), `NAVER_MAP_CLIENT_SECRET`, `NEXT_PUBLIC_ADSENSE_CLIENT` (src 어디에서도 참조 없음). 09-09 확인: 전부 이전 시도의 잔재. `NAVER_MAP_CLIENT_SECRET`은 네이버 클라우드의 서버 API(지오코딩 등)를 호출할 때 헤더에 넣는 값이라, 웹 지도 표시(`ncpKeyId` = Client ID)에는 원래 필요 없다. 셋 다 지워도 된다.
  - 코드가 쓰는데 Vercel에 없는 것: `NEXT_PUBLIC_ADFIT_UNIT_ID_*` 6개, `NEXT_PUBLIC_GOOGLE_*_CLIENT_ID` 2개, `GOOGLE_SITE_VERIFICATION`. 전부 코드에 하드코딩 fallback이 있어 동작엔 문제없지만, env로 바꿀 수 있다는 주석은 사실상 무의미해졌다.
  - `.env.local.example`은 5개만 나열. 새 PC 세팅 시 무엇이 필요한지 알 수 없다.
- 부팅 시 env 검증이 없다. `TOSSPLACE_*`·`SEAT_QR_SECRET`이 빠지면 첫 요청에서야 런타임 에러가 난다.

### 3.6 DB 마이그레이션 (🔴)

- `src/data/migrations/` SQL **59개**, 사용자가 SQL Editor에 붙여넣어 실행. 어떤 파일이 어느 환경에 적용됐는지 기록하는 테이블이 없다. "적용됐는지"의 유일한 기록은 기억과 커밋 메시지.
- `supabase/migrations/`에는 2026-05-04 파일 1개만 있어 두 경로가 어긋나 있다.
- 코드 쪽은 "마이그레이션 전 안전"을 위해 컬럼 존재 여부에 따라 분기하는 패턴을 반복하고 있다(`b907a65`, `1b30a70`). 이는 스키마 상태를 코드가 모른다는 뜻이며, 분기가 쌓일수록 테스트 매트릭스가 커진다.
- `655f41b`(2026-09-07): 8/31 `data_capture` 마이그레이션이 `spot_visits`를 `IF NOT EXISTS`로 만들려다 기존 테이블과 이름이 충돌해 **조용히 스킵**됐고, 체크인 방문 기록이 일주일간 전량 실패. 마이그레이션 결과 검증(예: 적용 후 컬럼 존재 assert)이 있었다면 당일 잡혔다.
- **09-10 추가 발견 (10.19)**: 같은 파일의 나머지 절반도 적용되지 않았다. 스킵된 `spot_visits` 바로 다음 줄의 `create index … (guest_key)`가 에러로 멈춰 그 뒤의 `spot_day_stats`·`menu_events`가 생성되지 않았고, 열흘간 마감 스냅샷과 메뉴 담기 기록이 조용히 실패했다. Sentry 크론 경고로 발견. 재실행 파일 `2026-09-11_data_capture_remainder.sql`은 검증 블록을 넣어 조용히 넘어가지 않는다.

### 3.7 의존성 보안 (🟡)

`npm audit`: 총 18건 — critical 1, high 12, moderate 4, low 1 (전체 의존성 850개).

| 패키지 | 심각도 | 직접 의존 | 조치 |
|---|---|---|---|
| `next` 16.2.9 | high | ✅ | **16.2.11로 패치 가능.** 9개 권고 포함: 미들웨어 우회(GHSA-6gpp-xcg3-4w24), 서버액션 DoS, SSRF, 캐시 혼동, 이미지 최적화 SVG DoS 등 |
| `postcss` | high | ✅ | 빌드 타임 전용. `npm audit fix` |
| `tar` (via `@capacitor/cli`) | critical | ✗ | 개발 툴체인. `npm audit fix` |
| `@capacitor/assets` → `sharp` | high | ✅ | 아이콘 생성용 개발 의존. 수정 버전 없음. 필요할 때만 `npx` 실행으로 빼는 방안 |
| 나머지 (`minimatch`·`js-yaml`·`brace-expansion`·`nanoid`…) | high/moderate | ✗ | 전이 의존, `npm audit fix`로 대부분 해결 |

미들웨어 우회 건은 이 레포의 `middleware.ts`가 `/admin`·`/api/admin` Basic 인증을 담당하므로 직접 해당된다. 다행히 모든 `/api/admin` 핸들러가 `assertAdmin()`을 한 번 더 호출하는 방어선이 있어(주석에 명시) 실질 노출은 제한적이지만, 패치 버전이 나와 있으니 미룰 이유가 없다.

### 3.8 모바일 · 플러그인 · 스크래퍼 릴리즈 (🟡)

- **iOS**: `codemagic.yaml` 워크플로가 잘 잡혀 있다(SPM, 인증서 재사용, 빌드번호 자동). 트리거 설정이 없어 대시보드에서 수동 시작. 적절한 수준.
- **Android**: `android/app/build.gradle` versionCode 4 / 1.0.4 수동 증가, 로컬 `key.properties` 서명. CI 없음.
- **토스 POS 플러그인**: `package.json` version이 `1.0.0` 고정인데 커밋 메시지는 v5.1/v5.2를 오간다. 어떤 zip이 어떤 소스인지는 커밋 메시지로만 추적된다. `dist/`는 gitignore, zip은 로컬 생성 후 수동 업로드. `typecheck` 스크립트는 있지만(`eslint --fix && tsc`) 실행 시점이 강제되지 않는다.
- **스크래퍼**: 데이터센터 IP가 차단되어 집 회선(갤탭)에 묶여 있다(메모리 기록). 이 제약은 CI로 못 푼다. 할 수 있는 건 감시(하트비트)뿐이다.

### 3.9 정리하면 좋을 죽은 코드 (삭제하지 않고 기록만)

- `src/app/api/cron/scrape/route.ts`: IG 직접 호출 구 크론. `vercel.json`에서 빠진 지 오래됐고 `IG_*` env 5개를 붙들고 있다.
- `render.yaml`, `worker/README.md`의 Render 배포 절차: Render 크론은 은퇴(CLAUDE.md).
- `.github/workflows/`에서 이미 삭제된 "Scrape Instagram Stories" 워크플로의 4월 실패 이력 10건이 Actions 탭에 남아 있다. 무해.
- `supabase/config.toml` + `supabase/migrations/` 1개: CLI를 쓰지 않는다면 혼란만 준다.

---

## 4. 취약 지점 우선순위

| 순위 | 취약점 | 왜 위험한가 | 근거 |
|---|---|---|---|
| 1 | **프로덕션 에러를 알 방법이 없다** | 서버 에러 미수집 + 에러 알림 0. 사이트가 통째로 죽는 건 UptimeRobot이 잡지만, 결제·체크인·크론이 실패하는 건 손님이 말해줄 때까지 모른다 | `655f41b` 일주일 방치, `console.error` 16곳뿐, error boundary 0, 500을 JSON으로 "돌려주는" 자리 94곳 |
| 2 | **배포 전 검증 = 타입체크 하나** | 돈·개인정보 흐름이 테스트 0으로 하루 5커밋씩 프로덕션 직행 | 테스트 파일 0, 최근 30일 148커밋, 브랜치 보호 없음 |
| 3 | **마이그레이션 수동·이력 없음** | 코드와 스키마가 어긋나도 감지 못 함. "마이그레이션 전 안전" 분기가 계속 늘어남 | SQL 59개, 적용 테이블 없음, `655f41b` |
| 4 | **Next 16.2.9 취약점 9건 방치** | 미들웨어 우회 등. 패치(16.2.11)가 이미 있는데 Dependabot이 꺼져 있어 몰랐다 | `npm audit`, GitHub security 설정 |
| 5 | **린트 부재** | 미사용 변수·잘못된 hook 의존성·`any` 남용을 아무도 안 잡는다. 깨진 사실조차 몰랐다 | `next lint` 실행 불가, `eslint.config.*` 없음 |
| 6 | **Preview = 프로덕션 DB** | dev 브랜치 실험이 실데이터를 건드릴 수 있고, service role 키가 Preview URL에서 살아 있다 | Vercel env 3환경 동일 |
| 7 | **크론·스크래퍼 무감시** | 개인정보 자동 만료 약속이 조용히 깨질 수 있고, 스토리 수집이 멈춰도 지도만 조용해진다 | `day-close` 500 반환만, 갤탭 SSH tail, Termux:Boot 미설정 |
| 8 | 공개 레포에 `supabase/.temp` 추적 | 프로젝트 ref·pooler 호스트 노출. 비밀번호는 없어 낮음 | `git ls-files supabase` |

---

## 5. 권장 로드맵

각 단계는 독립된 작은 PR로 쪼갤 수 있고, 앞 단계가 뒤 단계의 전제다. 공수는 단독 개발 기준.

### Phase 0 — 오늘 (1~2시간, 코드 변경 최소)

| 작업 | 공수 | 효과 |
|---|---|---|
| `npm i next@16.2.11` + `npm audit fix` (major 제외) → dev 배포 확인 | 15분 | 취약점 9건 + 전이 의존 대부분 해소 |
| `eslint.config.mjs` 추가(eslint-config-next flat config), scripts를 `"lint": "eslint ."`, `"typecheck": "tsc --noEmit"`으로 | 30분 (+초기 위반 정리 시간은 실행해 봐야 앎) | 린트 복구 |
| GitHub → Settings → Code security: Dependabot alerts + security updates ON | 5분 | 앞으로 취약점 자동 통지 |
| `.gitignore`에 `supabase/.temp/` 추가 + `git rm -r --cached supabase/.temp` | 5분 | git status 정리 + 노출 제거 |
| UptimeRobot 기존 모니터 점검: 감시 URL을 `/api/health`로, 5분 간격, 알림 메일 확인 (10.14). 스크래퍼용 `https://honsulmap.com/api/health/scraper` 모니터 추가 (10.3, 09-09 엔드포인트 배포됨) | 10분 | 사이트·DB·스크래퍼 다운 알림 |
| Vercel Project → Settings → Cron Jobs 실패 알림 이메일 ON 확인 | 5분 | `day-close` 실패 최소 통지 |

### Phase 1 — 이번 주: CI 게이트 (반나절)

- `.github/workflows/ci.yml`: `push`(dev, main) + `pull_request` 트리거. 단계: `npm ci` → `typecheck` → `lint` → `test` → `next build`. 빌드용 `NEXT_PUBLIC_*`는 더미 값으로, 비밀은 필요 없다(빌드는 DB에 접속하지 않음). `concurrency`로 중복 실행 취소, npm 캐시.
- main 브랜치 보호: "Require status checks to pass"(ci)만 켜고 리뷰 필수는 끈다(단독 개발). "Include administrators" 켜야 본인 push도 막힌다. **순서 주의**: CI를 먼저 만들어 2~3일 초록으로 안정된 뒤 보호를 켠다. 보호부터 켜면 체크가 없어 머지가 막힌다.
- 직접 push가 막히므로 머지 흐름은 `gh pr create --base main --head dev --fill && gh pr merge --auto --merge` 한 줄로 바꾼다. 현재 리듬(하루 여러 번 머지)을 유지하면서 CI 통과가 조건이 된다.
- **Preview에서 테스트가 안 되던 원인 제거** (09-09 진단): 로그인이 `window.location.origin/auth/callback`으로 돌아오는데, Preview 주소(`*.vercel.app`)가 Supabase Auth의 Redirect URL 허용 목록에 없으면 로그인 후 프로덕션 도메인으로 튕긴다. 그래서 main에 올려서 확인할 수밖에 없었던 것으로 보인다. 해결: ① Vercel에서 dev 브랜치에 고정 도메인 `dev.honsulmap.com`을 붙이고 ② Supabase → Authentication → URL Configuration → Redirect URLs에 `https://dev.honsulmap.com/**`를 추가한다. 카카오·구글 콘솔은 손댈 필요 없다 (제공자 콜백은 `*.supabase.co`로 고정). 이 두 가지가 되면 "dev push → dev.honsulmap.com에서 폰 확인 → PR → CI → 자동 머지" 흐름이 완성된다.
- 토스 플러그인은 별도 job으로 `npm ci && npm run typecheck && npm run build` (tsconfig exclude 되어 있어 루트 tsc가 못 본다).
- worker는 `python -m pyflakes worker/` 정도의 문법 검사만(외부 사이트 호출은 CI 불가).

### Phase 2 — 테스트 기반 (1~2주, 점진적으로)

1. **Vitest 도입** (Next 16 + React 19와 호환, 설정 10줄). `"test": "vitest run"`.
2. **1차: 순수 로직 유닛 테스트** — 파일당 30분. `seatToken`(서명/만료/변조), `tableDay`(08:00 KST 경계, 자정 넘김), `claimCode`, `contentFilter`, `nickname`/`chatNick`, `adminAuth`(constant-time 비교, env 누락 시 503), `blocklist`, `areas`.
3. **2차: API 라우트 핸들러 테스트** — `vi.mock('@/lib/supabase')`로 DB를 모킹하고 분기만 검증. 우선순위: `tossplace/webhook`(서명 검증, 이동 취소 오인 가드), `tossplugin/feed`(키 인증, 0패딩, moves), `t/[slug]/orders`(줄키·옵션), `t/[slug]/checkin`(토큰), `cron/day-close`(익명화 범위가 정확히 만료분만인지).
4. **3차: 버튼 통합 테스트** (09-09 추가) — Vitest + jsdom + React Testing Library. 컴포넌트를 띄워 버튼을 누르고 "올바른 API를 올바른 인자로 불렀나, 화면 상태가 바뀌었나"를 확인한다. 브라우저·로그인 불필요, `useUser`와 `fetch`는 가짜. 우선순위: 장바구니 담기·빼기·주문 전송(`TableClient`), 체크인 폼 제출, 찜 버튼(`FavoriteButton`), 로그인 모달 버튼, 사장님 주문 접수·완료 버튼, 메뉴 편집 저장.
5. **4차(선택): Playwright 스모크 3개** — 홈 지도 로드, `/t/[slug]` 체크인, 사장님 대시보드 진입. dev.honsulmap.com을 대상으로 배포 후 실행.

테스트 DB 전략은 결정이 필요하다(아래 7번). 초기에는 모킹으로 충분하다.

### Phase 3 — 에러 모니터링 (반나절)

**추천: Sentry (`@sentry/nextjs`)**
- 무료 플랜(월 5천 이벤트)으로 충분한 규모. 설치 위저드가 `global-error.tsx`·`instrumentation.ts`·소스맵 업로드까지 만들어 준다.
- 서버(API/RSC)·클라이언트·미들웨어를 한 번에 잡고, 이메일/텔레그램/디스코드 알림, 릴리즈별 에러 추적(커밋 SHA 연동)이 딸려 온다.
- Cron Monitors로 `day-close`가 08:10에 안 돌면 알림.
- 기존 `ClientErrorLogger`는 `Sentry.captureException`으로 대체하거나, SIGNED_OUT 추적처럼 Sentry가 못 보는 것만 남긴다.

**대안: 자체 구축 (외부 SaaS를 피하고 싶다면)**
- `global-error.tsx` + 주요 세그먼트 `error.tsx` 추가.
- 서버용 `logError(scope, err, ctx)` 헬퍼를 만들어 `tossplace_events`에 `event_type='server.error'`로 기록, API 라우트의 `console.error`를 전부 교체.
- 관리자 페이지에 "오류 로그" 탭(최근 200건, 레벨/URL 필터). 이것만 있어도 이미 쌓이고 있는 `client.log`가 살아난다.
- Supabase Database Webhook → 텔레그램 봇으로 error 레벨 즉시 통지.
- 공수는 Sentry의 3배쯤이고 소스맵·집계·중복 제거는 못 한다.

**스크래퍼 하트비트** (어느 쪽이든 필요)
- `scrape.py` 사이클 끝에 healthchecks.io 핑 한 줄(`errors>0`이면 `/fail`). 30분간 핑이 없으면 갤탭이 죽은 것이니 알림. `run_scraper.sh`에서 curl 한 줄이면 된다.
- Termux:Boot 설치로 재부팅 자동 복구.

### Phase 4 — 마이그레이션 관리 (반나절)

- **최소안**: `schema_migrations(name text primary key, applied_at timestamptz)` 테이블 하나. 각 SQL 파일 끝에 `insert into schema_migrations(name) values ('2026-09-08_xxx')` 관례. `scripts/check_migrations.ts`가 파일 목록과 테이블을 대조해 미적용 파일을 출력하고, CI에서 경고(실패는 아님)로 띄운다.
- **정석**: 이미 `supabase link`가 되어 있으니 `supabase db push`로 전환. 단 기존 59개를 baseline으로 묶는 작업이 먼저 필요하다.
- 마이그레이션 SQL에 검증 블록을 넣는 습관: `DO $$ BEGIN ASSERT (select count(*) from information_schema.columns where table_name='spot_checkin_visits')>0; END $$;`. `655f41b` 유형을 실행 즉시 잡는다.
- Preview용 별도 Supabase 프로젝트(무료 티어)를 만들어 Vercel Preview 환경의 `SUPABASE_*`만 바꾸면 실데이터와 분리된다.

### Phase 5 — 릴리즈 정리 (선택, 필요 시)

- 토스 플러그인 `package.json` version을 실제 버전(5.2.x)으로 맞추고, CI에서 `dist/` zip을 artifact로 남겨 "검수에 올린 zip = 어느 커밋"을 고정.
- Android `bundleRelease`를 GitHub Actions에서(키스토어를 secret으로) 만들 수 있으나, 출시 빈도가 낮으면 로컬 유지가 합리적이다.
- `.env.local.example`을 코드가 실제로 읽는 변수 전부로 갱신하고, `IG_*`·`NAVER_MAP_CLIENT_SECRET`·`NEXT_PUBLIC_ADSENSE_CLIENT`는 Vercel에서 제거.

---

## 6. 첫 PR 제안 (Phase 0 + Phase 1 묶음)

변경 파일:
- `package.json` — `next@16.2.11`, scripts `lint`/`typecheck`/`test` 추가, devDeps `vitest`
- `eslint.config.mjs` — 신규
- `vitest.config.ts` — 신규
- `src/lib/__tests__/seatToken.test.ts`, `tableDay.test.ts`, `claimCode.test.ts` — 첫 테스트 3개 (CI가 "초록"의 의미를 갖도록)
- `.github/workflows/ci.yml` — 신규
- `.gitignore` — `supabase/.temp/`
- `docs/cicd-audit-2026-09-08.md` — 이 문서

PR 밖에서 클릭으로 할 것: Dependabot ON, main 보호 규칙, UptimeRobot 확인, Vercel cron 알림.

---

## 7. 결정이 필요한 것

**지금 결정할 것: 없음.** 아래 전부 확정됐다.

**나중에 정해도 되는 것** (기본값으로 진행하고, 필요해지면 그때 묻는다)

- **테스트 DB**: 기본값은 모킹으로 시작하고, RLS·SQL 함수·마이그레이션 검증이 필요해지면 비프로덕션 Supabase 프로젝트 하나를 만들어 Preview DB와 겸용한다. 9.4, 10.
- **Preview 환경 DB 분리**: 기본값은 현행 유지. 분리하면 Preview에서 실데이터가 안 보여 지금 "폰으로 눈 확인" 습관과 충돌한다. 9.11.

**확인·확정된 것**

- **Sentry 도입 확정** (09-09) → **프로덕션 가동** (09-10, `389586b`). 남은 건 토큰·org·project를 Vercel env에 넣는 것. 10.13.
- Preview는 Vercel 로그인 벽 뒤 (09-10 발견). dev 도메인을 Deployment Protection 예외에 넣어야 폰 확인이 된다. 10.18.
- UptimeRobot은 예전에 등록돼 있었다 (09-09 정정. 08일엔 없다고 알았음). Phase 0에서 설정만 점검한다. 10.14.
- Vercel은 Pro 플랜 (09-09). 런타임 로그 1일 보관. 그래도 알림 기능은 없어 Sentry는 여전히 필요하다.
- Next 패치와 `npm audit fix`는 테스트를 기다리지 않고 먼저 한다 (09-09). dev Preview에서 지도·체크인·주문을 눌러본 뒤 머지.
- main 머지를 PR 방식으로 바꾸기로 함 (09-09). 단 "Preview에서 테스트가 안 돼 main에 올려 확인해 왔다"는 원인을 먼저 없앤다. Phase 1 참고.
- 사람 리뷰 승인 필수 규칙은 넣지 않는다. 단독 개발이라 승인자가 없다. 코드 리뷰는 머지 전 별도 세션의 `/code-review`로 대체한다. 10.1.

---

## 8. 기존 동작에 영향이 있나

한 줄로: **사용자가 보는 화면과 API 동작은 바뀌지 않는다.** 로드맵의 대부분은 "검사"와 "감시"라 코드 실행 경로 밖에 있다. 런타임을 건드리는 건 아래 네 가지뿐이고, 전부 dev 브랜치 Preview에서 먼저 확인한 뒤 main에 올린다.

| 변경 | 런타임 영향 | 비고 |
|---|---|---|
| CI 워크플로, 린트 설정, 테스트 러너, 이력 테이블, Dependabot | **없음** | 검사만 한다. Next 16은 빌드 때 린트를 돌리지 않으므로 린트 위반이 배포를 막지도 않는다 (CI에서만 막는다) |
| 브랜치 보호 + PR 머지 | **없음** | 바뀌는 건 코드가 아니라 머지하는 손동작 |
| 업타임 모니터 등록 | 5분마다 `/api/health` 요청 1건, DB select 1건 | 무시할 수준 |
| `next` 16.2.9 → 16.2.11 | **작음** | 패치 릴리즈, 보안 수정만. Preview에서 지도·체크인·주문 확인 후 머지 |
| Sentry SDK | **작음** | 클라이언트 번들 수십 KB 증가, 에러가 났을 때만 전송. 개인정보(닉네임·전화 해시) 스크러빙 설정 필요 |
| `error.tsx` / `global-error.tsx` | 에러가 났을 때의 화면만 바뀜 | 정상 동작엔 영향 없음. 지금은 Next 기본 오류 화면 |
| 마이그레이션 검증 블록 | SQL이 기대와 어긋나면 **일부러 멈춘다** | 이게 목적. `655f41b`처럼 조용히 넘어가는 걸 막는다 |

한 가지 습관 변화는 있다. main에 직접 push가 막히면 머지는 `gh pr create --base main --head dev --fill && gh pr merge --auto --merge` 한 줄로 한다. CI가 초록이면 자동으로 머지된다.

---

## 9. 영역별 도구 선택지와 장단점

파이프라인은 아래 14개 부분으로 나뉜다. 각 부분마다 쓸 수 있는 도구를 나란히 놓고 추천을 표시했다. 비용은 2026-09 기준 무료 플랜 위주로 적었고, 한도는 바뀔 수 있다.

### 9.1 검사를 어디서 돌릴 것인가 (CI 실행 환경)

코드가 main에 들어가기 전에 타입체크·린트·테스트를 돌리는 자리.

| 선택지 | 장점 | 단점 |
|---|---|---|
| **GitHub Actions** ✅ | 공개 레포는 무료·무제한. PR 상태 체크로 브랜치 보호와 바로 연결. 설정 파일 1개 | 별도 러너라 2~3분 걸림. npm 캐시를 따로 잡아야 빠르다 |
| Vercel 빌드 커맨드에 끼워넣기 (`npm run lint && npm test && next build`) | 설정 0. 실패하면 배포 자체가 안 됨 | 빌드가 느려지고 Preview까지 느려짐. 실패가 "배포 실패"로만 보이고 main에는 이미 들어간 뒤 |
| husky pre-commit / pre-push 훅 | 가장 빠른 피드백 | `--no-verify`로 우회 가능. PC마다 설치 필요, Windows에서 잔고장. 다른 Claude 세션이 커밋할 때도 걸린다 |

추천: GitHub Actions. 훅은 넣지 않는다. 이 프로젝트에서는 Claude가 작업 끝에 `npm run lint && npm test`를 돌리는 게 훅 역할을 한다.

### 9.2 린트

타입체크가 못 잡는 코드 습관 오류. hooks 의존성 누락, 안 쓰는 변수, `<img>` 오용 등.

| 선택지 | 장점 | 단점 |
|---|---|---|
| **ESLint + eslint-config-next** ✅ | Next 공식. React hooks·Next 전용 규칙 전부. 이미 설치돼 있음 | 1분 남짓 걸림. 설정 파일 필요 |
| Biome | 매우 빠름. 린트 + 포맷 통합 | Next·React 규칙 일부만. 플러그인 생태계 없음 |
| oxlint | 매우 빠름. ESLint 규칙 대부분 지원 | 아직 변화가 잦음. 일부 규칙 미지원 |
| Prettier (포맷터) | 코드 모양 통일 | 처음 적용하면 파일 전체가 diff로 잡혀 git blame이 오염됨. 지금 넣을 이유 없음 |

추천: ESLint + eslint-config-next. 09-08 실측으로 213 파일 중 30 파일에 65건이 나왔고, React 19 시대의 새 규칙 36건은 처음엔 경고로 낮춘다.

### 9.3 유닛·통합 테스트 러너

| 선택지 | 장점 | 단점 |
|---|---|---|
| **Vitest** ✅ | TS·ESM 그대로 실행, 빠름. Next 공식 가이드 있음. React Testing Library 호환 | async 서버 컴포넌트는 못 돌림 (Next 공식 문서 명시) |
| Jest | 오래돼 자료 많음. 토스 플러그인이 이미 사용 | TS·ESM 설정이 번거롭고 느림 |
| Node 내장 `node:test` | 의존성 0 | TS 변환을 따로 붙여야 하고 React 테스트 도구가 빈약 |

추천: Vitest. 설정 10줄.

### 9.4 API 테스트에서 DB를 어떻게 다룰 것인가

| 선택지 | 장점 | 단점 |
|---|---|---|
| **Supabase 호출 모킹** (`vi.mock`) ✅ 시작점 | 빠름, 무료, CI에 비밀 불필요 | RLS·SQL 함수(`rate_limit_hit`)·뷰 로직은 검증 못 함. 모킹이 실제와 어긋날 수 있음 |
| 로컬 Supabase (`supabase start`, Docker) | 완전 격리. 마이그레이션을 그대로 적용해 RLS까지 검증 | Docker 필요 (현재 없음). CI 3~5분 추가 |
| 테스트 전용 Supabase 프로젝트 (무료 티어) | 실제 환경과 동일 | 1주 미사용 시 일시정지. 마이그레이션 두 번 적용. CI에 키 필요 |
| PGlite (Node 내장 Postgres) | Docker 없이 실제 SQL | Supabase Auth·RLS·PostgREST 없음. supabase-js 대신 pg로 접근해야 |

추천: 모킹으로 시작. RLS나 SQL 함수를 검증하고 싶어질 때 로컬 Supabase.

### 9.5 E2E 스모크

| 선택지 | 장점 | 단점 |
|---|---|---|
| **Playwright** ✅ | 무료, 빠름, 모바일 뷰포트 에뮬. Next 공식 예제 | 작성·유지 비용. 네이버 지도·카카오 로그인 같은 외부 의존은 우회해야 |
| Cypress | GUI가 친절 | 느리고 병렬 실행은 유료. 다중 탭 제약 |

추천: Playwright로 3개만. 홈 지도 로드, `/t/[slug]` 체크인, 사장님 대시보드 진입. 배포 후 Preview URL에 돌린다.

### 9.6 에러 모니터링

서버·클라이언트에서 난 에러를 모아서 보여주고 알려주는 부분. 지금 가장 비어 있는 곳.

| 선택지 | 장점 | 단점 | 비용 |
|---|---|---|---|
| **Sentry** ✅ | Next 공식 SDK. 서버·클라이언트·미들웨어 한 번에. 소스맵으로 원본 줄 번호. 이메일·텔레그램·디스코드 알림. 크론 모니터. 릴리즈별 추적 | 외부 서비스에 에러 내용이 나감. 개인정보 스크러빙 설정 필요. 번들 수십 KB | 무료 월 5천 에러. 초과 시 유료 |
| 자체 구축 (`tossplace_events` + 관리자 화면 + 텔레그램) | 데이터가 내부에 남음. 이미 있는 `client.log`를 살림. 비용 0 | 서버 에러 캡처를 API 70개에 직접 심어야. 집계·중복 제거·소스맵 없음. 알림 파이프(Supabase Webhook → 텔레그램) 별도 | 0 |
| Vercel 로그·Observability | 설정 0. Pro라 1일 보관, 검색 가능 | 에러가 났다고 알려주지 않음. 집계·소스맵 없음 | 이미 Pro |
| GlitchTip (Sentry 호환 오픈소스) | Sentry SDK 그대로 사용. 저렴 | 호스팅을 직접 하거나 소액 유료. 기능 축소 | 셀프호스팅 or 소액 |
| Highlight.io / PostHog 에러 추적 | 세션 리플레이 포함 | Clarity와 기능 중복. 무거움 | 무료 한도 있음 |

추천: Sentry 무료. 설치 위저드가 `global-error.tsx`·소스맵까지 만들어 준다. 자체 구축은 외부 서비스가 싫을 때의 대안.

### 9.7 업타임·하트비트 감시

사이트가 살아 있는지, 크론과 스크래퍼가 제때 돌았는지.

| 선택지 | 장점 | 단점 | 비용 |
|---|---|---|---|
| **UptimeRobot** ✅ 사이트용 | 가장 단순. `/api/health` URL만 넣으면 끝. 이메일 알림 | 무료는 5분 간격. 텔레그램 등 일부 연동은 유료 | 무료 50개 |
| Better Stack Uptime | 3분 간격, 상태 페이지, 텔레그램·슬랙 연동 | 무료 한도가 작음 | 무료 10개 안팎 |
| **healthchecks.io** ✅ 크론·스크래퍼용 | "핑이 안 오면 알림" 방식이라 스크래퍼·크론 감시에 정확히 맞음. curl 한 줄 | HTTP 업타임 감시는 아님 | 무료 20개 |
| Sentry Cron Monitors | Sentry를 쓰면 한곳에서 관리 | 무료 한도가 작음 | Sentry 플랜에 포함 |
| 자체 (Vercel cron이 `stories.scraped_at` 최신값을 검사) | 코드 안에서 해결 | 알림 채널을 직접 만들어야. 새벽엔 스토리가 없어 착시 (문서에 이미 기록됨). 사이트가 죽으면 이 cron도 죽는다 | 0 |

추천: 사이트는 UptimeRobot, 스크래퍼와 `day-close`는 healthchecks.io. Sentry를 채택하면 크론 쪽은 Sentry로 통일해도 된다. 외부 감시는 계정 가입이 필요해 사용자가 직접 만들어야 한다.

### 9.8 의존성 보안

| 선택지 | 장점 | 단점 |
|---|---|---|
| **Dependabot** ✅ | GitHub 내장, 클릭 1번. 취약점 알림 + 보안 패치 PR 자동 | PR이 쏟아질 수 있음 (설정으로 주 1회 묶음) |
| Renovate | 묶음·스케줄·자동 머지가 강력 | 설정이 복잡 |
| CI에서 `npm audit --audit-level=high` | 간단 | 전이 의존 소음으로 빌드가 막힘. 경고로만 써야 |

추천: Dependabot alerts + security updates ON. 일반 버전 업데이트 PR은 주 1회 묶음.

### 9.9 브랜치 보호와 머지 흐름

| 선택지 | 장점 | 단점 |
|---|---|---|
| **GitHub 브랜치 보호 규칙 + PR 자동 머지** ✅ | CI 통과가 머지 조건. 실패 커밋이 main에 못 들어가니 프로덕션 배포도 안 됨 | main 직접 push가 막힘. 머지가 한 줄 명령으로 바뀜 |
| GitHub Rulesets | 위와 같되 우회 대상 지정 등 세밀 | 기능은 비슷. 굳이 바꿀 이유 없음 |
| Vercel Ignored Build Step | 스크립트로 배포를 건너뛸 수 있음 | Vercel은 GitHub 체크 결과를 기다리지 않음. 게이트 용도로 부적합 |
| 현행 (보호 없음) | 손이 안 감 | 깨진 커밋도 45초 뒤 프로덕션 |

추천: 브랜치 보호 규칙. "Require status checks"만 켜고 리뷰 필수는 끈다.

### 9.10 DB 마이그레이션

| 선택지 | 장점 | 단점 |
|---|---|---|
| **수동 SQL Editor + 파일 규칙** ✅ 지금 | 바뀌는 게 없음. 검증 블록 + 이력 테이블만 추가 | 여전히 사람 손. 실행을 잊을 수 있음 |
| **Supabase CLI `db push`** ✅ Phase 4 | 이력을 CLI가 관리. Docker 없이 push 가능. 나중에 CI 자동화로 이어짐. link는 이미 돼 있고 CLI 2.116 설치됨 | 기존 59개를 baseline 1개로 묶는 작업. DB 비밀번호 관리. diff·dump는 Docker 필요 |
| dbmate / Flyway (SQL 러너) | 단순, up/down 관리 | 별도 바이너리. Supabase 특화 아님. CLI가 있는데 굳이 |
| Drizzle Kit / Prisma Migrate | 스키마를 코드로, 타입 자동 생성 | 지금 코드가 supabase-js 기반이라 이중 관리. RLS·뷰·함수는 어차피 raw SQL. 큰 전환 |

추천: 지금은 수동 + 규칙 4개(검증 블록, 이력 테이블, 순서 규칙, 트랜잭션). Phase 4에서 CLI로.

### 9.11 Preview·스테이징 DB

| 선택지 | 장점 | 단점 | 비용 |
|---|---|---|---|
| **현행 유지** (Preview = 프로덕션 DB) ✅ 당장 | 폰으로 실데이터 확인 가능 | dev 실험이 실데이터를 건드릴 수 있음 | 0 |
| 별도 무료 Supabase 프로젝트 | 실데이터 격리 | 데이터가 비어 시드 스크립트 필요. 1주 미사용 시 일시정지. 마이그레이션 두 번 | 0 |
| Supabase Branching | PR마다 DB 자동 생성, 마이그레이션 자동 적용 | Pro 플랜 필수 + 브랜치 시간당 과금 | $25/월 + |

추천: 당장은 현행. 테스트가 DB를 실제로 치기 시작하는 Phase 4에서 무료 프로젝트 + 시드. 그 프로젝트는 테스트 DB와 겸용한다 (10.5).

참고: Preview "배포"는 이미 있고 없는 건 Preview "DB"다. 그리고 Preview에서 로그인이 안 되던 건 DB 문제가 아니라 Supabase Auth의 Redirect URL 허용 목록 문제로 보인다. Phase 1의 고정 dev 도메인 항목 참고.

### 9.12 모바일 빌드

| 선택지 | 장점 | 단점 |
|---|---|---|
| **Codemagic** (현행, iOS) ✅ | 이미 세팅됨. 맥 없이 iOS 서명·TestFlight | 수동 트리거. 무료 분 한도 |
| GitHub Actions macOS 러너 | 공개 레포는 무료. 레포 한곳에서 관리 | 서명·인증서 세팅을 직접 (fastlane match 등). Codemagic이 해주던 일 |
| GitHub Actions Android (`bundleRelease`) | ubuntu 러너 무료. 키스토어를 secret으로 | 출시 빈도가 낮으면 로컬이 더 단순 |

추천: 현행 유지. Android는 필요해질 때.

### 9.13 환경변수 검증

| 선택지 | 장점 | 단점 |
|---|---|---|
| 현행 (하드코딩 fallback) | 할 일 없음 | 빠지면 첫 요청에서야 조용히 실패 |
| **zod 스키마 1파일** (`@t3-oss/env-nextjs` 또는 직접) ✅ Phase 5 | 빌드·부팅 때 누락을 즉시 발견. 타입 안전 | `NEXT_PUBLIC_`과 서버 변수를 나눠 적어야 |

추천: Phase 5에서 파일 하나.

### 9.14 스크래퍼 재시작

| 선택지 | 장점 | 단점 |
|---|---|---|
| **Termux:Boot** ✅ | 갤탭 재부팅 시 자동 시작. 앱 설치 + 스크립트 1개 | F-Droid 설치 필요 |
| 현행 (수동) | 없음 | 재부팅하면 스토리 수집이 멈추고, 감시가 없으니 그것도 모른다 |

추천: Termux:Boot + 9.7의 하트비트를 같이. 둘 중 하나만 있으면 반쪽이다.

---

## 10. 09-09 문답 후 확정된 방식

사용자 질문 19개에 답하면서 정리된 것. 근거는 위 절들에 있고 여기는 결론만.

### 10.1 리뷰 게이트와 AI 리뷰
- 브랜치 보호는 "리뷰"용이 아니라 "CI 통과 없이 main에 못 들어감"용으로만 쓴다. 리뷰 승인 필수는 끈다.
- AI 리뷰는 코드를 쓴 세션이 아니라 **별도 세션 또는 서브에이전트**가 한다. 같은 세션은 같은 가정을 공유해 놓치는 게 같다. 머지 전 `/code-review` 습관으로 시작하고, PR에 자동 코멘트를 다는 봇(Claude Code Action)은 나중에.
- 사용자 리뷰는 코드가 아니라 **동작**을 본다. dev.honsulmap.com에서 폰으로.

### 10.2 우선순위
1. Phase 0 (오늘): Next 패치, 린트 복구, Dependabot, UptimeRobot.
2. 에러 모니터링 (반나절): 예상 못 한 실패를 잡는다. `655f41b`가 이 유형.
3. 테스트 (계속): 예상한 실패를 잡는다. 테스트 인프라가 없어서 main에 올려 확인하는 습관이 생겼으므로 이것도 시급하다. 2와 같은 주에 시작.

### 10.3 알림 설계 (신호 세 가지)
| 무엇이 죽었나 | 어떻게 아나 | 도구 |
|---|---|---|
| 사이트·DB | 밖에서 5분마다 `/api/health`를 열어본다 | UptimeRobot (기존 모니터 점검) |
| 크론 `day-close` | Sentry Cron Monitor로 감싼다. 08:10에 완료 신호가 없거나 실패하면 메일 | Sentry (도입 확정이라 통일) |
| 스크래퍼 (갤탭) | **결과 기준으로 본다.** 서버에 `/api/health/scraper`를 만들어 `max(spots.last_scraped_at)`가 임계값보다 오래되면 503을 돌려주고, 기존 UptimeRobot에 모니터 하나를 더 추가한다. 갤탭은 손댈 게 없다. 갤탭이 꺼졌든, 와이파이가 끊겼든, storysaver가 막혔든 "DB에 새 데이터가 안 들어온다"는 결과 하나로 잡힌다. **임계값은 10분 권장.** 근거: `last_scraped_at`은 가게 하나를 시도할 때마다 갱신돼(스토리가 있든 없든, 실패했든) 정상 운전 중엔 몇십 초마다 움직이고, 사이클 사이 공백(30초 대기 + 브라우저 부팅 30~60초)이 최대 2분쯤이다. 5분으로 잡아도 되지만 드물게 오탐이 날 수 있고, 10분이면 없다. UptimeRobot이 5분마다 확인하므로 실제 메일은 죽은 뒤 10~15분 | UptimeRobot + 코드 15줄 |
| 스크래퍼 5분 감지 (선택) | "죽은 지 5분 안에" 메일을 꼭 받고 싶으면 갤탭 쪽에 추가: `run_scraper.sh`가 1분마다 healthchecks.io에 "살아 있음" 핑을 보내고 유예 4분. 핑은 갤탭에서 인터넷 사이트로 **나가는** 요청이지 갤탭으로 들어오는 게 아니다. 갤탭은 밖에서 접근할 수 없다. 위의 결과 감시만으로는 10~15분이 한계 | healthchecks.io (무료, 이메일) |
| 코드 에러 (서버·클라이언트) | Sentry SDK 하나가 API 라우트·서버 컴포넌트·브라우저·앱 웹뷰를 전부 잡는다. 새 에러 첫 발생과 급증 때만 알림 | Sentry |

원칙: 과정("프로세스가 살아 있나")보다 결과("데이터가 들어오나")를 먼저 본다. 결과 감시 하나면 원인이 무엇이든 잡히고, 과정 감시는 원인을 빨리 좁히고 싶을 때 덧붙인다. 재부팅 자동 복구는 Termux:Boot.

### 10.4 테스트 범위
- 촘촘히: 돈(주문·웹훅·피드), 개인정보(익명화 크론), 인증(좌석 토큰·관리자). 라우트당 정상 1개 + 거절 케이스 3~5개.
- 버튼: 돈·체크인·찜·로그인 버튼은 컴포넌트 통합 테스트로 "누르면 맞는 API를 부르나"까지 본다 (Phase 2의 3차).
- 성기게: 순수 함수는 경계값 위주 5~10개. E2E는 "페이지가 뜨는가" 3개.
- 안 짠다: 컴포넌트 스냅샷, 스타일, 지도 렌더링, 관리자 UI.
- 규칙 하나: **버그를 고칠 때마다 그 버그를 재현하는 테스트 1개를 같이 넣는다.** 최근 버그 4개가 전부 이 유형이었다.
- 규모 감: 첫 달 60~100개, 전체 실행 10초 이내.

### 10.5 테스트 DB
- 모킹과 진짜 DB는 **대체 관계**다. 진짜 DB가 있으면 우리 DB 호출은 모킹하지 않는다. 모킹은 "DB가 이런 값을 준다고 치자"라 SQL·RLS·unique 제약·뷰는 검증 못 하고, 진짜 DB는 그걸 검증한다.
- 외부 서비스(토스 API·네이버·인스타)는 진짜 DB가 있어도 모킹한다. 우리 것이 아니라서.
- 세팅: Supabase 프로젝트 하나 더 (`honsulmap-test`). 프로덕션 스키마를 덤프해 1회 적용, 이후 새 마이그레이션은 두 곳에 실행. 테스트 시작 시 truncate + 시드. 키는 `.env.test`와 GitHub secret. Preview DB와 겸용.
- Docker가 없으므로 로컬 `supabase start`는 뒤로.

### 10.6 모바일 테스트
- 앱은 honsulmap.com을 웹뷰로 여는 껍데기라 **웹 테스트가 곧 앱 테스트**이고, 웹 배포가 곧 앱 배포다. 웹 CI가 앱의 안전망이다.
- 앱 전용은 네이티브 플러그인(푸시·소셜 로그인·AdMob·백버튼)과 웹뷰 특유 동작(safe area)뿐. 이건 셸을 바꿀 때만 실기기로: Android `npx cap run android`, iOS TestFlight.
- 배포 전 수동 체크리스트 10분: 로그인 3종, 푸시 등록, 배너, 백버튼, QR 체크인. Appium·Maestro 같은 자동화는 지금 규모엔 과하다.

### 10.7 버전 번호 자동화
- Android: `versionCode`를 손으로 4로 올리는 대신 `git rev-list --count HEAD`(커밋 수)를 쓴다. 항상 증가하고 편집이 필요 없다. `versionName`은 `package.json`의 version을 읽는다. 릴리즈 때 `npm version patch` 한 번.
- 토스 플러그인: `package.json` version을 실제 버전(5.2.0)으로 맞추고 `npm version minor`로 올린다. 빌드는 SDK가 `package.json`을 읽어 매니페스트를 만들므로 그게 곧 검수 버전이 된다. 시작 로그의 버전도 여기서 읽고, zip 파일명에 버전을 넣는다. 태그 push 시 CI가 zip을 GitHub Release에 첨부하면 "검수 올린 zip = 태그"가 고정된다.

### 10.8 Vercel Pro에서 달라지는 것
- 런타임 로그 1일 보관, 검색 가능. Log Drain으로 외부에 보낼 수 있다.
- 배포 실패 알림은 Vercel 설정에서 켜면 된다. 하지만 **런타임 에러를 알려주는 기능은 없다.** Sentry가 여전히 필요한 이유.
- dev 브랜치 고정 도메인(`dev.honsulmap.com`)은 플랜과 무관하게 된다.

### 10.9 dev 고정 도메인을 등록해야 하는 곳
랜덤 Preview 주소로는 아래 등록이 불가능하다. 고정 도메인이 필요한 진짜 이유.

| 어디 | 무엇을 | 왜 |
|---|---|---|
| 네이버 클라우드 콘솔 → Maps → 해당 키 → Web 서비스 URL | `https://dev.honsulmap.com` | 미등록 도메인에서는 지도 인증 실패로 안 뜬다 |
| Supabase → Authentication → URL Configuration → Redirect URLs | `https://dev.honsulmap.com/**` | 로그인 후 돌아올 주소 허용. Site URL은 프로덕션 그대로 |
| Vercel → 환경변수, Preview 스코프 | `NEXT_PUBLIC_SITE_URL`, 나중엔 dev DB의 `SUPABASE_*` | OG·canonical 주소와 DB 분리 |
| 코드 (나중) | `VERCEL_ENV !== 'production'`이면 `X-Robots-Tag: noindex` | dev 도메인이 네이버·구글에 색인되는 사고 방지 |
| 카카오·구글 콘솔 | 원칙적으로 불필요 | 제공자 콜백은 `*.supabase.co`라 이미 등록됨. 카카오 도메인 오류가 나면 그때 플랫폼 Web 도메인에 추가 |
| 토스 POS 플러그인·웹훅 | 등록 불가 | 프로덕션 도메인에 묶여 있다. 주문·포스 흐름은 테스트 코드 + 지금처럼 실제 테스트 가게로 확인 |
| 광고 (AdFit·AdSense) | 등록 안 함 | dev에서는 광고가 안 나오는 게 정상. `NEXT_PUBLIC_AD_TEST_MODE`로 끈다 |

dev DB를 별도 Supabase 프로젝트로 만들면 그 프로젝트의 Auth에도 카카오·구글 제공자를 켜고, 그 프로젝트의 콜백 주소(`https://<dev-ref>.supabase.co/auth/v1/callback`)를 카카오 개발자 콘솔 Redirect URI와 구글 클라우드 콘솔 승인된 리디렉션 URI에 한 번 추가해야 한다. 10분짜리 1회 작업. 세팅 절차는 별도 안내.

### 10.10 릴리즈는 스킬로
- 버전 올리기를 손으로 치지 않는다. `.claude/skills/`에 `release-toss-plugin`, `release-android` 스킬을 두고 `/release-toss-plugin minor` 한 줄로 버전 bump → 빌드 → zip 또는 aab → git 태그 → GitHub Release 첨부까지 한다.
- 머지마다 자동으로 버전을 올리는 방식(semantic-release 류)은 스토어 출시 단위와 맞지 않아 쓰지 않는다. 버전은 "출시했다"는 사건에만 올린다.
- Android `versionCode`는 커밋 수라 스킬이 손댈 게 없고, `versionName`만 `package.json`을 따른다.

### 10.11 CI는 어디서 돌리나
- GitHub Actions는 공개 레포에서 무료·무제한이다. 비공개로 바꿔도 월 2,000분이 무료라 지금 규모(3분 × 150회 = 450분)는 그 안이다. 돈 낼 일 없다.
- 내 PC에서 돌리는 self-hosted runner도 가능하지만, PC가 꺼지면 CI가 멈추고, 공개 레포에서는 남의 PR 코드가 내 PC에서 실행될 수 있어 GitHub이 명시적으로 말린다.
- Claude가 작업 끝에 `npm run lint && npm test`를 돌리는 건 "로컬 확인"이지 "게이트"가 아니다. 잊거나 건너뛰면 그만이다. 게이트는 사람이나 AI의 기억에 의존하지 않는 GitHub 쪽에 둔다.

### 10.12 테스트 범위에 대한 추가 답
- "버튼이 작동 안 함"은 기능이라 E2E로 잡는다. 핵심 흐름 3~5개는 버튼 클릭까지 포함한다.
- "디자인이 깨짐"은 외형이라 스크린샷 비교(Playwright `toHaveScreenshot`, Chromatic 류)로 잡는 건데, 이 앱은 홈이 실시간 지도 + 매일 바뀌는 IG 스토리라 스크린샷이 매번 달라져 오탐이 폭주한다. 사장님 대시보드·메뉴판·관리자처럼 고정 데이터 화면만 나중에 시드 DB로 가능.
- 전부 세세하게 하지 않는 이유는 비용이다. UI가 하루에도 여러 번 바뀌는 프로젝트에서 외형 테스트는 의도한 변경마다 깨져서 결국 무시된다. 테스트는 "무엇을 할 수 있는가"를 보고, "어떻게 보이는가"는 dev 도메인에서 눈으로, 배포 후엔 Clarity 녹화로 본다.
- 싼 광역 그물 하나: Playwright로 주요 페이지 15개를 열어 콘솔 에러나 잡히지 않은 예외가 있으면 실패. 버튼 하나하나는 못 보지만 "페이지가 통째로 깨짐"은 전부 잡는다.
- "버튼이 안 된다"는 API 테스트로는 못 잡는다. API는 멀쩡하고 화면 쪽 배선이 끊긴 거라서. 잡는 건 두 가지다. ① 컴포넌트 통합 테스트: Vitest + React Testing Library로 컴포넌트를 띄워 버튼을 누르고 "올바른 API를 불렀나"를 확인한다. 브라우저도 로그인도 필요 없고 유저 훅은 가짜로 넣는다. ② E2E: 진짜 브라우저에서 진짜 클릭.
- E2E의 로그인: 카카오 화면을 거치지 않는다. Supabase에 이메일·비밀번호 테스트 계정을 만들어 두고 테스트 코드가 프로그램으로 로그인한 뒤 세션 쿠키를 브라우저에 심는다. 이메일 로그인 UI는 앱에 없어도 Supabase 쪽에서 켜져 있으면 된다.
- AI가 코드만 보고 디자인 깨짐을 판단하는 건 못 믿는다. 대신 **스크린샷을 보게 하면 된다.** Playwright가 dev 도메인의 주요 화면을 폰·PC 두 뷰포트로 찍고, Claude가 그 이미지를 보고 이상한 곳을 짚는다. 스냅샷 비교처럼 픽셀 차이로 오탐을 내지 않고, 사람이 보듯 "겹쳤다, 잘렸다, 버튼이 안 보인다"를 본다. `/visual-check` 스킬 하나로 만들 수 있다.

### 10.13 Sentry 설치 계획 (확정) → 09-09 설치 완료

**설치된 것 (dev 브랜치, 09-09)**
- `@sentry/nextjs` 10.73. 파일: `src/instrumentation.ts`(서버·엣지 부팅 + `onRequestError`), `src/instrumentation-client.ts`(브라우저), `sentry.server.config.ts`, `sentry.edge.config.ts`, `src/lib/sentry.ts`(DSN·환경 공통), `src/app/global-error.tsx`, `src/app/error.tsx`.
- `next.config.ts`를 `withSentryConfig`로 감쌈. 터널 `/monitoring`, 소스맵 업로드 후 클라이언트 소스맵 삭제. `SENTRY_ORG`·`SENTRY_PROJECT`·`SENTRY_AUTH_TOKEN`이 Vercel에 없으면 소스맵 업로드만 건너뛰고 빌드는 통과한다.
- **5xx를 돌려주던 92곳(56파일)을 `serverError()`로 교체.** 응답 모양은 그대로, 보고만 추가. `src/lib/serverError.ts`의 `serverError()`/`reportError()`. 죽은 `api/cron/scrape`만 제외.
- 삼키던 자리에 `reportError()` 추가: 토스 웹훅(서명 거부·저장 실패·자동 체크아웃 실패), `day-close`·마감 버튼의 통계 스냅샷 실패.
- `day-close` 크론을 `Sentry.withMonitor('day-close')`로 감쌈. 23:10 UTC 스케줄, 10분 유예. Turbopack 빌드라 `automaticVercelMonitors`(webpack 전용)는 못 씀.
- `ClientErrorLogger`: window 에러 리스너 제거(Sentry가 잡음), SIGNED_OUT 추적은 DB + Sentry 양쪽에 남김.
- 환경 태깅: `NEXT_PUBLIC_VERCEL_ENV`(production / preview). 로컬 `next dev`에서는 전송 안 함. Replay 미사용, 성능 추적 10% 샘플. 잡음 제외: 광고·Clarity·GTM 스크립트, 브라우저 확장, 청크 로드 실패, ResizeObserver.
- 확인용 `/api/health/sentry-test`: Preview·로컬에서만 throw, 프로덕션은 404.
- 스크래퍼 감시 `/api/health/scraper`: `max(spots.last_scraped_at)`가 5분(`SCRAPER_STALE_MIN`) 넘게 오래되면 503. UptimeRobot에 모니터로 등록할 주소.

**남은 것 (사용자)**: Sentry 조직 설정에서 Auth Token 생성 → Vercel 환경변수 `SENTRY_AUTH_TOKEN`·`SENTRY_ORG`·`SENTRY_PROJECT`(Production·Preview). 이게 들어가야 스택이 원본 줄 번호로 보인다. 없어도 에러 수집·알림은 된다.

**09-10 프로덕션 가동 확인**
- 다른 세션이 dev를 main에 머지(`389586b`)해 Sentry 커밋 `c73f7dc`가 **이미 프로덕션에 올라갔다.** 로컬 빌드(73초)와 Vercel 빌드 모두 통과. 빌드 로그에 "No auth token" 경고만 있고 이는 토큰 등록 전이라 예상된 것.
- `https://honsulmap.com/api/health/scraper` → 200, `age_sec: 1`. 스크래퍼가 1초 전에 수집한 상태. UptimeRobot에 이 주소를 넣으면 끝.
- `https://honsulmap.com/api/health/sentry-test` → 404. 프로덕션에서는 의도대로 막힘.
- 터널 `https://honsulmap.com/monitoring`으로 테스트 이벤트를 보내 Sentry 수신 확인 (event id `8741920c…`). Sentry Issues에 "honsulmap sentry connectivity test (tunnel)"이 보이면 그게 이 테스트다. 지워도 된다.
- Auth Tokens 화면을 못 찾을 때: 주소창에 직접 `https://sentry.io/settings/<조직슬러그>/auth-tokens/` 또는 개인 토큰 `https://sentry.io/settings/account/api/auth-tokens/`. 둘 중 아무거나 되고, 권한은 `project:releases`·`project:write`·`org:read`.
- 플랫폼은 Next.js가 맞다. 앱은 honsulmap.com을 웹뷰로 열기 때문에 같은 브라우저 SDK가 앱 안에서도 돈다. `@sentry/capacitor`는 자바·스위프트 네이티브 크래시용인데 네이티브 코드가 거의 없어 지금은 불필요.

**기존 Sentry 계정이 있을 때** (09-09 질문)
- 조직을 지우고 새로 만들 필요 없다. 같은 조직 안에 프로젝트만 하나 더 만들면 DSN·이슈·알림이 전부 프로젝트 단위로 분리된다.
- 무료 할당량(에러 월 5천)은 **조직 단위로 합산**된다. 옛 앱이 지금도 어딘가에 배포돼 에러를 보내고 있으면 혼술맵 몫을 갉아먹는다. 조직 Stats 화면에서 최근 30일 이벤트가 0이면 그냥 두고, 아니면 그 프로젝트를 삭제한다. 안 쓰는 프로젝트는 지워도 되고 두어도 된다. 이벤트가 안 오면 비용도 할당량도 안 든다.
- 새 조직을 만들 수는 있지만 이득이 없다. 계정을 더 만들 필요도 없다.

**사용자가 할 것 (5분, 클릭 순서)**
1. sentry.io 로그인 → 왼쪽 위 조직 이름 클릭 → 기존 조직 선택.
2. 왼쪽 메뉴 Projects → 오른쪽 위 **Create Project** → 플랫폼 **Next.js** → "Alert me on every new issue" 그대로 → 프로젝트 이름 `honsulmap` → Create Project.
3. 만들어지면 설치 안내 화면이 뜬다. 여기서 `npx @sentry/wizard` 명령은 **실행하지 않는다.** 코드는 Claude가 넣는다. 화면에 보이는 **DSN** 값(`https://…@o….ingest….sentry.io/…` 모양)만 복사한다. 나중에 찾으려면 프로젝트 Settings → Client Keys (DSN).
4. 왼쪽 아래 Settings → 조직 설정 → Developer Settings → **Auth Tokens** → Create New Token → 이름 `vercel-sourcemaps`, 권한 `project:releases`와 `org:read` 체크 → 생성 후 토큰을 **한 번만** 보여주니 바로 복사.
5. Vercel → honsulmap 프로젝트 → Settings → Environment Variables → `SENTRY_AUTH_TOKEN` = 방금 토큰, 환경은 Production과 Preview, **Sensitive 체크** → Save. 토큰은 채팅에 붙이지 않는다.
6. Claude에게 알려줄 것 세 가지: **DSN**, 조직 슬러그, 프로젝트 슬러그. 둘은 브라우저 주소창 `sentry.io/organizations/<조직>/projects/<프로젝트>/`에 보인다. DSN은 공개돼도 되는 값이라 채팅에 붙여도 된다.

**Claude가 할 것 (반나절, dev 브랜치)**
- `@sentry/nextjs` 설치. `instrumentation.ts`(서버·엣지, `onRequestError`), `instrumentation-client.ts`(브라우저), `global-error.tsx`, `next.config.ts`의 `withSentryConfig` 래핑, 소스맵 업로드, 광고 차단기 우회용 터널 라우트.
- `environment`를 Vercel의 `VERCEL_ENV`(production / preview / development)로 태깅해 dev 도메인 소음을 분리하고, 알림 규칙은 production만 대상으로 건다.
- Session Replay는 끈다. Clarity가 이미 녹화하고 있고, 할당량과 개인정보 부담만 는다. 성능 추적(tracing)은 샘플 10%.
- **500을 "돌려주는" 자리 94곳(56파일)에 보고를 붙인다.** 이 코드베이스는 에러를 던지지 않고 `return NextResponse.json({ error }, { status: 500 })`으로 조용히 돌려주는 패턴이라, Sentry 기본 설치만으로는 이 94곳이 안 잡힌다. `serverError(scope, err)` 헬퍼 하나를 만들어 기계적으로 교체한다. 돈 흐름 라우트부터. **동작은 바뀌지 않는다.** 클라이언트가 받는 응답은 그대로 500 JSON이고, 돌려주기 직전에 "Sentry에 알려라" 한 줄이 끼는 것뿐이다. 사람이 94곳을 고치는 게 아니라 Claude가 한 번에 바꾼다.
- 개인정보 마스킹: `sendDefaultPii: false`, `beforeSend`에서 닉네임·전화 해시·세션 프로필 필드 제거. 유저 식별은 uid만.
- 잡음 제외: 광고 스크립트 로드 실패, `ResizeObserver loop`, 네이버 지도 스크립트 네트워크 오류, 브라우저 확장 프로그램 에러.
- `day-close` 크론을 `Sentry.withMonitor`로 감싼다. 08:10 스케줄 등록.
- `ClientErrorLogger`의 window 에러 처리는 Sentry로 넘기고, SIGNED_OUT 추적만 breadcrumb로 남긴다.
- 알림 규칙: 새 이슈 즉시 메일, 재발 즉시 메일, 1시간 10건 이상 급증 즉시 메일. 나머지는 일일 요약.

**Sentry가 못 보는 것** (그래서 테스트가 따로 필요한 이유)
- 버튼을 눌렀는데 아무 일도 안 일어남. 에러가 안 나면 Sentry는 모른다.
- 결과가 틀림. 랭킹 전원 1위 같은 논리 오류는 정상 실행이다.
- 4xx 거절. 로그인 안 한 유저의 401은 에러가 아니라 정상이다.
- 화면이 깨짐. 렌더가 성공하면 모양은 안 본다.

### 10.14 UptimeRobot 기존 설정 점검 항목
- 감시 URL이 `https://honsulmap.com/api/health`인가. 홈 `/`만 보고 있으면 캐시된 200 때문에 DB 장애를 놓친다. 홈 모니터는 두고 `/api/health`를 추가한다.
- 간격 5분, 모니터 타입 HTTP(s). 키워드 모니터는 필요 없다. `/api/health`가 장애 때 503을 내므로 HTTP 상태만으로 충분하다.
- 알림 연락처: 지금 읽는 이메일인지, 인증돼 있는지. UptimeRobot 폰 앱을 깔면 푸시도 온다.
- 최근 다운 이력을 한 번 본다. 지금까지 조용했다면 실제로 안 죽은 것인지, 알림이 안 온 것인지 구분해야 한다.
- 추가할 모니터: `https://honsulmap.com/api/health/scraper` (10.3). 나중에 `https://dev.honsulmap.com/api/health`.
- UptimeRobot에도 하트비트 모니터가 있다. 무료 플랜 포함 여부는 대시보드에서 확인. 포함이면 healthchecks.io 없이 이걸로 통일한다.

### 10.15 dev.honsulmap.com 만드는 법
**따로 사지 않는다.** `honsulmap.com`을 이미 갖고 있으니 그 앞에 붙는 서브도메인은 가비아 DNS에 레코드 한 줄 추가하는 것이고 무료다. DNS는 가비아 네임서버를 쓰고 있고, `www`는 이미 `cname.vercel-dns.com`으로 가 있다. 같은 방식이다.
1. Vercel → honsulmap 프로젝트 → Settings → Domains → `dev.honsulmap.com` 추가 → 도메인 편집에서 Git Branch를 `dev`로 지정.
2. 가비아 → DNS 관리 → CNAME 레코드 추가: 호스트 `dev`, 값 `cname.vercel-dns.com`.
3. 몇 분에서 한 시간 안에 dev 브랜치의 최신 배포가 그 주소로 열린다. 이후 dev push마다 자동 갱신.
4. 그다음 10.9의 등록 3곳: 네이버 클라우드 Maps Web 서비스 URL, Supabase Redirect URLs, Vercel Preview 환경변수.

### 10.16 Supabase를 하나 더 팔 때 OAuth
두 경우를 구분한다.
- **dev 도메인 + 지금 Supabase 프로젝트 그대로** (당장 할 것): 카카오·구글 콘솔은 안 건드린다. 로그인 콜백 주소가 지금 프로젝트의 `*.supabase.co`라 이미 등록돼 있다. Supabase Redirect URLs에 dev 도메인만 추가.
- **별도 Supabase 프로젝트** (테스트 DB 겸 Preview DB, 나중): 프로젝트 ref가 다르니 콜백 주소도 달라진다. 새 프로젝트 Auth에서 카카오·구글 제공자를 켜고 같은 클라이언트 ID·시크릿을 넣은 뒤, 새 콜백 `https://<새 ref>.supabase.co/auth/v1/callback`을 카카오 개발자 콘솔 Redirect URI와 구글 클라우드 콘솔에 한 번 추가한다. 10분, 1회.
- **한 프로젝트 안에 테스트용 스키마를 따로 두는 방법**도 있지만 권하지 않는다. Auth는 공유돼 OAuth 등록은 안 해도 되나, 마이그레이션 59개·뷰·함수·RLS·Realtime 설정을 전부 스키마 두 벌로 관리해야 해서 사고 확률이 더 높다.

### 10.18 Preview 배포는 Vercel 로그인 벽 뒤에 있다 (09-10 발견)
dev 브랜치 Preview 주소(`honsulmap-git-dev-….vercel.app`)를 열면 사이트가 아니라 **Vercel 로그인 페이지**가 나온다. Pro 플랜의 Deployment Protection(Vercel Authentication)이 Preview에 기본으로 켜져 있어서다. 즉 폰으로 Preview를 보려면 그 폰 브라우저가 Vercel에 로그인돼 있어야 했고, 로그인 리다이렉트 문제와 겹쳐 "main에 올려서 확인"하는 습관이 생긴 두 번째 원인이다.

해결 (둘 중 하나, 클릭만):
- Vercel → 프로젝트 Settings → Deployment Protection → **Deployment Protection Exceptions**에 `dev.honsulmap.com` 추가 (Pro 기능, 도메인을 만든 뒤). 다른 Preview 주소는 계속 보호되고 dev 도메인만 열린다. **추천.**
- 또는 Vercel Authentication 자체를 Preview에서 끄기. 모든 Preview 주소가 공개되므로 덜 권장.

E2E나 외부 감시가 Preview를 쳐야 할 땐 같은 화면의 **Protection Bypass for Automation** 시크릿을 만들어 헤더 `x-vercel-protection-bypass`로 넘기면 된다. 지금은 없다.

### 10.19 Sentry 첫 12시간의 알림 3건 (09-10) — 진단과 조치

| 알림 | 진단 | 조치 |
|---|---|---|
| `AbortError: The operation was aborted.` iOS 앱 웹뷰, 홈 | 페이지 이동 중 진행 중이던 fetch가 취소될 때 iOS가 던지는 것. 실제 오류 아님 | Sentry 클라이언트 `ignoreErrors`에 추가. `ClientErrorLogger`의 fire-and-forget fetch에 `.catch` |
| `SyntaxError: Unexpected token 'else'` Android 앱 웹뷰(Chrome 117), 인라인 스크립트 | 우리 번들이 아니라 문서 인라인 위치(`app:///:1`)에서 난 문법 오류. 옛 WebView에 무언가 주입된 스크립트일 가능성이 큼. 1건 | 조치 없음. 여러 기기에서 재발하면 조사 |
| `Cron failure: day-close` — timeout check-in | 로그 확인 결과 크론은 08:10에 실행됐고 수동 재실행은 **2초**에 끝난다. 즉 느려서가 아니라, 서버리스가 응답 직후 얼어붙어 마지막 "ok" 체크인이 유실된 것. 그리고 그 로그에서 **`spot_day_stats` 테이블이 없다**는 경고를 발견 → 08-31 마이그레이션 후반부 미적용 확인 (3.6) | `await Sentry.flush()` 후 응답, `maxDuration = 120`(토스 잔재 청소가 길어지는 날 대비). 누락 테이블은 `2026-09-11_data_capture_remainder.sql`로 재생성 — **사용자가 SQL Editor에서 실행** |

Sentry 도입 12시간 만에 "테이블 두 개가 열흘째 없었다"를 잡았다. 알림이 없었으면 마감 스냅샷과 메뉴 행동 데이터는 계속 비어 있었다.

### 10.17 스킬은 언제 실행되나
- 세션이 시작될 때 Claude는 스킬의 **이름과 한 줄 설명만** 목록으로 받는다. 본문은 그때 읽지 않는다.
- 실행되는 경우는 둘이다. ① 사용자가 `/스킬이름`을 직접 친다. ② 요청이 어떤 스킬의 설명과 맞으면 Claude가 코드 작업에 들어가기 전에 그 스킬을 먼저 불러 본문의 절차를 따른다. 지금 `ig-audit`, `discover-bars`가 그렇게 돈다. 그래서 설명 문구가 곧 트리거 조건이다.
- 릴리즈처럼 되돌리기 어려운 작업은 ②에 맡기지 않고 ①로만 쓴다. "출시하자"는 말에 자동으로 버전이 올라가면 안 되니까. 스킬 안에 스크립트를 넣어 두면 매번 절차를 다시 궁리하지 않고 같은 순서로 돈다.
- `.claude/skills/`는 레포에 들어 있어 다른 Claude 세션도 같은 스킬을 본다.
