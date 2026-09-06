// 앱 스토어 링크 — 기종 분기 공용 (헤더 앱받기 칩, QR 페이지 앱 게이트 등에서 사용)
export const APP_STORE_URL = 'https://apps.apple.com/kr/app/id6781643324';
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.honsulmap.app';

export function storeUrl(): string {
  if (typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent)) return PLAY_STORE_URL;
  return APP_STORE_URL;
}
