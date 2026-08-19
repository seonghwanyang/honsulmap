import { redirect } from 'next/navigation';

// 메뉴 편집은 테이블 설정 허브(/tables)의 아코디언 섹션으로 통합됐다.
// 기존 링크·북마크가 깨지지 않게 리다이렉트만 남긴다.
export default async function MenuRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/partner/spot/${id}/tables`);
}
