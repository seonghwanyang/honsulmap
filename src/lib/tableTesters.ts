// 테이블 서비스 베타 테스터 화이트리스트.
// main 배포 후 외부(실기기)에서 기능을 검증하는 동안, 이 이메일로 로그인한
// 계정에만 사장님용 테이블 기능(설정 허브·주문 보드·QR·관련 API)이 열린다.
// 정식 오픈 시 이 게이트만 제거하면 된다.

export const TABLE_TESTER_EMAILS = [
  'yangseonghwan119@gmail.com',
  'gonetolove@nate.com',
  'bjw123128@gmail.com', // 더끌림 수원인계점 사장님 (파일럿 1호점)
  'lyjiooi567@gmail.com', // 더끌림 사장 계정 (9/9 등록) — 명단 누락으로 보드 차단됐던 건
];

export function isTableTester(email?: string | null): boolean {
  return !!email && TABLE_TESTER_EMAILS.includes(email.toLowerCase());
}

// 멤버-오픈 가게 — spot_members(사장/직원)로 등록된 사람이면 테스터 화이트리스트
// 없이도 테이블 서비스 접근(형 결정 2026-09-11). 소유권(spot_members)은 여전히
// 확인하므로 등록 안 된 사람은 못 본다.
export const MEMBER_OPEN_SPOT_IDS = [
  '43a6e530-3954-4c5a-bc9f-272894d12033', // 더끌림 수원인계점 (파일럿 1호점)
];
export function isMemberOpenSpot(spotId?: string | null): boolean {
  return !!spotId && MEMBER_OPEN_SPOT_IDS.includes(spotId);
}
