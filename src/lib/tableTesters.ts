// 테이블 서비스 베타 테스터 화이트리스트.
// main 배포 후 외부(실기기)에서 기능을 검증하는 동안, 이 이메일로 로그인한
// 계정에만 사장님용 테이블 기능(설정 허브·주문 보드·QR·관련 API)이 열린다.
// 정식 오픈 시 이 게이트만 제거하면 된다.

export const TABLE_TESTER_EMAILS = [
  'yangseonghwan119@gmail.com',
  'gonetolove@nate.com',
];

export function isTableTester(email?: string | null): boolean {
  return !!email && TABLE_TESTER_EMAILS.includes(email.toLowerCase());
}
