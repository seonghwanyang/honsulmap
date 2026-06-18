# 혼술맵 → Capacitor 앱 전환 스펙 문서

> 작성일: 2026-06-16
> 대상: 기존 Next.js 16 웹앱(honsulmap)을 **UI·백엔드 변경 없이** iOS/Android 스토어 앱으로
> 방식: **Capacitor (네이티브 셸 + 웹뷰에 배포 URL 로드)**
> 형식: 자문자답(self-interview). "클로드코드에게 시킬 질문"을 작성자가 스스로 묻고 코드 근거로 답한 것.

---

## 진행 로그

- **2026-06-16 · PR-1 완료**: Capacitor 8.4 셸 + `android/` + `ios/` 생성, `server.url=honsulmap.com`. 안드로이드 실기기에서 사이트 렌더 ✅. `src/**` 불변.
- **2026-06-16 · R1 검증**: 안드로이드 웹뷰에서 카카오·구글 OAuth **둘 다 정상** → PR-2(네이티브 OAuth) 안드로이드용 **불필요**. iOS(WKWebView)는 Mac 빌드 시 재확인.
- **관찰**: 웹 알림이 "Chrome" 명의로 뜸 = 웹뷰=크롬 엔진이라 정상. 네이티브 푸시(PR-4)로 해결 예정.
- **2026-06-16 · PR-3 위치**: AndroidManifest에 `ACCESS_FINE/COARSE_LOCATION` 추가 → OS 권한 팝업 정상 출현. 위치값은 **실기기에서 최종 검증 예정**(에뮬레이터엔 좌표 없음). 필요 시 `@capacitor/geolocation` 추가가 격리 fallback.
- **2026-06-16 · PR-6(부분)**: MainActivity `onBackPressed` 오버라이드 — 뒤로가기 시 웹뷰 히스토리 우선, 루트에서만 종료.
- **2026-06-16 · PR-6 아이콘/스플래시**: `@capacitor/assets`로 흑백 톤(검정 배경 흰 '혼') 아이콘·스플래시 생성(android 87 / ios 10 / pwa 14). 소스 = 기존 favicon 1024 업스케일.
- **2026-06-17 · PR-4 푸시(코드 완료)**: `@capacitor/push-notifications@8.1.1` 설치. Cap8이 Gradle 자동연결(classpath + google-services 조건부 apply), `google-services.json`(com.honsulmap.app) 배치 확인. 신규: `PushRegistration.tsx`(네이티브 전용·동적 import, layout 연결), `POST /api/devices`(service-role upsert), 마이그레이션 `device_tokens`. `tsc` 통과. **남은 사용자 액션**: ① 마이그레이션 실행 ② 프로덕션 배포 ③ 앱 재빌드 ④ 실기기 + Firebase 테스트 푸시. iOS는 APNs 키 + Mac 빌드.
- **다음**: PR-5 AdMob · PR-6 나머지(상태바/세이프에어리어) · PR-7 스토어. (iOS 빌드 Mac/CI)
- **별건(앱 외)**: IG 스토리 스크래퍼(`worker/scrape_adaptive.py`)가 storysaver.net Turnstile 미돌파로 stories=0 지속 → 직접-IG 방식(`api/cron/scrape`) 복원 검토 필요.

---

## Part 0 — 이 문서를 쓰는 법 (바이브 코딩 방지 규율)

이 스펙의 목적은 "막 짜다 보니"를 막는 것이다. 실행 시 3가지 규율을 강제한다.

1. **한 번에 PR 하나.** 한 PR 끝나면 멈추고 verify 결과를 보고한 뒤 다음으로.
2. **변경 금지선(Do-Not-Touch)을 매 PR에 명시.** 그 선을 넘는 변경은 거부한다.
3. **모든 작업에 verify 기준 1개 이상.** "된 것 같다"는 금지. 실기기/명령 출력으로 증명.

> 모르는 것은 추측하지 않고 **"❓확인 필요"** 로 남긴다. PR-0 스파이크에서 검증한다.

---

## Part 1 — 시스템 맵 (지금 honsulmap이 뭐냐)

### Q1. 스택은?
- **Next.js 16 App Router + React 19**, 서버 컴포넌트 + 클라이언트 컴포넌트(`*Client.tsx`) 혼합
- **Supabase** (Postgres + Auth + Storage `post-images` 버킷), `@supabase/ssr`
- **Tailwind 4**, TypeScript
- 빌드: `next build` / 런타임: `next start` (서버 필요) — **정적 사이트 아님**
- `next.config.ts`: `images.remotePatterns`에 `*.cdninstagram.com`, `*.supabase.co` 등록. `output: 'export'` **없음** → SSR 서버앱 확정.

### Q2. 라우트 구조는?
- **공개**: `/`(지도-MapClient), `/feed`, `/community`, `/spot/[slug]`, `/post/[slug]`, `/write`, `/about` `/faq` `/terms` `/privacy`
- **파트너(사장님)**: `/partner`, `/partner/dashboard`, `/partner/claim`, `/partner/spot/[id]` (AuthGate로 보호)
- **어드민**: `/admin/*` (spots, requests, claims, reports)
- **API 라우트 33개**: `/api/spots/*`, `/api/posts/*`, `/api/comments/*`, `/api/reports`, `/api/rankings/*`, `/api/spot-requests`, `/api/partner/*`, `/api/admin/*`, `/api/cron/scrape`, `/api/health`

### Q3. 인증은 어떻게 동작하나? (★ 웹뷰 핵심)
**3개의 독립된 인증 체계가 공존한다.**

| 주체 | 방식 | 코드 위치 | 세션 |
|---|---|---|---|
| 일반 유저 | **Supabase OAuth — 카카오 / 구글** (`signInWithOAuth`) | `LoginModal.tsx`, `lib/supabase/client.ts`, `app/auth/callback/route.ts` | **쿠키**(`@supabase/ssr`, 자동 갱신) |
| 어드민 | HTTP Basic (`ADMIN_USER`/`ADMIN_PASS`) | `middleware.ts` | Basic 헤더 |
| 파트너 | bcryptjs 비밀번호 로그인 | `api/partner/*`, `AuthGate.tsx` | ❓세션 방식 PR 착수 시 확인 |

유저 로그인 흐름: `LoginModal` → `signInWithOAuth({ provider, redirectTo: ${window.location.origin}/auth/callback?next=... })` → 카카오/구글로 **브라우저 네비게이션** → `?code`로 돌아옴 → 서버가 `exchangeCodeForSession(code)` → **쿠키에 세션 기록** → `next`로 복귀.

### Q4. 데이터·외부 연동은?
- **지도**: 네이버 지도 JS SDK. `<Script>`로 로드, `window.naver.maps`, `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID`. (네이버 클라우드 콘솔에 **Web 서비스 URL 화이트리스트** 등록 필요)
- **이미지**: IG CDN 핫링크(`*.cdninstagram.com`) + Supabase Storage(`*.supabase.co`), `next/image` 최적화
- **위치**: "300m 체크인" 기능에서 브라우저 `navigator.geolocation` 사용(최근 커밋)
- **광고**: 카카오 **AdFit** (`NEXT_PUBLIC_ADFIT_UNIT_ID_*`, `lib/ads/config.ts`) — 웹 디스플레이 광고
- **분석**: GA(`NEXT_PUBLIC_GA_ID`), MS Clarity(`NEXT_PUBLIC_CLARITY_ID`)
- **IG 스크래핑**: `/api/cron/scrape` (사용자 PC의 Windows 작업 스케줄러가 구동, 앱과 무관)
- **PWA 자산 일부 존재**: `public/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `AddToHomePrompt.tsx` → **앱 아이콘으로 재사용 가능**

### Q5. 환경변수 인벤토리
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID`, `NEXT_PUBLIC_SITE_URL`, `ADMIN_USER/PASS`, `CRON_SECRET`, `IG_*`(스크래핑), `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_CLARITY_ID`, `NEXT_PUBLIC_ADFIT_UNIT_ID_*`, `GOOGLE_SITE_VERIFICATION`

---

## Part 1.5 — "웹 백엔드 / 모바일 백엔드"는 따로 없다 (오해 정리)

**Q. 웹 백엔드 코드랑 모바일 백엔드 코드가 한 파일에 있어도 되나?**
→ 애초에 **백엔드는 하나다.** Capacitor가 배포 URL(`honsulmap.com`)을 로드하므로 앱과 웹은 **같은 Next.js 서버 + 같은 Supabase + 같은 API 33개**를 그대로 공유한다. "모바일 전용 백엔드"라는 별도 물건이 생기지 않는다.

- **공유가 기본**: 거의 모든 API는 웹·앱이 같이 쓴다. 파일 안 쪼갬.
- **앱 전용 로직이 필요할 때(드묾)**: 같은 코드베이스 안에서 두 방법 중 하나.
  - ⓐ **새 엔드포인트 추가** — 예: 푸시 토큰 저장 `POST /api/devices`. 웹은 호출 안 하면 끝. 충돌 없음.
  - ⓑ **요청 분기** — 한 핸들러 안에서 `X-Client: app` 헤더/파라미터로 분기. 클라에서 `Capacitor.isNativePlatform()`로 앱 여부 감지.
- **결론**: 파일 나눌 필요 없다. "백엔드 최소화"는 이 방식에서 **자동 달성**(기존 100% 재사용 + 앱 전용 몇 개만 추가).

---

## Part 2 — 앱화 전략 결정

### Q6. Capacitor로 어떻게 감쌀 것인가? (a) 배포 URL 로드 vs (b) 정적 번들?
**결정: (a) 배포 URL 로드 (`server.url` = 운영 도메인).**

근거:
- honsulmap은 서버 컴포넌트 + API 33개 + 미들웨어 + 쿠키 인증의 **풀 SSR 앱**. (b) 정적 export는 이걸 전부 해체해야 함 → "백엔드 그대로" 정면 위반, 수 주 작업.
- (a)는 **배포된 사이트를 그대로 웹뷰로** 띄움 → 서버·인증·네이버 지도·`next/image`가 **이미 동작하는 그대로** 작동. 네이버 지도 도메인 화이트리스트도 실 도메인이라 통과.
- 비용: 오프라인이 약함(폴백 화면 필요), 그리고 **Apple 4.2 "단순 웹 래핑" 리젝 위험** → 아래로 방어.

### Q7. Apple "그냥 웹사이트 아니냐" 리젝을 어떻게 피하나?
네이티브 가치를 실제로 넣는다(=네가 원한 기능들과 정확히 일치):
- 푸시 알림(네이티브) · 위치/체크인(네이티브 권한) · 생체인증 로그인 · 오프라인 폴백 · 네이티브 스플래시/상태바
- 이 기능들이 4.2 명분을 만든다. (참고: 개인정보처리방침 `/privacy` 이미 존재)

---

## Part 2.5 — 파트너(사장님) 앱을 따로 낼 경우

**업계 표준은 컨슈머 앱 / 파트너 앱 분리다** (배민↔배민사장님, 쿠팡이츠↔쿠팡이츠 스토어, 우버↔우버 드라이버). 사용자·다운로드 의도·스토어 노출이 다르기 때문. (에어비앤비처럼 모드 전환으로 통합하는 반례도 있음.)

**우리 구조(URL 로드)에선 파트너 앱이 싸다:**
- 파트너 웹은 이미 `honsulmap.com/partner/*`에 존재.
- 파트너 앱 = **두 번째 얇은 Capacitor 셸**이 `partner.honsulmap.com`(또는 `/partner`)을 로드. **백엔드·웹 코드 0 복제.**
- 별도인 것: 앱 ID, 아이콘, 스토어 등록, `capacitor.config`, 플러그인 구성(파트너는 위치 대신 '새 클레임/리뷰' 푸시).
- 비용: 스토어 등록 2개 + Android 14일 테스트 2회 + 유지보수 2개.

**권장 페이즈:**
- **Phase 1**: 컨슈머 앱(iOS+Android)만. 파트너는 모바일 웹.
- **Phase 2**: 사장님 수요 생기면 파트너 앱 분리(+사장님 푸시). 셸만 추가라 빠름.

---

## Part 3 — 갭 분석 & 리스크 (웹→웹뷰 전환 시 깨질 지점)

### 🟢 R1. OAuth in 웹뷰 — 안드로이드 검증 완료 / iOS 미검증
- **원래 우려**: 구글이 임베디드 웹뷰 OAuth를 차단(`disallowed_useragent`)하는 걸로 악명.
- **✅ 검증 (2026-06-16, 실기기)**: `server.url=honsulmap.com`(실 도메인) 위에서 **안드로이드 웹뷰는 카카오·구글 둘 다 정상 로그인.** origin이 진짜 도메인이라 콜백·쿠키 세션이 그대로 동작 → **안드로이드 R1 해소, PR-2 불필요.**
- **⚠️ 남은 미검증**: **iOS WKWebView**는 동작이 다를 수 있음(구글 차단 소지). **Mac 빌드 때 동일 테스트 필수.** 막히면 그때만 아래 보류책 적용.
- **보류된 해결책(iOS에서 막힐 때만)**: 시스템 브라우저(ASWebAuthenticationSession/Custom Tabs) + 딥링크 + Supabase PKCE. 도구: `@capacitor/browser`, `@capacitor/app`.
- **등급**: 🟢 (안드로이드) / ❓ (iOS, 보류).

### 🟠 R2. 네이버 지도 도메인 인증
- **문제**: 네이버 지도는 등록된 Web 서비스 URL에서만 동작. 웹뷰 origin이 실 도메인이면 OK, `capacitor://localhost`면 실패.
- **해결**: (a) 배포 URL 로드 방식이라 실 도메인 → **기본 통과**. 운영 도메인이 콘솔에 등록돼 있는지만 확인.
- **등급**: 🟠 (방식 (a)로 대부분 해소). ❓도메인 등록 상태 확인.

### 🟢 R3. 위치 권한 (포그라운드 체크인) — 백그라운드 제외 결정됨
- **문제**: 웹뷰의 `navigator.geolocation`은 네이티브 권한 문자열이 없으면 거부됨.
- **해결**: `@capacitor/geolocation` + Info.plist `NSLocationWhenInUseUsageDescription` / AndroidManifest `ACCESS_FINE_LOCATION`. 기존 300m 체크인 로직 그대로 재사용.
- **결정(2026-06-16)**: "앱 켜져 있을 때 위치"면 충분 → **상시 백그라운드 추적 제외.** 유료 플러그인·`Always` 권한·심사 사유 전부 불필요 → 단순·심사 용이.
- **등급**: 🟢 (난이도 하).

### 🟠 R4. 푸시 알림
- **문제**: 웹 푸시 ≠ 앱 푸시. FCM/APNs 셋업 필요.
- **해결**: `@capacitor/push-notifications` + FCM(Android)/APNs(iOS). **디바이스 토큰 저장 테이블 + 엔드포인트 신규 추가**(백엔드 추가분).
- **등급**: 🟠.

### 🟠 R5. 광고 — AdMob(네이티브)로 전환 결정됨
- **문제**: 기존 AdFit은 웹 광고 SDK. 앱 웹뷰 인벤토리는 정책 회색지대.
- **결정(2026-06-16)**: 앱에선 **AdMob 네이티브 광고**(`@capacitor-community/admob`). AdMob은 웹 DOM이 아니라 webview **위에 네이티브 배너/전면**을 띄움.
- **구현**: 클라이언트 분기 — `Capacitor.isNativePlatform()`이면 기존 `AdSlot`(AdFit) 렌더 끄고 AdMob 플러그인 호출. 백엔드 영향 없음(클라 SDK). 필요: AdMob 계정 + 앱/광고단위 ID.
- **등급**: 🟠 (클라이언트 한정 PR).

### 🟡 R6. 이미지 / CSP / mixed-content
- **문제**: IG 핫링크·Supabase 이미지가 웹뷰 CSP에서 막힐 수 있음.
- **해결**: (a) 방식이라 `next/image` 최적화가 서버에서 돌아 대부분 OK. 웹뷰 CSP에 이미지 도메인 허용 확인.
- **등급**: 🟡.

### 🟡 R7. 네이티브 UX 마감
- 안드로이드 뒤로가기, 세이프에어리어(노치), 상태바 색, 외부 링크는 시스템 브라우저로, 당겨서 새로고침, 오프라인 폴백.
- **등급**: 🟡 (마감 품질).

---

## Part 4 — 실행 계획 (PR 단위 · 한 번에 하나)

> 공통 변경 금지선: **`src/app/**`의 기존 페이지/컴포넌트, `src/app/api/**`, Supabase 스키마·서버 로직을 R1 분기 외에는 건드리지 않는다.** Capacitor는 신규 파일/디렉토리 추가가 원칙.

| PR | 작업 | 변경 파일(예상) | 변경 금지선 | verify |
|---|---|---|---|---|
| ✅ **PR-0+1** | Capacitor 8.4 스캐폴딩 + android/ios 생성 (PR-0 스파이크 통합) | `capacitor.config.ts`, `www/`, `android/`, `ios/` | `src/**` 불변 ✅ | 안드로이드 렌더 ✅ + 카카오·구글 로그인 ✅ (iOS 대기) |
| ~~**PR-2**~~ **(보류)** | OAuth 네이티브 플로우(R1) — **안드로이드 검증 결과 불필요.** iOS WKWebView에서 구글 막힐 때만 진행 | (필요 시) `LoginModal.tsx`, `client.ts` 분기, 딥링크 핸들러 | 웹 쿠키 플로우 유지 | iOS 실기기에서 양 로그인 성공 |
| **PR-3** | 위치 권한 + 체크인(R3 포그라운드) | 권한 문자열, geolocation 브릿지(신규) | 기존 체크인 로직 재사용 | 실기기 현위치 획득 + 300m 체크인 동작 |
| **PR-4** | 푸시(R4): 플러그인 + FCM/APNs + **토큰 저장 테이블/엔드포인트 신규** | 신규 마이그레이션, 신규 API, 등록 코드 | 기존 테이블 불변 | 토큰 등록 + 테스트 푸시 수신 |
| **PR-5** | AdMob 전환(R5): 앱에서 AdFit 끄고 네이티브 배너 | `AdSlot.tsx` 분기, AdMob 초기화(신규) | 웹 AdFit 경로 유지 | 앱에서 AdMob 배너 노출, 웹 광고 회귀 없음 |
| **PR-6** | 네이티브 마감(R7): 스플래시·세이프에어리어·뒤로가기·외부링크·오프라인 폴백 | 셸 설정/소량 | 기존 UI 불변 | 각 항목 실기기 체크 |
| **PR-7** | 스토어 제출 준비: 권한 사유 문구, 스크린샷, 광고정책(R5), 개인정보 링크 | 스토어 메타 | — | 심사 체크리스트 통과 |

---

## Part 5 — 결정 사항

**✅ 결정됨 (2026-06-16)**
1. **운영 도메인**: `https://honsulmap.com` → `capacitor.config.ts`의 `server.url`로 사용
2. **위치**: 포그라운드(앱 사용 중)만 → **백그라운드 추적 제외**
3. **광고**: **AdMob 네이티브**로 전환 (앱에서 AdFit 끔)
4. **백엔드**: 하나의 백엔드(Next.js + Supabase)를 웹·앱이 공유. 앱 전용 엔드포인트(예: 푸시 토큰)는 같은 코드베이스에 추가 — 별도 모바일 백엔드 없음 (→ Part 1.5)

5. **플랫폼**: iOS + Android **둘 다**. 개발자 계정 보유 + 앱 출시 경험 있음.
6. **앱 범위(Phase 1)**: **컨슈머(일반 유저) 앱만.** 파트너·어드민은 웹 유지. 파트너는 향후 **별도 앱**으로 분리 (→ Part 2.5).

**❓ 아직 필요**
7. Phase 1에 **파트너 앱도 처음부터 같이** 낼지(권장: 컨슈머 먼저, 파트너 Phase 2).

**📌 스케줄 메모**
- Android 개인 계정 **14일 비공개 테스트(20명)**가 롱폴 → **PR-0 통과 직후 Android 클로즈드 테스트부터 업로드**(14일 카운트 시작), 그동안 iOS·나머지 PR 병행. iOS TestFlight는 빠름.
- 앱 2개(컨슈머+파트너) 내면 Android 14일 사이클도 **2번**.

---

## Part 6 — 클로드코드에게 줄 실제 지시 순서

1. *"플랜 모드. 코드 변경 없이 PR-0 스파이크용 최소 Capacitor 셸 구성안을 만들어. 운영 URL `<도메인>`을 웹뷰로 띄우고 카카오/구글 로그인을 실기기에서 검증하는 절차까지."*
2. *(검증 후) "PR-1만 한다. Capacitor 스캐폴딩, 신규 파일만. `src/**`·`api/**` 절대 불변. 끝나면 멈추고 빌드/렌더 결과 보고."*
3. *"PR-2만. R1 OAuth 네이티브 플로우. 앱 환경에서만 분기, 웹 쿠키 플로우는 회귀 없이 유지. verify: 앱·웹 양쪽 로그인."*
4. 이후 PR-3 → PR-4 → … 각 PR마다 **"하나만, 끝나면 멈추고 verify 보고."**
5. 계획 자체 점검은 `/oh-my-claudecode:review`(Critic)로.

> ✅ **R1 업데이트(2026-06-16)**: 안드로이드 실기기에서 카카오·구글 OAuth **둘 다 정상** → PR-2 안드로이드용 불필요. 남은 미지수는 **iOS WKWebView**뿐 — Mac 빌드 때 재확인.
