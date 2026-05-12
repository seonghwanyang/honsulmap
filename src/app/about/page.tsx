import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '혼술맵 소개',
  description:
    '혼술맵은 제주도 혼술바·게스트하우스의 인스타그램 스토리를 지도 한 곳에 모아, 지금 어디가 활기찬지 한눈에 보여주는 서비스입니다.',
  alternates: { canonical: '/about' },
  openGraph: {
    title: '혼술맵 소개',
    description:
      '제주 혼술바·게스트하우스의 실시간 분위기를 지도 위에서 확인하세요. 혼자 가도 어색하지 않은 공간들을 모았습니다.',
    url: '/about',
  },
};

export default function AboutPage() {
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
          혼술맵 소개
        </span>
      </header>

      <div className="px-4 pt-6 pb-24" style={{ maxWidth: 720, margin: '0 auto' }}>
        <h1 className="text-xl font-bold mb-1" style={{ color: '#111827' }}>
          혼술맵 소개
        </h1>
        <p className="text-xs mb-8" style={{ color: '#9ca3af' }}>
          제주 혼술바·게스트하우스의 실시간 분위기 지도
        </p>

        <Section title="혼술바라는 공간">
          <p className="mb-3">
            <strong style={{ color: '#111827' }}>혼술바는 혼자 가도, 옆자리와 자연스럽게 대화가 이어지는 공간입니다.</strong>{' '}
            바 테이블에 나란히 앉아 같은 술을 마시다 보면, 사장님이 한마디 거들고
            옆 손님과 자연스럽게 이야기가 시작됩니다. 사장님들도 그걸 알기에
            자리 배치, 조명, 음악, 술 추천 하나하나를 그런 흐름이 잘 나오도록
            설계해둡니다.
          </p>
          <p>
            그래서 혼술바에 갈 땐 단순히 &quot;술이 맛있는 곳&quot;을 찾는 것보다,
            <strong style={{ color: '#111827' }}> 지금 그곳의 분위기가 어떤지</strong>가
            더 중요합니다. 누가 와 있는지, 자리가 얼마나 차 있는지, 활기찬지
            차분한지. 분위기에 따라 그날 저녁의 결이 완전히 달라지니까요.
          </p>
        </Section>

        <Section title="혼술맵이 하는 일">
          <p className="mb-3">
            많은 혼술바와 게스트하우스가 인스타그램 스토리로 매장의 실시간
            분위기를 올립니다. 오늘 어떤 손님이 와 있는지, 어떤 음악이 흐르는지,
            바 자리가 비었는지. 가게 입장에서도 손님을 끌어들이는 가장 빠른
            창구입니다.
          </p>
          <p className="mb-3">
            문제는 그 정보가 <strong style={{ color: '#111827' }}>각 매장의 인스타 계정에 흩어져 있다는 점</strong>입니다.
            가고 싶은 곳을 일일이 팔로우하고, 스토리를 하나씩 넘겨봐야 합니다.
            제주처럼 가게가 곳곳에 흩어진 동네에서는 더 번거롭습니다.
          </p>
          <p>
            혼술맵은 제주 전역의 혼술바·게스트하우스 공개 스토리를 지도 한 곳에
            모았습니다. <strong style={{ color: '#111827' }}>지금 어디가 활기찬지, 어디가 한산한지 지도에서 한눈에</strong>{' '}
            확인할 수 있고, 마음에 드는 곳을 골라 바로 길찾기로 이어집니다.
          </p>
        </Section>

        <Section title="커뮤니티">
          <p className="mb-3">
            지도 위 스토리만으로는 부족한 정보들이 있습니다. &quot;방금 다녀왔는데
            오늘은 좀 조용해요&quot;, &quot;여기는 와인이 진짜 괜찮아요&quot;,
            &quot;게하 파티 일정 공유합니다&quot; 같은 것들이요.
          </p>
          <p>
            <Link href="/community" style={{ color: '#111827', textDecoration: 'underline' }}>커뮤니티</Link>는
            방문자끼리 실시간 현황, 후기, 작은 꿀팁을 자유롭게 나누는 공간입니다.
            <strong style={{ color: '#111827' }}> 로그인 없이 닉네임만으로 누구나</strong> 글을 남길 수 있고,
            실명·이메일 같은 개인 정보는 받지 않습니다.
          </p>
        </Section>

        <Section title="운영 정보">
          <p className="mb-2">본 사이트는 개인이 운영합니다.</p>
          <ul className="list-disc list-inside space-y-1 mb-3">
            <li>운영자: <strong style={{ color: '#111827' }}>honsulmap</strong></li>
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
              업장 문의·스토리 삭제 요청:{' '}
              <a
                href="mailto:contact@higgsi.com"
                style={{ color: '#111827', textDecoration: 'underline' }}
              >
                contact@higgsi.com
              </a>
            </li>
          </ul>
          <p className="text-xs" style={{ color: '#9ca3af' }}>
            서비스 이용과 관련된 약관은{' '}
            <Link href="/terms" style={{ color: '#374151', textDecoration: 'underline' }}>
              이용약관
            </Link>
            을, 데이터 처리에 관한 안내는{' '}
            <Link href="/privacy" style={{ color: '#374151', textDecoration: 'underline' }}>
              개인정보처리방침
            </Link>
            을 참고하세요.
          </p>
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
