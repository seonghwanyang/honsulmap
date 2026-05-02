import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

const PRETENDARD_BLACK_URL =
  'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/public/static/Pretendard-Black.otf';

export default async function AppleIcon() {
  const fontData = await fetch(PRETENDARD_BLACK_URL).then((r) => r.arrayBuffer());

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#000000',
          color: '#ffffff',
          fontFamily: 'Pretendard',
          fontWeight: 900,
          letterSpacing: '-0.04em',
        }}
      >
        <span style={{ fontSize: 130, lineHeight: 1 }}>혼</span>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: 'Pretendard',
          data: fontData,
          weight: 900,
          style: 'normal',
        },
      ],
    },
  );
}
