/**
 * 네이티브(iOS/Android) 환경에서 App이 마운트 단계에 throw하지 않는지 확인.
 * 웹 전용 API(window.location 등)를 가드 없이 호출하는 회귀(2026-04 안드로이드 크래시)
 * 같은 클래스의 버그를 첫 번째 방어선으로 잡는다.
 *
 * 한계: 실제 네이티브 모듈 통합·gradle 빌드는 검증하지 않음 — EAS 빌드 + 디바이스 검증과 함께 사용.
 */

// ⚠️ 최상단에서 `import { Platform } from 'react-native'`를 하지 않는다. 아래 테스트에서
// resetModules() 이후 그 참조를 뮤테이트하면, 이 파일 자체는 이전 "세대"의 react-native를
//붙든 채라 뮤테이션이 새로 require되는 App(과 그 내부 트리)에 반영되지 않는다 — 즉
// android/web 케이스가 실제로는 항상 기본값(ios)으로 실행되어 왔다(2026-09 확인).
// 반드시 resetModules() 다음에 require('react-native')로 "같은 세대"의 Platform을 얻어
// 그것을 뮤테이트해야 이후 require('../App')이 보는 것과 동일한 인스턴스가 된다.

// Supabase 클라이언트는 테스트 환경에서 실제 연결을 만들지 않도록 모킹
jest.mock('../src/services/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    },
    channel: jest.fn(() => ({ on: jest.fn().mockReturnThis(), subscribe: jest.fn() })),
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(() => Promise.resolve({ data: null, error: null })),
    })),
    removeChannel: jest.fn(),
  },
  TABLES: {},
}));

// authService의 유저 프로필 캐시가 AsyncStorage를 직접 쓴다 — jest에는 네이티브 모듈이 없어 공식 mock 사용
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// gesture-handler / reanimated 네이티브 의존성 — 테스트에서는 빈 stub
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: ({ children }: any) => children,
  Swipeable: ({ children }: any) => children,
}));
jest.mock('react-native-reanimated', () => ({}));
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  return {
    SafeAreaProvider: ({ children }: any) => React.createElement(React.Fragment, null, children),
    SafeAreaView: ({ children }: any) => React.createElement(React.Fragment, null, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

// React Navigation은 NavigationContainer + Stack을 마운트하므로 모킹
jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({ children }: any) => children,
  useNavigation: () => ({ navigate: jest.fn() }),
  useRoute: () => ({ params: {} }),
}));
jest.mock('@react-navigation/stack', () => ({
  createStackNavigator: () => {
    const React = require('react');
    return {
      Navigator: ({ children }: any) => React.createElement(React.Fragment, null, children),
      Screen: () => null,
    };
  },
}));
jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: () => {
    const React = require('react');
    return {
      Navigator: ({ children }: any) => React.createElement(React.Fragment, null, children),
      Screen: () => null,
    };
  },
}));

// expo-notifications 네이티브 모듈 모킹
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve([])),
}));

const PLATFORMS: Array<'ios' | 'android' | 'web'> = ['ios', 'android', 'web'];

describe('App startup smoke test (마운트 시 throw 없음)', () => {
  PLATFORMS.forEach((os) => {
    test(`${os}에서 App이 마운트 단계까지 throw하지 않음`, () => {
      // resetModules 먼저 → 이 세대의 react-native를 require해 뮤테이트 → 이후 같은 세대에서
      // require되는 App(및 그 내부 트리)이 전부 이 Platform.OS를 보게 된다.
      jest.resetModules();
      (require('react-native').Platform as any).OS = os;
      // require 시점에 모듈 평가, render 시점에 컴포넌트 함수 본문 실행 — 둘 다 검증
      const TestRenderer = require('react-test-renderer');
      const App = require('../App').default;
      expect(() => {
        const tree = TestRenderer.create(require('react').createElement(App));
        tree.unmount();
      }).not.toThrow();
    });
  });
});
