// src/services/analyticsService.ts
// GA4 이벤트 로깅 — web/index.html에 gtag 스크립트가 주입되어 있어야 함

export function logEvent(eventName: string, params?: Record<string, unknown>) {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', eventName, params);
  }
}
