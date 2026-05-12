import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '이용약관',
  description: '혼술맵 서비스 이용약관',
  alternates: { canonical: '/terms' },
  robots: { index: true, follow: true },
};

export default function TermsPage() {
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
          이용약관
        </span>
      </header>

      <div className="px-4 pt-6 pb-24" style={{ maxWidth: 720, margin: '0 auto' }}>
        <h1 className="text-xl font-bold mb-1" style={{ color: '#111827' }}>
          이용약관
        </h1>
        <p className="text-xs mb-8" style={{ color: '#9ca3af' }}>
          최종 업데이트: 2026년 5월 12일
        </p>

        <Section title="제1조 (목적)">
          <p>
            본 약관은 개인이 운영하는 웹사이트 <strong style={{ color: '#111827' }}>혼술맵</strong>
            (이하 &quot;서비스&quot;)이 제공하는 모든 기능의 이용 조건, 절차, 권리·의무 및
            책임 사항을 규정함을 목적으로 합니다.
          </p>
        </Section>

        <Section title="제2조 (약관의 효력과 변경)">
          <ul className="list-disc list-inside space-y-1">
            <li>본 약관은 서비스 내 게시한 시점부터 효력이 발생합니다.</li>
            <li>
              운영자는 관련 법령에 위배되지 않는 범위에서 본 약관을 언제든지 개정할 수
              있으며, 개정 시 서비스 내 공지(게시판 또는 약관 페이지)로 갈음하고
              <strong style={{ color: '#111827' }}> 개별 통지 의무는 부담하지 않습니다.</strong>
            </li>
            <li>
              개정된 약관의 효력 발생일 이후 서비스를 계속 이용하는 경우 변경된 약관에
              동의한 것으로 간주됩니다.
            </li>
          </ul>
        </Section>

        <Section title="제3조 (서비스의 내용)">
          <p className="mb-2">서비스는 아래 기능을 제공합니다.</p>
          <ul className="list-disc list-inside space-y-1">
            <li>제주 혼술바·게스트하우스 위치 및 공개 인스타그램 스토리의 지도 표시</li>
            <li>사용자 간 후기·실시간 현황·정보 공유를 위한 커뮤니티 게시판</li>
            <li>업장에 대한 좋아요·분위기 투표 등 간단한 피드백 기능</li>
            <li>기타 운영자가 정하는 부가 기능</li>
          </ul>
          <p className="mt-2 text-xs" style={{ color: '#9ca3af' }}>
            서비스의 구체적인 구성, 항목, 기능은 운영자의 판단에 따라 사전 통보 없이
            추가·변경·제거될 수 있습니다.
          </p>
        </Section>

        <Section title="제4조 (이용 자격 및 비회원 이용)">
          <ul className="list-disc list-inside space-y-1">
            <li>
              서비스는 <strong style={{ color: '#111827' }}>별도의 회원 가입 절차 없이</strong>{' '}
              누구나 이용할 수 있습니다.
            </li>
            <li>
              게시글·댓글 작성 시 닉네임과 비밀번호만 입력하며, 실명·이메일 등 별도의
              개인 정보를 수집하지 않습니다.
            </li>
            <li>
              비밀번호 분실·도용으로 인한 게시물 수정·삭제 불가에 대해 운영자는 책임을
              지지 않습니다.
            </li>
          </ul>
        </Section>

        <Section title="제5조 (이용자의 의무 및 금지 행위)">
          <p className="mb-2">이용자는 다음 행위를 하여서는 안 됩니다.</p>
          <ul className="list-disc list-inside space-y-1">
            <li>타인의 명예·신용·프라이버시를 침해하거나 욕설·비방·차별적 표현을 사용하는 행위</li>
            <li>음란물, 폭력적·혐오적 콘텐츠, 청소년 유해 콘텐츠의 게시</li>
            <li>도배·스팸·자동화된 반복 게시 행위</li>
            <li>운영자의 사전 동의 없이 광고·홍보·상업적 콘텐츠를 게시하는 행위</li>
            <li>저작권·상표권 등 제3자의 권리를 침해하는 콘텐츠의 게시</li>
            <li>허위 사실의 유포, 특정 업장에 대한 악의적·반복적 비방</li>
            <li>해킹·크롤링·역공학 등 서비스의 정상적 운영을 방해하는 일체의 행위</li>
            <li>법령에 위반되는 모든 행위</li>
          </ul>
        </Section>

        <Section title="제6조 (게시물의 책임과 관리)">
          <ul className="list-disc list-inside space-y-1">
            <li>
              이용자가 게시한 게시물·댓글의 내용과 그로 인해 발생하는 일체의 결과에 대한
              책임은 <strong style={{ color: '#111827' }}>전적으로 작성자 본인에게 있습니다.</strong>
            </li>
            <li>
              운영자는 게시물을 사전에 검열·검수할 의무를 부담하지 않으며, 사후적으로
              본 약관·법령·공서양속에 위반된다고 판단되는 게시물을
              <strong style={{ color: '#111827' }}> 사전 통보 없이 삭제·블라인드 처리할 수 있습니다.</strong>
            </li>
            <li>
              제3자가 자신의 권리(저작권, 명예 등) 침해를 주장하며 삭제·정정을 요청할
              경우, 운영자는 임시 조치(블라인드)를 거쳐 사실 관계를 확인한 뒤 처리할 수
              있습니다.
            </li>
            <li>
              운영자는 이용자가 작성한 게시물을 서비스 운영, 홍보(예: 인기 글 노출),
              검색엔진 노출 등에 비독점적·무상으로 사용할 수 있는 권리를 가집니다.
            </li>
          </ul>
        </Section>

        <Section title="제7조 (인스타그램 스토리 등 제3자 콘텐츠)">
          <ul className="list-disc list-inside space-y-1">
            <li>
              서비스는 업장의 <strong style={{ color: '#111827' }}>공개</strong> 인스타그램
              계정에 게시된 스토리만 수집·표시합니다. 비공개 계정 및 개인 사용자 계정의
              콘텐츠는 수집 대상이 아닙니다.
            </li>
            <li>
              서비스는 수집한 스토리를 <strong style={{ color: '#111827' }}>별도로 가공하지 않으며,</strong>{' '}
              인스타그램의 공식 미디어 URL을 통해 원본을 표시합니다. 운영자는 해당
              콘텐츠의 저작권을 주장하지 않습니다.
            </li>
            <li>
              업장·권리자가{' '}
              <a
                href="mailto:contact@higgsi.com"
                style={{ color: '#111827', textDecoration: 'underline' }}
              >
                contact@higgsi.com
              </a>
              으로 삭제를 요청하는 경우, 운영자는 접수 후 24시간 이내에 해당 콘텐츠를
              서비스에서 제거합니다.
            </li>
            <li>
              스토리에 포함된 인물·상품 등의 공개 여부는 원 게시자(업장)의 결정에
              따르며, 그로 인한 분쟁에 대해 운영자는 책임을 지지 않습니다.
            </li>
          </ul>
        </Section>

        <Section title="제8조 (업장 정보의 정확성)">
          <p>
            서비스가 표시하는 업장의 위치, 영업시간, 메뉴, 가격, 휴무일 등은 운영자가
            공개된 정보를 토대로 수집한 것으로 <strong style={{ color: '#111827' }}>정확성·최신성을 보장하지 않습니다.</strong>{' '}
            방문 전 해당 업장에 직접 확인하시기 바라며, 정보의 오류로 인해 발생하는 손해에
            대해 운영자는 책임을 지지 않습니다.
          </p>
        </Section>

        <Section title="제9조 (서비스의 변경·중단)">
          <ul className="list-disc list-inside space-y-1">
            <li>
              운영자는 서비스의 전부 또는 일부를{' '}
              <strong style={{ color: '#111827' }}>사전 통보 없이 변경·중단·종료할 수 있으며,</strong>{' '}
              이로 인해 이용자에게 발생한 손해에 대해 책임을 지지 않습니다.
            </li>
            <li>
              서버 점검, 호스팅·외부 API(인스타그램, 지도 등) 장애, 자연재해 등 운영자의
              합리적 통제를 벗어난 사유로 서비스가 중단되는 경우 운영자는 책임을 지지
              않습니다.
            </li>
            <li>
              운영자는 게시물·이용 기록 등 서비스 내 데이터의 보존을 보장하지 않습니다.
              필요한 데이터는 이용자가 자체적으로 백업하여야 합니다.
            </li>
          </ul>
        </Section>

        <Section title="제10조 (광고 게재)">
          <p>
            서비스는 운영 유지를 위해 Google AdSense, Adsterra 등 제3자 광고를 게재할 수
            있습니다. 광고의 내용과 그로 인한 거래·피해에 대해서는 광고주가 책임을 지며,
            운영자는 광고 클릭으로 인해 발생한 손해에 대해 책임을 지지 않습니다. 광고
            관련 쿠키 처리는{' '}
            <Link href="/privacy" style={{ color: '#111827', textDecoration: 'underline' }}>
              개인정보처리방침
            </Link>
            을 참고하시기 바랍니다.
          </p>
        </Section>

        <Section title="제11조 (이용자 간 분쟁)">
          <p>
            서비스는 이용자 간 또는 이용자와 제3자(업장 등) 간의 분쟁에 개입할 의무를 지지
            않습니다. 분쟁이 발생할 경우 당사자 간 자율적으로 해결하여야 하며, 운영자는
            법령상 의무가 인정되는 범위 내에서 협조합니다.
          </p>
        </Section>

        <Section title="제12조 (면책 및 책임의 제한)">
          <ul className="list-disc list-inside space-y-1">
            <li>
              운영자는 천재지변, 불가항력, 이용자의 귀책 사유, 제3자 서비스(인스타그램,
              호스팅, 지도 등) 장애, 정부 조치 등으로 인해 발생한 손해에 대해 책임을 지지
              않습니다.
            </li>
            <li>
              서비스는 &quot;있는 그대로(as-is)&quot; 제공되며, 운영자는 서비스의 완전성,
              정확성, 특정 목적에의 적합성, 무중단성 등을 보장하지 않습니다.
            </li>
            <li>
              관련 법령상 강행 규정에 의해 책임이 인정되는 경우에도, 운영자의 손해배상
              책임은 <strong style={{ color: '#111827' }}>법령이 허용하는 범위 내 최소한으로 제한</strong>됩니다.
              특히 간접손해, 결과적 손해, 일실 이익, 데이터 손실에 대해서는 운영자가
              책임을 지지 않습니다.
            </li>
          </ul>
        </Section>

        <Section title="제13조 (준거법 및 재판 관할)">
          <ul className="list-disc list-inside space-y-1">
            <li>본 약관의 해석 및 서비스 이용과 관련된 분쟁에는 대한민국 법률이 적용됩니다.</li>
            <li>
              서비스 이용과 관련하여 발생한 분쟁에 대해 소를 제기하는 경우,{' '}
              <strong style={{ color: '#111827' }}>서울중앙지방법원을 제1심 전속 관할 법원으로 합니다.</strong>
            </li>
          </ul>
        </Section>

        <Section title="제14조 (문의)">
          <ul className="list-disc list-inside space-y-1">
            <li>
              일반 문의·건의·기능 제안:{' '}
              <a
                href="mailto:yangseonghwan119@gmail.com"
                style={{ color: '#111827', textDecoration: 'underline' }}
              >
                yangseonghwan119@gmail.com
              </a>
            </li>
            <li>
              업장 문의·스토리 삭제 요청·권리 침해 신고:{' '}
              <a
                href="mailto:contact@higgsi.com"
                style={{ color: '#111827', textDecoration: 'underline' }}
              >
                contact@higgsi.com
              </a>
            </li>
          </ul>
        </Section>
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
