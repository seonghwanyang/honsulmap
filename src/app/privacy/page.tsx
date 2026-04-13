import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div style={{ background: '#16191E', minHeight: '100dvh', paddingBottom: '72px' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-20 flex items-center gap-3 px-4"
        style={{
          height: '52px',
          background: '#16191E',
          borderBottom: '1px solid #2a2d33',
        }}
      >
        <Link
          href="/"
          className="flex items-center gap-1 text-sm"
          style={{ color: '#aaaaaa' }}
        >
          ← 뒤로
        </Link>
        <span className="font-semibold text-sm" style={{ color: '#ffffff' }}>
          개인정보처리방침
        </span>
      </header>

      <div className="px-4 pt-6 pb-10">
        <h1 className="text-xl font-bold mb-1" style={{ color: '#ffffff' }}>
          개인정보처리방침
        </h1>
        <p className="text-xs mb-8" style={{ color: '#888888' }}>
          최종 업데이트: 2026년 4월 13일
        </p>

        <Section title="1. 서비스 소개">
          <p>
            <strong style={{ color: '#F59E0B' }}>제주혼술</strong>은 제주도 혼술바 및
            게스트하우스의 인스타그램 스토리를 모아보고, 실시간 현황을 공유하는
            서비스입니다. 본 방침은 제주혼술(이하 "서비스")이 수집하는 개인정보와
            그 처리 방법을 안내합니다.
          </p>
        </Section>

        <Section title="2. 수집하는 개인정보 항목">
          <p className="mb-2">서비스 이용 시 아래 항목이 수집됩니다.</p>
          <Table
            rows={[
              ['닉네임', '게시글·댓글 작성 시 직접 입력', '게시글·댓글 표시'],
              ['비밀번호 (해시)', '게시글·댓글 작성 시 직접 입력', '본인 확인 및 삭제'],
              ['브라우저 핑거프린트', '서비스 접속 시 자동 생성', '좋아요·분위기투표 중복 방지'],
            ]}
          />
          <p className="mt-2 text-xs" style={{ color: '#888888' }}>
            비밀번호는 단방향 암호화(해시) 처리되어 저장되며, 원문은 보관되지 않습니다.
            브라우저 핑거프린트는 UUID 형태로 로컬스토리지에 저장되며 개인을 특정하는 데
            사용되지 않습니다.
          </p>
        </Section>

        <Section title="3. 개인정보 수집·이용 목적">
          <ul className="list-disc list-inside space-y-1">
            <li>게시글 및 댓글 등록·수정·삭제 본인 확인</li>
            <li>좋아요 및 분위기 투표 기능의 중복 방지</li>
            <li>서비스 운영 및 부정 이용 방지</li>
          </ul>
        </Section>

        <Section title="4. 개인정보 보유 및 이용 기간">
          <Table
            rows={[
              ['닉네임', '게시글·댓글 삭제 시 즉시 삭제'],
              ['비밀번호 해시', '게시글·댓글 삭제 시 즉시 삭제'],
              ['브라우저 핑거프린트', '사용자가 로컬스토리지 삭제 시 즉시 소멸'],
            ]}
            headers={['항목', '보유 기간']}
          />
          <p className="mt-2 text-xs" style={{ color: '#888888' }}>
            서비스는 별도의 회원가입 절차가 없습니다. 게시글·댓글 삭제 시 관련 개인정보는
            즉시 파기됩니다.
          </p>
        </Section>

        <Section title="5. 개인정보의 제3자 제공">
          <p>
            서비스는 수집된 개인정보를 원칙적으로 제3자에게 제공하지 않습니다. 다만 법령에
            의한 요청이 있는 경우 예외적으로 제공될 수 있습니다.
          </p>
        </Section>

        <Section title="6. 개인정보 처리 위탁">
          <p>
            서비스는 데이터베이스 운영을 위해{' '}
            <strong style={{ color: '#ffffff' }}>Supabase Inc.</strong>에 개인정보 처리를
            위탁합니다. 위탁 내용: 데이터 저장 및 관리. Supabase의 개인정보 처리방침은{' '}
            <a
              href="https://supabase.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#F59E0B', textDecoration: 'underline' }}
            >
              https://supabase.com/privacy
            </a>
            에서 확인하실 수 있습니다.
          </p>
        </Section>

        <Section title="7. 이용자의 권리">
          <ul className="list-disc list-inside space-y-1">
            <li>
              게시글·댓글 삭제: 작성 시 입력한 비밀번호를 통해 직접 삭제할 수 있습니다.
            </li>
            <li>
              브라우저 핑거프린트 삭제: 브라우저 로컬스토리지에서{' '}
              <code
                className="px-1 py-0.5 text-xs"
                style={{ background: '#2a2d33', borderRadius: '3px', color: '#F59E0B' }}
              >
                honsul_fp
              </code>{' '}
              항목을 삭제하면 즉시 파기됩니다.
            </li>
          </ul>
        </Section>

        <Section title="8. 쿠키 및 유사 기술">
          <p>
            서비스는 별도의 쿠키를 사용하지 않습니다. 다만 브라우저 로컬스토리지를 통해
            핑거프린트를 저장합니다. 이는 서비스 기능 제공을 위한 최소한의 정보로,
            마케팅·광고 목적으로는 사용되지 않습니다.
          </p>
        </Section>

        <Section title="9. 개인정보 보호책임자">
          <p>
            개인정보 관련 문의는 서비스 내 이메일 또는 커뮤니티 게시판을 통해
            연락해 주시기 바랍니다.
          </p>
        </Section>

        <Section title="10. 방침 변경">
          <p>
            본 개인정보처리방침은 법령·서비스 변경에 따라 개정될 수 있으며, 개정 시
            서비스 내 공지를 통해 안내합니다.
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
      <h2 className="font-bold text-base mb-2" style={{ color: '#ffffff' }}>
        {title}
      </h2>
      <div className="text-sm leading-relaxed" style={{ color: '#cccccc' }}>
        {children}
      </div>
    </section>
  );
}

function Table({
  rows,
  headers,
}: {
  rows: string[][];
  headers?: string[];
}) {
  return (
    <div
      className="overflow-x-auto"
      style={{ borderRadius: '8px', border: '1px solid #2a2d33' }}
    >
      <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
        {headers && (
          <thead>
            <tr style={{ background: '#2a2d33' }}>
              {headers.map((h, i) => (
                <th
                  key={i}
                  className="px-3 py-2 text-left font-semibold"
                  style={{ color: '#aaaaaa', borderBottom: '1px solid #3a3d43' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        )}
        {!headers && rows[0]?.length === 3 && (
          <thead>
            <tr style={{ background: '#2a2d33' }}>
              {['항목', '수집 방법', '이용 목적'].map((h, i) => (
                <th
                  key={i}
                  className="px-3 py-2 text-left font-semibold"
                  style={{ color: '#aaaaaa', borderBottom: '1px solid #3a3d43' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              style={{ borderBottom: ri < rows.length - 1 ? '1px solid #2a2d33' : 'none' }}
            >
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="px-3 py-2"
                  style={{ color: '#cccccc' }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
