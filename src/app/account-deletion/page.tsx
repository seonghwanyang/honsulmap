import type { Metadata } from 'next';
import Link from 'next/link';
import AccountDeleteButton from './AccountDeleteButton';

export const metadata: Metadata = {
  title: '계정 및 데이터 삭제',
  description:
    '혼술맵 계정 및 데이터 삭제 요청 안내. 삭제 요청 방법과 삭제·보관되는 데이터 항목을 안내합니다.',
  alternates: { canonical: '/account-deletion' },
};

export default function AccountDeletionPage() {
  return (
    <div style={{ background: '#ffffff', minHeight: '100dvh' }}>
      <header
        className="sticky top-0 z-20 flex items-center gap-3 px-4"
        style={{
          height: '52px',
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <Link
          href="/"
          className="flex items-center gap-1 text-sm"
          style={{ color: '#6b7280' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          뒤로
        </Link>
        <span className="font-semibold text-sm" style={{ color: '#111827' }}>
          계정 및 데이터 삭제
        </span>
      </header>

      <div className="px-4 pt-6 pb-24" style={{ maxWidth: 720, margin: '0 auto' }}>
        <h1 className="text-xl font-bold mb-1" style={{ color: '#111827' }}>
          혼술맵 계정 및 데이터 삭제
        </h1>
        <p className="text-xs mb-8" style={{ color: '#9ca3af' }}>
          앱: 혼술맵 · 운영: 시냅틱(Synaptic) · 문의: contact@higgsi.com
        </p>

        <AccountDeleteButton />

        <Section title="1. 계정 삭제를 요청하는 방법">
          <p className="mb-2">
            혼술맵 계정과 관련 데이터의 삭제를 원하시면 아래 절차에 따라 요청해 주세요.
          </p>
          <ol className="list-decimal list-inside space-y-1">
            <li>
              <strong style={{ color: '#111827' }}>contact@higgsi.com</strong> 으로 이메일을
              보냅니다. (제목: <strong style={{ color: '#111827' }}>계정 삭제 요청</strong>)
            </li>
            <li>
              본문에 <strong style={{ color: '#111827' }}>가입 시 사용한 소셜 로그인
              이메일</strong>(카카오·구글·애플 중 사용한 계정)을 적어주세요. 본인 확인에
              사용됩니다.
            </li>
            <li>
              접수 후 <strong style={{ color: '#111827' }}>3영업일 이내</strong>에 처리하며,
              완료되면 회신드립니다.
            </li>
          </ol>
        </Section>

        <Section title="2. 삭제되는 데이터">
          <p className="mb-2">계정 삭제 시 아래 데이터가 영구 삭제되며 복구할 수 없습니다.</p>
          <ul className="list-disc list-inside space-y-1">
            <li>계정 정보: 이메일 주소, 이름·프로필</li>
            <li>찜(저장한 장소) 목록</li>
            <li>작성한 채팅 메시지</li>
          </ul>
        </Section>

        <Section title="3. 계정을 삭제하지 않고 일부 데이터만 삭제">
          <p className="mb-2">
            계정을 유지하면서 특정 데이터만 삭제할 수도 있습니다.
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>
              커뮤니티 글·댓글: 작성 시 입력한 비밀번호로 앱에서 직접 삭제할 수 있습니다.
            </li>
            <li>
              그 외 특정 데이터 삭제: <strong style={{ color: '#111827' }}>contact@higgsi.com</strong>{' '}
              으로 삭제할 항목을 적어 요청해 주세요.
            </li>
          </ul>
        </Section>

        <Section title="4. 보관되는 데이터 및 보관 기간">
          <ul className="list-disc list-inside space-y-1">
            <li>
              접속 로그(IP·User-Agent): 부정 이용 방지 및 장애 대응을 위해{' '}
              <strong style={{ color: '#111827' }}>최대 30일</strong> 보관 후 자동 파기됩니다.
            </li>
            <li>
              관련 법령에서 보관을 의무화한 정보가 있는 경우, 해당 법령이 정한 기간 동안
              보관 후 파기합니다.
            </li>
          </ul>
        </Section>

        <p className="text-xs mt-6" style={{ color: '#9ca3af' }}>
          데이터 처리에 관한 자세한 내용은{' '}
          <Link href="/privacy" style={{ color: '#374151', textDecoration: 'underline' }}>
            개인정보처리방침
          </Link>
          을 참고하세요.
        </p>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-7">
      <h2 className="font-bold text-base mb-2" style={{ color: '#111827' }}>
        {title}
      </h2>
      <div className="text-sm leading-relaxed" style={{ color: '#374151' }}>
        {children}
      </div>
    </section>
  );
}
