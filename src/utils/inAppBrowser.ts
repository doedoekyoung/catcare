// 웹에서 한국 인앱 브라우저(네이버·카카오톡·인스타·페이스북 등) 감지 및 외부 브라우저 유도.
// 인앱 브라우저는 localStorage/쿠키 제약, PWA 설치 불가, OAuth 리다이렉트 차단 등 이슈가 많아
// 외부 브라우저(Chrome/Safari)로 유도하는 것이 표준 패턴.

import { Platform } from 'react-native';

export interface InAppBrowserInfo {
  isInApp: boolean;
  name: string;
  isIOS: boolean;
  isAndroid: boolean;
}

export function detectInAppBrowser(): InAppBrowserInfo {
  const none: InAppBrowserInfo = { isInApp: false, name: '', isIOS: false, isAndroid: false };
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return none;

  const ua = navigator.userAgent ?? '';
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);

  // 주요 한국/글로벌 인앱 브라우저 식별자
  const patterns: Array<[RegExp, string]> = [
    [/NAVER\(inapp/i, '네이버'],
    [/KAKAOTALK/i, '카카오톡'],
    [/Instagram/i, '인스타그램'],
    [/FBAN|FBAV|FB_IAB/i, '페이스북'],
    [/Line\//i, '라인'],
    [/KAKAOSTORY/i, '카카오스토리'],
    [/; wv\)/i, 'WebView'], // Android WebView 일반
  ];

  for (const [re, name] of patterns) {
    if (re.test(ua)) return { isInApp: true, name, isIOS, isAndroid };
  }
  return none;
}

// 현재 URL을 외부 브라우저로 여는 시도.
// Android: Chrome intent URI로 직접 실행 가능 (인앱에 따라 동작 여부 다름)
// iOS: 범용 방법 없음 → URL 복사 + 안내
export function openInExternalBrowser(url: string, info: InAppBrowserInfo): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;

  // 네이버 인앱은 전용 스킴 지원
  if (info.name === '네이버') {
    window.location.href = `naversearchapp://inappbrowser/close?url=${encodeURIComponent(url)}&target=new`;
    return;
  }

  if (info.isAndroid) {
    // Chrome intent URI — 대부분의 Android 인앱에서 동작
    const clean = url.replace(/^https?:\/\//, '');
    window.location.href = `intent://${clean}#Intent;scheme=https;package=com.android.chrome;end`;
    return;
  }

  // iOS / 기타: URL 복사 유도 (호출부에서 안내 UI 표시)
}

export async function copyUrl(url: string): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}
