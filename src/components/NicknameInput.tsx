'use client';

import { generateNickname } from '@/lib/nickname';

interface NicknameInputProps {
  nickname: string;
  password: string;
  onNicknameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
}

export default function NicknameInput({
  nickname,
  password,
  onNicknameChange,
  onPasswordChange,
}: NicknameInputProps) {
  function shuffle() {
    onNicknameChange(generateNickname());
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={nickname}
          onChange={(e) => onNicknameChange(e.target.value)}
          placeholder="닉네임"
          maxLength={20}
          className="flex-1 px-3 py-2 text-sm outline-none"
          style={{
            background: '#2a2d33',
            border: '1px solid #3a3d43',
            borderRadius: '8px',
            color: '#ffffff',
          }}
        />
        <button
          type="button"
          onClick={shuffle}
          className="px-3 py-2 text-sm flex-shrink-0"
          style={{
            background: '#2a2d33',
            border: '1px solid #3a3d43',
            borderRadius: '8px',
            color: '#F59E0B',
            cursor: 'pointer',
          }}
          title="닉네임 다시 생성"
        >
          🔀
        </button>
      </div>
      <input
        type="password"
        value={password}
        onChange={(e) => onPasswordChange(e.target.value)}
        placeholder="비밀번호 (4자 이상)"
        minLength={4}
        maxLength={20}
        className="px-3 py-2 text-sm outline-none"
        style={{
          background: '#2a2d33',
          border: '1px solid #3a3d43',
          borderRadius: '8px',
          color: '#ffffff',
        }}
      />
    </div>
  );
}
