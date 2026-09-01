import { createHmac } from 'crypto';

// 좌석 QR 서명 토큰 — 실물 QR에만 존재하는 8자 HMAC(k= 파라미터).
// URL 추측(?seat=3)만으로는 체크인이 안 되게 막는다: 스캔 = 인증.
// modes.qr_token_required가 켜진 가게만 검증 (기존 무토큰 QR 하위호환).
// 시크릿 교체 시 인쇄된 QR 전부가 무효가 되므로 SEAT_QR_SECRET은 로테이션 금지.
export function seatQrToken(spotId: string, seatLabel: string): string | null {
  const secret = process.env.SEAT_QR_SECRET;
  if (!secret) return null;
  return createHmac('sha256', secret).update(`${spotId}:${seatLabel}`).digest('hex').slice(0, 8);
}
