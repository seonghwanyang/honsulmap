'use client';

import { useEffect, useRef } from 'react';

/**
 * 오버레이(모달·시트)가 열려 있을 때 히스토리에 항목을 push해서,
 * 뒤로가기(iOS 엣지 스와이프 / 안드 하드웨어 백 / 브라우저 back)에 닫히게 한다.
 * UI로 닫으면(뒤로가기 아님) push했던 항목을 되돌려 히스토리를 깨끗이 유지한다.
 */
export function useBackClose(open: boolean, close: () => void) {
  const closeRef = useRef(close);
  closeRef.current = close;
  const closedByPop = useRef(false);

  useEffect(() => {
    if (!open) return;
    closedByPop.current = false;
    window.history.pushState({ __overlay: true }, '');
    const onPop = () => {
      closedByPop.current = true;
      closeRef.current();
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      // 뒤로가기가 아니라 UI로 닫혔고, 우리가 push한 항목이 아직 스택 top이면 소비.
      // (그 사이 다른 페이지로 이동했으면 state가 바뀌므로 건드리지 않는다.)
      if (
        !closedByPop.current &&
        (window.history.state as { __overlay?: boolean } | null)?.__overlay
      ) {
        window.history.back();
      }
    };
  }, [open]);
}
