# Naver Map 로딩 실패 분석 보고서

## 핵심 원인 (한 줄 요약)

`onJSContentLoaded` 콜백을 등록하는 시점에 이미 이벤트가 발생 완료됨 → 콜백 영원히 안 불림 → 맵 타일 렌더링 불가

---

## Naver Maps API 로딩 2단계

| 단계 | 무엇이 로드됨 | `jsContentLoaded` | Map 생성 가능? | 타일 렌더 가능? |
|------|-------------|-------------------|---------------|----------------|
| Phase 1 (셸) | 생성자 함수들 (`Map`, `LatLng` 등) | `false` | O (에러 안 남) | **X** |
| Phase 2 (컨텐츠) | 타일 메타데이터, 좌표계, 렌더링 엔진 | `true` | O | **O** |

콘솔에서 확인된 상태:
```
window.naver?.maps?.Map: function     ← Phase 1 완료
jsContentLoaded: false                ← Phase 2 미완료
Map 생성 성공!                        ← 생성자는 성공하지만 타일 못 그림
```

---

## 레이스 컨디션 (경쟁 조건)

```
시간 →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→

[스크립트]  Phase1 로드완료 ──── Phase2 로드완료 ──── onJSContentLoaded 발생!
                                                        ↑
[코드]      setTimeout 폴링... ── naver.maps 발견! ─── jsContentLoaded=false 확인 ── 콜백 등록
                                                                                      ↑
                                                                              이미 이벤트 지나감
                                                                              콜백 영원히 안 불림
```

**핵심**: `jsContentLoaded`를 확인하는 시점과 콜백을 등록하는 시점 사이에 이벤트가 발생하면 놓침.

---

## 실패 시나리오 3가지

### 시나리오 A: 폴링 타이밍 미스
1. setTimeout 100ms 간격으로 `naver.maps` 감시
2. 감지 시점에 `jsContentLoaded: false`
3. `onJSContentLoaded` 콜백 등록
4. 하지만 이벤트는 이미 발생했거나, 등록 직후 발생 → 콜백 안 불림

### 시나리오 B: React strict mode (개발 모드)
1. 첫 마운트: `onJSContentLoaded` 콜백 등록
2. cleanup: `destroyed = true`, `onJSContentLoaded = null`
3. 재마운트: 새 콜백 등록 시도
4. 하지만 이벤트는 첫 마운트와 cleanup 사이에 이미 발생 → 영원히 안 불림

### 시나리오 C: 스크립트 캐시
1. 브라우저가 스크립트를 캐시에서 즉시 로드
2. Phase 1 + Phase 2 모두 useEffect 실행 전에 완료
3. `jsContentLoaded: false` → `true` 전환이 체크 직전에 발생
4. 코드는 `false`를 보고 콜백 등록하지만, 이벤트는 이미 지남

---

## map-test.html이 작동하는 이유

```html
<!-- 동기(blocking) 로딩: Phase 1 + Phase 2 모두 완료 후 다음 줄 실행 -->
<script src="...maps.js?ncpKeyId=..."></script>
<script>
  // 여기서는 jsContentLoaded가 이미 true
  var map = new naver.maps.Map('map', { ... });
</script>
```

동기 스크립트는 브라우저가 완전히 로드될 때까지 파싱을 멈추므로 타이밍 문제가 없음.

---

## 추천 해결 방안

### 방법 1: `onReady` + 재확인 패턴 (권장)

```tsx
<Script
  src={`...?ncpKeyId=${clientId}`}
  strategy="afterInteractive"
  onReady={() => {
    // onReady는 매 마운트마다 불림 (strict mode 안전)
    if (!mapRef.current || mapInstanceRef.current) return;

    const create = () => {
      mapInstanceRef.current = new window.naver.maps.Map(mapRef.current, opts);
      setMapReady(true);
    };

    if (window.naver.maps.jsContentLoaded) {
      create();
    } else {
      window.naver.maps.onJSContentLoaded = create;
      // 레이스 방지: 등록 직후 재확인
      if (window.naver.maps.jsContentLoaded) create();
    }
  }}
/>
```

- `onReady`: React 마운트마다 불림 → strict mode 안전
- 등록 후 재확인: 레이스 윈도우 차단

### 방법 2: `callback` URL 파라미터

```tsx
// 전역 함수 등록
window.__naverMapCallback = () => { /* 맵 생성 */ };

<Script src={`...?ncpKeyId=${id}&callback=__naverMapCallback`} />
```

API가 직접 타이밍 관리 → 가장 안정적이지만 전역 함수 필요.

---

## 부가 이슈

| 이슈 | 위치 | 영향 |
|------|------|------|
| `max-w-screen-md` | layout.tsx:24 | 맵이 768px로 제한 (의도적 디자인) |
| `main { padding-bottom: 80px }` | globals.css:41 | 맵 페이지에 불필요한 하단 패딩 |
| 로딩 오버레이 `z-[2]` | page.tsx:249 | mapReady가 false면 맵 위를 덮음 (증상) |
