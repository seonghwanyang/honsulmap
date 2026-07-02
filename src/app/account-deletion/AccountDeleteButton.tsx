'use client';

import { useEffect, useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase/client';

// 로그인 상태면 앱 안에서 바로 계정을 삭제하는 버튼 (App Store 5.1.1(v)).
// 비로그인 상태면 안내만 표시하고, 아래 이메일 절차가 대체 경로가 된다.
export default function AccountDeleteButton() {
  const [state, setState] = useState<
    'loading' | 'anon' | 'idle' | 'confirm' | 'deleting' | 'done'
  >('loading');
  const [err, setErr] = useState('');

  useEffect(() => {
    createBrowserSupabase()
      .auth.getUser()
      .then(({ data }) => setState(data.user ? 'idle' : 'anon'))
      .catch(() => setState('anon'));
  }, []);

  async function remove() {
    setState('deleting');
    setErr('');
    try {
      const res = await fetch('/api/me/account', { method: 'DELETE' });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || '삭제에 실패했습니다.');
      }
      await createBrowserSupabase().auth.signOut().catch(() => {});
      setState('done');
      setTimeout(() => {
        window.location.href = '/';
      }, 1800);
    } catch (e) {
      setErr((e as Error).message);
      setState('confirm');
    }
  }

  if (state === 'loading') return null;

  const box: React.CSSProperties = {
    border: '1px solid #fecaca',
    background: '#fef2f2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  };

  if (state === 'anon') {
    return (
      <div style={box}>
        <div style={{ fontSize: 13, color: '#991b1b', lineHeight: 1.6 }}>
          로그인한 상태에서 이 화면을 열면 <strong>여기서 바로 계정을 삭제</strong>할 수
          있습니다. (앱에서 로그인 후 다시 들어와 주세요.)
        </div>
      </div>
    );
  }

  if (state === 'done') {
    return (
      <div style={box}>
        <div style={{ fontSize: 14, color: '#991b1b', fontWeight: 600 }}>
          계정이 삭제되었습니다. 잠시 후 홈으로 이동합니다.
        </div>
      </div>
    );
  }

  return (
    <div style={box}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#991b1b', marginBottom: 6 }}>
        계정 바로 삭제
      </div>
      <div style={{ fontSize: 12.5, color: '#7f1d1d', lineHeight: 1.6, marginBottom: 12 }}>
        계정과 관련 데이터(이메일·이름·찜·프로필)가 즉시 영구 삭제되며 되돌릴 수 없습니다.
      </div>

      {state === 'idle' && (
        <button
          onClick={() => setState('confirm')}
          style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
        >
          내 계정 삭제하기
        </button>
      )}

      {state === 'confirm' && (
        <div>
          <div style={{ fontSize: 13, color: '#991b1b', fontWeight: 600, marginBottom: 10 }}>
            정말 삭제할까요? 이 작업은 되돌릴 수 없습니다.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={remove}
              style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
            >
              삭제 확정
            </button>
            <button
              onClick={() => setState('idle')}
              style={{ background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 10, padding: '11px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {state === 'deleting' && <div style={{ fontSize: 13, color: '#991b1b' }}>삭제 중…</div>}

      {err && <div style={{ fontSize: 12.5, color: '#dc2626', marginTop: 10 }}>{err}</div>}
    </div>
  );
}
