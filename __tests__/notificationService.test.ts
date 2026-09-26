// 일일 알림(오늘의 루틴 알림) 스케줄링 로직 단위 테스트.
// 핵심 검증: (1) 웹은 전부 no-op(예약 알림 미지원 — NotificationScheduler.web 모듈이 없어
// 실제로는 UnavailabilityError를 던짐), (2) 네이티브는 정확히 4개 시간대를 재예약,
// (3) 켜짐/꺼짐 상태가 AsyncStorage에 반영됨.
//
// Platform.OS는 getter로 노출해 테스트마다 mockCurrentOS만 바꾼다 — notificationService의
// 모든 분기가 "호출 시점"에 Platform.OS를 읽으므로 모듈을 다시 불러올 필요가 없다.
// (참고: `(Platform as any).OS = os` 후 jest.resetModules()로 다시 require하는 방식은 이
// 프로젝트의 jest-expo 환경에서 'react-native'가 함께 재적재되며 뮤테이션이 씹혀 항상 기본값
// (ios)으로 되돌아가는 것을 확인했다 — 그래서 여기선 쓰지 않는다.)

let mockCurrentOS: 'ios' | 'android' | 'web' = 'ios';

jest.mock('react-native', () => ({
  Platform: {
    get OS() { return mockCurrentOS; },
    select: (o: Record<string, unknown>) => o[mockCurrentOS] ?? (o as any).default,
  },
  AppState: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
}));

const mockScheduleNotificationAsync = jest.fn(() => Promise.resolve('id'));
const mockCancelScheduledNotificationAsync = jest.fn(() => Promise.resolve());
const mockGetAllScheduledNotificationsAsync = jest.fn(() =>
  Promise.resolve([{ identifier: 'old-1', content: { data: { tag: 'daily-routine-reminder' } } }])
);
const mockSetNotificationChannelAsync = jest.fn(() => Promise.resolve());
const mockGetPermissionsAsync = jest.fn(() => Promise.resolve({ status: 'granted' }));
const mockRequestPermissionsAsync = jest.fn(() => Promise.resolve({ status: 'granted' }));
const mockSetBadgeCountAsync = jest.fn(() => Promise.resolve(true));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: mockGetPermissionsAsync,
  requestPermissionsAsync: mockRequestPermissionsAsync,
  scheduleNotificationAsync: mockScheduleNotificationAsync,
  cancelScheduledNotificationAsync: mockCancelScheduledNotificationAsync,
  getAllScheduledNotificationsAsync: mockGetAllScheduledNotificationsAsync,
  setNotificationChannelAsync: mockSetNotificationChannelAsync,
  setBadgeCountAsync: mockSetBadgeCountAsync,
  AndroidImportance: { DEFAULT: 3 },
}));

const mockStore = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (k: string) => Promise.resolve(mockStore.get(k) ?? null),
  setItem: (k: string, v: string) => { mockStore.set(k, v); return Promise.resolve(); },
  removeItem: (k: string) => { mockStore.delete(k); return Promise.resolve(); },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const svc = require('../src/services/notificationService');

beforeEach(() => {
  mockStore.clear();
  jest.clearAllMocks();
  mockCurrentOS = 'ios';
});

describe('플랫폼별 동작', () => {
  test('웹에서는 모두 no-op — 예약/취소/on-off 조회 모두 native API를 부르지 않음', async () => {
    mockCurrentOS = 'web';
    await svc.scheduleDailyReminders();
    await svc.cancelDailyReminders();
    await svc.setDailyRemindersEnabled(true);
    const enabled = await svc.areDailyRemindersEnabled();
    const granted = await svc.requestPermissions();

    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
    expect(mockCancelScheduledNotificationAsync).not.toHaveBeenCalled();
    expect(enabled).toBe(false);
    expect(granted).toBe(false);
  });

  test('iOS: 기존 예약을 취소하고 정해진 4개 시간대(9/11/18/21시)로 재예약', async () => {
    mockCurrentOS = 'ios';
    await svc.scheduleDailyReminders();

    expect(svc.DAILY_REMINDER_HOURS).toEqual([9, 11, 18, 21]);
    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith('old-1');
    expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(4);
    const hours = mockScheduleNotificationAsync.mock.calls
      .map((c: any) => c[0].trigger.hour)
      .sort((a: number, b: number) => a - b);
    expect(hours).toEqual([9, 11, 18, 21]);
    // 매번 같은 태그로 예약 — 다음 재예약 때 우리 알림만 골라 취소할 수 있어야 함
    mockScheduleNotificationAsync.mock.calls.forEach((c: any) => {
      expect(c[0].content.data.tag).toBe('daily-routine-reminder');
      expect(c[0].trigger.channelId).toBeUndefined(); // iOS는 channelId 불필요
    });
  });

  test('Android: 채널을 만들고 trigger에 channelId를 포함', async () => {
    mockCurrentOS = 'android';
    await svc.scheduleDailyReminders();

    expect(mockSetNotificationChannelAsync).toHaveBeenCalledWith(
      'daily-routine-reminder',
      expect.objectContaining({ importance: 3 })
    );
    expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(4);
    mockScheduleNotificationAsync.mock.calls.forEach((c: any) => {
      expect(c[0].trigger.channelId).toBe('daily-routine-reminder');
    });
  });
});

describe('켜짐/꺼짐 저장', () => {
  test('기본값은 켜짐(저장된 값 없음)', async () => {
    expect(await svc.areDailyRemindersEnabled()).toBe(true);
  });

  test('끄면 취소만 하고 재예약하지 않음, 이후 조회도 꺼짐으로 반영', async () => {
    await svc.setDailyRemindersEnabled(false);

    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalled();
    expect(await svc.areDailyRemindersEnabled()).toBe(false);
  });

  test('켜면 다시 4개를 예약', async () => {
    await svc.setDailyRemindersEnabled(false);
    jest.clearAllMocks();
    await svc.setDailyRemindersEnabled(true);

    expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(4);
    expect(await svc.areDailyRemindersEnabled()).toBe(true);
  });
});

describe('배지(오늘 남은 할 일 수)', () => {
  test('웹에서는 no-op', async () => {
    mockCurrentOS = 'web';
    await svc.setBadgeCount(3);
    expect(mockSetBadgeCountAsync).not.toHaveBeenCalled();
  });

  test('네이티브에서는 그대로 전달', async () => {
    await svc.setBadgeCount(3);
    expect(mockSetBadgeCountAsync).toHaveBeenCalledWith(3);
  });

  test('음수는 0으로 클램프 — 계산 순서에 따라 done > total이 될 수 있음', async () => {
    await svc.setBadgeCount(-2);
    expect(mockSetBadgeCountAsync).toHaveBeenCalledWith(0);
  });

  test('setBadgeCountAsync가 실패해도 던지지 않음', async () => {
    mockSetBadgeCountAsync.mockImplementationOnce(() => Promise.reject(new Error('launcher unsupported')));
    await expect(svc.setBadgeCount(1)).resolves.toBeUndefined();
  });
});
