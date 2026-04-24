import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div style={{ background: '#ffffff', minHeight: '100dvh' }}>
      {/* Header */}
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
          개인정보처리방침
        </span>
      </header>

      <div className="px-4 pt-6 pb-24">
        <h1 className="text-xl font-bold mb-1" style={{ color: '#111827' }}>
          개인정보처리방침
        </h1>
        <p className="text-xs mb-8" style={{ color: '#9ca3af' }}>
          최종 업데이트: 2026년 4월 24일
        </p>

        <Section title="1. 서비스 소개">
          <p>
            <strong style={{ color: '#111827' }}>혼술맵</strong>은 제주도 혼술바 및
            게스트하우스의 인스타그램 스토리를 모아보고, 실시간 현황을 공유하는
            서비스입니다. 본 방침은 혼술맵(이하 &quot;서비스&quot;)이 수집하는 개인정보와
            그 처리 방법, 그리고 서비스가 다루는 데이터의 관리 방식을 안내합니다.
          </p>
        </Section>

        <Section title="2. 수집하는 개인정보 항목">
          <p className="mb-2">서비스 이용 시 아래 항목이 수집됩니다.</p>
          <Table
            rows={[
              ['닉네임', '게시글·댓글 작성 시 직접 입력', '게시글·댓글 표시'],
              ['비밀번호 (해시)', '게시글·댓글 작성 시 직접 입력', '본인 확인 및 삭제'],
              ['브라우저 핑거프린트', '서비스 접속 시 자동 생성', '좋아요·분위기투표 중복 방지'],
              ['접속 로그 (IP·UA)', '서버 요청 시 자동 수집', '부정 이용 방지 및 장애 대응'],
            ]}
          />
          <p className="mt-2 text-xs" style={{ color: '#9ca3af' }}>
            비밀번호는 단방향 암호화(해시) 처리되어 저장되며, 원문은 보관되지 않습니다.
            브라우저 핑거프린트는 UUID 형태로 로컬스토리지에 저장되며 개인을 특정하는 데
            사용되지 않습니다. 접속 로그는 호스팅 제공자(Vercel)의 시스템 로그에
            일시적으로 기록되며 마케팅 목적으로 활용되지 않습니다.
          </p>
        </Section>

        <Section title="3. 개인정보 수집·이용 목적">
          <ul className="list-disc list-inside space-y-1">
            <li>게시글 및 댓글 등록·수정·삭제 본인 확인</li>
            <li>좋아요 및 분위기 투표 기능의 중복 방지</li>
            <li>서비스 운영 및 부정 이용 방지</li>
            <li>장애 대응 및 보안 이슈 조사</li>
          </ul>
        </Section>

        <Section title="4. 개인정보 보유 및 이용 기간">
          <Table
            rows={[
              ['닉네임', '게시글·댓글 삭제 시 즉시 삭제'],
              ['비밀번호 해시', '게시글·댓글 삭제 시 즉시 삭제'],
              ['브라우저 핑거프린트', '사용자가 로컬스토리지 삭제 시 즉시 소멸'],
              ['접속 로그', '최대 30일, 이후 자동 파기'],
            ]}
            headers={['항목', '보유 기간']}
          />
          <p className="mt-2 text-xs" style={{ color: '#9ca3af' }}>
            서비스는 별도의 회원가입 절차가 없습니다. 게시글·댓글 삭제 시 관련 개인정보는
            즉시 파기됩니다.
          </p>
        </Section>

        <Section title="5. 인스타그램 스토리 수집 및 관리">
          <p className="mb-2">
            서비스는 제주도 혼술바·게스트하우스 등 업장의{' '}
            <strong style={{ color: '#111827' }}>공개 인스타그램 프로필</strong>에 게시된
            스토리만 수집하여 표시합니다. 비공개 계정, 개인 사용자 계정의 스토리는 수집
            대상이 아닙니다.
          </p>
          <ul className="list-disc list-inside space-y-1 mb-2">
            <li>
              수집 범위: 공개 프로필의 스토리 이미지·영상 및 게시 시각
            </li>
            <li>
              수집 방식: 인스타그램 공식 피드 API 호출 (별도의 이미지 가공·변형 없이 원본
              그대로 저장)
            </li>
            <li>
              보관 기간: 인스타그램의 &quot;하이라이트&quot; 기능과 동일하게 장기 보관 가능.
              다만 업장 또는 권리자의 삭제 요청 시 24시간 이내 파기합니다.
            </li>
          </ul>
          <p className="mb-2">
            스토리 이미지에 포함된 인물·상품 등의 공개 여부는 원 게시자(업장)의 결정에
            따르며, 서비스는 수집한 콘텐츠를 별도로 가공하지 않습니다. 업장에서 모자이크
            등 비식별 처리 후 게시한 경우 동일한 상태로 표시됩니다.
          </p>
          <p>
            업장·권리자·제3자의 <strong style={{ color: '#111827' }}>스토리 삭제 요청</strong>,
            게시글 신고, 권리 침해 신고는{' '}
            <a
              href="mailto:contact@higgsi.com"
              style={{ color: '#111827', textDecoration: 'underline' }}
            >
              contact@higgsi.com
            </a>
            으로 접수해 주시기 바랍니다. 접수 확인 후 24시간 이내에 처리합니다.
          </p>
        </Section>

        <Section title="6. 개인정보의 제3자 제공">
          <p>
            서비스는 수집된 개인정보를 원칙적으로 제3자에게 제공하지 않습니다. 다만 법령에
            의한 요청이 있는 경우 예외적으로 제공될 수 있습니다.
          </p>
        </Section>

        <Section title="7. 개인정보 처리 위탁">
          <p className="mb-2">
            서비스는 원활한 운영을 위해 아래와 같이 개인정보 처리를 위탁합니다.
          </p>
          <Table
            headers={['수탁자', '위탁 업무']}
            rows={[
              ['Supabase Inc.', '데이터베이스 저장·관리'],
              ['Vercel Inc.', '웹 호스팅 및 서버 로그'],
              ['Meta Platforms, Inc.', '인스타그램 공개 스토리 조회'],
              ['Google LLC (AdSense)', '맞춤 광고 게재'],
              ['Adsterra', '광고 게재'],
            ]}
          />
          <p className="mt-2 text-xs" style={{ color: '#9ca3af' }}>
            각 수탁자의 개인정보처리방침은{' '}
            <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#111827', textDecoration: 'underline' }}>Supabase</a>
            {' · '}
            <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" style={{ color: '#111827', textDecoration: 'underline' }}>Vercel</a>
            {' · '}
            <a href="https://privacycenter.instagram.com/policy" target="_blank" rel="noopener noreferrer" style={{ color: '#111827', textDecoration: 'underline' }}>Instagram</a>
            {' · '}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#111827', textDecoration: 'underline' }}>Google</a>
            {' · '}
            <a href="https://adsterra.com/privacy-policy/" target="_blank" rel="noopener noreferrer" style={{ color: '#111827', textDecoration: 'underline' }}>Adsterra</a>
            에서 확인하실 수 있습니다.
          </p>
        </Section>

        <Section title="8. 쿠키 및 광고">
          <p className="mb-2">
            서비스 자체는 별도의 쿠키를 설정하지 않으며, 기능 제공을 위해 브라우저
            로컬스토리지에 핑거프린트를 저장합니다.
          </p>
          <p className="mb-2">
            다만 서비스에 게재되는 제3자 광고 파트너(<strong style={{ color: '#111827' }}>Google
            AdSense</strong>, <strong style={{ color: '#111827' }}>Adsterra</strong>)는 광고 성과
            측정과 맞춤 광고 제공을 위해 쿠키·광고 ID·유사 기술을 사용할 수 있습니다. 이
            쿠키는 광고 파트너에 의해 관리되며, 서비스 운영자는 해당 정보에 접근하지
            않습니다.
          </p>
          <ul className="list-disc list-inside space-y-1 mb-2">
            <li>
              Google 맞춤 광고 거부:{' '}
              <a
                href="https://adssettings.google.com"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#111827', textDecoration: 'underline' }}
              >
                https://adssettings.google.com
              </a>
            </li>
            <li>
              제3자 벤더 광고 일괄 거부:{' '}
              <a
                href="https://optout.aboutads.info"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#111827', textDecoration: 'underline' }}
              >
                https://optout.aboutads.info
              </a>
            </li>
            <li>
              브라우저 쿠키 설정 변경: Chrome·Safari·Firefox 등 각 브라우저의 개인정보/쿠키
              설정에서 차단·삭제할 수 있습니다.
            </li>
          </ul>
          <p className="text-xs" style={{ color: '#9ca3af' }}>
            광고 쿠키를 거부해도 광고 게재 자체는 차단되지 않으며, 맞춤도가 낮아진 일반
            광고가 계속 표시될 수 있습니다.
          </p>
        </Section>

        <Section title="9. 이용자의 권리">
          <ul className="list-disc list-inside space-y-1">
            <li>
              게시글·댓글 삭제: 작성 시 입력한 비밀번호를 통해 직접 삭제할 수 있습니다.
            </li>
            <li>
              브라우저 핑거프린트 삭제: 브라우저 로컬스토리지에서{' '}
              <code
                className="px-1 py-0.5 text-xs"
                style={{ background: '#f3f4f6', borderRadius: '3px', color: '#111827' }}
              >
                honsul_fp
              </code>{' '}
              항목을 삭제하면 즉시 파기됩니다.
            </li>
            <li>
              스토리 삭제·권리 침해 신고: 업장 또는 권리자는{' '}
              <a
                href="mailto:contact@higgsi.com"
                style={{ color: '#111827', textDecoration: 'underline' }}
              >
                contact@higgsi.com
              </a>
              으로 요청하실 수 있으며, 접수 후 24시간 이내에 처리됩니다.
            </li>
            <li>
              광고 쿠키 거부: 위 8조의 링크를 통해 맞춤 광고를 거부할 수 있습니다.
            </li>
          </ul>
        </Section>

        <Section title="10. 개인정보 보호책임자 및 연락처">
          <Table
            headers={['구분', '연락처']}
            rows={[
              ['개인정보 보호책임자', '혼술맵 운영팀'],
              ['업장·권리자 문의 (스토리 삭제 등)', 'contact@higgsi.com'],
              ['일반 문의·건의·기능 제안', 'yangseonghwan119@gmail.com'],
            ]}
          />
          <p className="mt-2 text-xs" style={{ color: '#9ca3af' }}>
            개인정보 관련 문의·정정·삭제·처리 정지 요청은 업장 문의 이메일로 접수해
            주시면 지체 없이 처리하겠습니다.
          </p>
        </Section>

        <Section title="11. 방침 변경">
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
      <h2 className="font-bold text-base mb-2" style={{ color: '#111827' }}>
        {title}
      </h2>
      <div className="text-sm leading-relaxed" style={{ color: '#374151' }}>
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
      style={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
    >
      <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
        {headers && (
          <thead>
            <tr style={{ background: '#f8f9fa' }}>
              {headers.map((h, i) => (
                <th
                  key={i}
                  className="px-3 py-2 text-left font-semibold"
                  style={{ color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        )}
        {!headers && rows[0]?.length === 3 && (
          <thead>
            <tr style={{ background: '#f8f9fa' }}>
              {['항목', '수집 방법', '이용 목적'].map((h, i) => (
                <th
                  key={i}
                  className="px-3 py-2 text-left font-semibold"
                  style={{ color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}
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
              style={{ borderBottom: ri < rows.length - 1 ? '1px solid #f3f4f6' : 'none' }}
            >
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="px-3 py-2"
                  style={{ color: '#374151' }}
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
