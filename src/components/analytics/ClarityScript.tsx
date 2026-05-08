'use client';

import Script from 'next/script';

const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID;

export default function ClarityScript() {
  if (!CLARITY_ID) return null;
  if (process.env.NODE_ENV !== 'production') return null;
  return (
    <Script id="clarity-init" strategy="afterInteractive">
      {`(function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window, document, "clarity", "script", "${CLARITY_ID}");`}
    </Script>
  );
}
