import type { Metadata } from 'next';
import Link from 'next/link';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://honsulmap.com';

export const metadata: Metadata = {
  title: '자주 묻는 질문',
  description:
    '혼술맵 서비스에 대한 자주 묻는 질문 모음. 가게 제보·정보 수정, 글쓰기, 인스타 스토리 노출 관련 안내.',
  alternates: { canonical: '/faq' },
  openGraph: {
    title: '자주 묻는 질문 | 혼술맵',
    description: '혼술맵 사용법, 가게 제보, 정보 수정, 글쓰기 관련 자주 묻는 질문.',
    url: '/faq',
  },
};

interface QA {
  q: string;
  a: React.ReactNode;
  /** Plain-text answer used for the FAQPage JSON-LD (Schema.org requires
   * acceptedAnswer.text as a string, not JSX). */
  aText: string;
}

const FAQS: QA[] = [
  {
    q: '혼술맵은 어떤 서비스인가요?',
    a: '제주·서울의 혼술바와 게스트하우스를 지도 한 곳에 모으고, 각 매장 인스타 스토리를 자동으로 가져와 지금 분위기를 한눈에 보여주는 서비스입니다.',
    aText:
      '제주·서울의 혼술바와 게스트하우스를 지도 한 곳에 모으고, 각 매장 인스타 스토리를 자동으로 가져와 지금 분위기를 한눈에 보여주는 서비스입니다.',
  },
  {
    q: '혼술바와 게스트하우스는 어떻게 다른가요?',
    a: '혼술바는 바 테이블 중심으로 사장님이 자리를 안내하고 옆자리 손님과 짧은 대화가 자연스럽게 이어지는 작은 술집입니다. 게스트하우스는 여행자들이 머무는 숙소로, 거실이나 마당에서 술과 함께 다른 게스트들과 어울리는 공간입니다.',
    aText:
      '혼술바는 바 테이블 중심으로 사장님이 자리를 안내하고 옆자리 손님과 짧은 대화가 자연스럽게 이어지는 작은 술집입니다. 게스트하우스는 여행자들이 머무는 숙소로, 거실이나 마당에서 술과 함께 다른 게스트들과 어울리는 공간입니다.',
  },
  {
    q: '지도에 표시된 가게는 모두 영업 중인가요?',
    a: '등록 시점엔 영업 중이지만 폐업·휴업·운영시간 변경은 실시간 반영이 안 될 수 있습니다. 방문 전 가게 인스타 또는 전화로 확인을 권장합니다.',
    aText:
      '등록 시점엔 영업 중이지만 폐업·휴업·운영시간 변경은 실시간 반영이 안 될 수 있습니다. 방문 전 가게 인스타 또는 전화로 확인을 권장합니다.',
  },
  {
    q: '지도 마커 색이 뭘 의미하나요?',
    a: '파란색은 혼술바, 주황색은 게스트하우스입니다. 게스트하우스는 분위기 태그(파티/조용/일반)에 따라 마커 모양이 살짝 달라질 수 있습니다.',
    aText:
      '파란색은 혼술바, 주황색은 게스트하우스입니다. 게스트하우스는 분위기 태그(파티/조용/일반)에 따라 마커 모양이 살짝 달라질 수 있습니다.',
  },
  {
    q: '새로운 가게를 제보하려면?',
    a: '지도 위 "가게 제보" 버튼을 누르고 가게 이름·인스타 아이디·지역·카테고리를 입력해주세요. 운영자 확인 후 24~72시간 안에 등록됩니다.',
    aText:
      '지도 위 "가게 제보" 버튼을 누르고 가게 이름·인스타 아이디·지역·카테고리를 입력해주세요. 운영자 확인 후 24~72시간 안에 등록됩니다.',
  },
  {
    q: '가게 정보가 잘못돼있어요. 수정하려면?',
    a: (
      <>
        contact@higgsi.com 으로 가게 이름과 수정할 내용(주소, 영업시간, 인스타
        아이디 등)을 보내주세요. 사장님이라면 그렇게 명시해주시면 우선 처리합니다.
      </>
    ),
    aText:
      'contact@higgsi.com 으로 가게 이름과 수정할 내용(주소, 영업시간, 인스타 아이디 등)을 보내주세요. 사장님이라면 그렇게 명시해주시면 우선 처리합니다.',
  },
  {
    q: '내 가게 스토리가 사이트에 뜨는 게 싫어요.',
    a: (
      <>
        contact@higgsi.com 으로 가게 이름과 인스타 아이디를 보내주시면 즉시
        내립니다. 사유 설명은 필요 없습니다.
      </>
    ),
    aText:
      'contact@higgsi.com 으로 가게 이름과 인스타 아이디를 보내주시면 즉시 내립니다. 사유 설명은 필요 없습니다.',
  },
  {
    q: '글쓰기에 회원가입이 필요한가요?',
    a: '아니요. 닉네임과 비밀번호만 입력하면 누구나 글을 쓸 수 있습니다. 비밀번호는 본인 글 수정·삭제할 때만 쓰이고, 이메일이나 실명은 받지 않습니다.',
    aText:
      '아니요. 닉네임과 비밀번호만 입력하면 누구나 글을 쓸 수 있습니다. 비밀번호는 본인 글 수정·삭제할 때만 쓰이고, 이메일이나 실명은 받지 않습니다.',
  },
  {
    q: '비밀번호를 까먹었어요. 글 삭제 가능한가요?',
    a: '신고 버튼 또는 contact@higgsi.com 으로 문의해주시면 본인 확인 후 삭제 도와드립니다.',
    aText:
      '신고 버튼 또는 contact@higgsi.com 으로 문의해주시면 본인 확인 후 삭제 도와드립니다.',
  },
  {
    q: '후기 작성할 때 이미지 첨부할 수 있나요?',
    a: '네. 글쓰기 화면에서 최대 5장까지 사진을 첨부할 수 있습니다.',
    aText: '네. 글쓰기 화면에서 최대 5장까지 사진을 첨부할 수 있습니다.',
  },
  {
    q: '좋아요는 어떻게 작동하나요?',
    a: '익명 좋아요입니다. 브라우저 단위로 한 게시글당 한 번 누를 수 있습니다.',
    aText: '익명 좋아요입니다. 브라우저 단위로 한 게시글당 한 번 누를 수 있습니다.',
  },
  {
    q: '부적절한 게시글이나 댓글이 있으면?',
    a: '글·댓글 옆 "신고" 버튼으로 신고해주세요. 운영자가 검토 후 조치합니다.',
    aText: '글·댓글 옆 "신고" 버튼으로 신고해주세요. 운영자가 검토 후 조치합니다.',
  },
  {
    q: '가게 등록은 유료인가요?',
    a: '아니요. 모든 등록은 무료입니다. 가게 사장님이 추가 비용 내는 일은 없습니다.',
    aText:
      '아니요. 모든 등록은 무료입니다. 가게 사장님이 추가 비용 내는 일은 없습니다.',
  },
  {
    q: '지도에서 GPS 위치 권한이 필요한가요?',
    a: '"내 근처 가게 찾기" 기능 사용 시에만 필요합니다. 권한을 거부하셔도 지도와 가게 검색은 정상 동작합니다.',
    aText:
      '"내 근처 가게 찾기" 기능 사용 시에만 필요합니다. 권한을 거부하셔도 지도와 가게 검색은 정상 동작합니다.',
  },
  {
    q: '길찾기는 어디로 연결되나요?',
    a: '네이버 지도로 연결됩니다. 가게 카드의 "네이버지도" 버튼을 누르면 네이버 지도 앱(설치 시)이나 웹에서 길찾기가 열립니다.',
    aText:
      '네이버 지도로 연결됩니다. 가게 카드의 "네이버지도" 버튼을 누르면 네이버 지도 앱(설치 시)이나 웹에서 길찾기가 열립니다.',
  },
  {
    q: '게스트하우스 파티 일정은 어디서 볼 수 있나요?',
    a: '각 게스트하우스의 인스타 스토리에 보통 공지됩니다. 사이트 지도에서 게스트하우스 마커를 누르면 최신 스토리가 함께 표시됩니다.',
    aText:
      '각 게스트하우스의 인스타 스토리에 보통 공지됩니다. 사이트 지도에서 게스트하우스 마커를 누르면 최신 스토리가 함께 표시됩니다.',
  },
  {
    q: '혼자 가도 어색하지 않나요?',
    a: '혼술바는 처음부터 혼자 오는 손님을 전제로 자리·조명·음악이 설계된 공간입니다. 사장님과 한두 마디, 옆 손님과 가벼운 인사 정도로 자연스럽게 흐름을 탑니다.',
    aText:
      '혼술바는 처음부터 혼자 오는 손님을 전제로 자리·조명·음악이 설계된 공간입니다. 사장님과 한두 마디, 옆 손님과 가벼운 인사 정도로 자연스럽게 흐름을 탑니다.',
  },
  {
    q: '모바일에서만 되나요? PC에서도 보이나요?',
    a: '둘 다 됩니다. 모바일에 최적화돼 있어 PC에선 모바일 너비로 표시됩니다.',
    aText:
      '둘 다 됩니다. 모바일에 최적화돼 있어 PC에선 모바일 너비로 표시됩니다.',
  },
  {
    q: '제휴·기능 제안·문의는 어디로?',
    a: 'contact@higgsi.com 으로 메일 보내주시거나, 혼술맵 인스타 @honsulmap 으로 DM 주세요.',
    aText:
      'contact@higgsi.com 으로 메일 보내주시거나, 혼술맵 인스타 @honsulmap 으로 DM 주세요.',
  },
];

export default function FaqPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map(({ q, aText }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: aText,
      },
    })),
  };

  return (
    <div style={{ background: '#ffffff', minHeight: '100dvh' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
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
          자주 묻는 질문
        </span>
      </header>

      <div className="px-4 pt-6 pb-24" style={{ maxWidth: 720, margin: '0 auto' }}>
        <h1 className="text-xl font-bold mb-1" style={{ color: '#111827' }}>
          자주 묻는 질문
        </h1>
        <p className="text-xs mb-8" style={{ color: '#9ca3af' }}>
          혼술맵 서비스 이용에 자주 나오는 질문들
        </p>

        <ol className="flex flex-col gap-6">
          {FAQS.map((faq, i) => (
            <li key={i}>
              <h2
                className="font-bold text-[15px] mb-2"
                style={{ color: '#111827' }}
              >
                {i + 1}. {faq.q}
              </h2>
              <div
                className="text-sm leading-relaxed"
                style={{ color: '#374151' }}
              >
                {faq.a}
              </div>
            </li>
          ))}
        </ol>

        <p
          className="mt-12 text-xs"
          style={{ color: '#9ca3af', lineHeight: 1.6 }}
        >
          여기에 답이 없는 질문은 contact@higgsi.com 또는 혼술맵 인스타
          @honsulmap 으로 보내주세요.
        </p>
      </div>
    </div>
  );
}
