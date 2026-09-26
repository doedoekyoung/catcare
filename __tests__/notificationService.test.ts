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
const mockDismissNotificationAsync = jest.fn(() => Promise.resolve());

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: mockGetPermissionsAsync,
  requestPermissionsAsync: mockRequestPermissionsAsync,
  scheduleNotificationAsync: mockScheduleNotificationAsync,
  cancelScheduledNotificationAsync: mockCancelScheduledNotificationAsync,
  getAllScheduledNotificationsAsync: mockGetAllScheduledNotificationsAsync,
  setNotificationChannelAsync: mockSetNotificationChannelAsync,
  setBadgeCountAsync: mockSetBadgeCountAsync,
  dismissNotificationAsync: mockDismissNotificationAsync,
  AndroidImportance: { DEFAULT: 3, LOW: 2 },
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

// _lastDebug는 notificationService 모듈 레벨 변수라 이 파일 안의 모든 테스트가 공유한다
// (resetModules를 안 쓰므로). 그래서 "저장된 값 없음" 케이스는 setBadgeCount를 한 번도
// 호출하지 않은 이 시점(파일의 첫 describe)에서만 검증할 수 있다 — 반드시 최상단에 둘 것.
describe('배지 진단 정보 — 실기기에서 실패 원인을 바로 볼 수 있게 기록', () => {
  test('저장된 값이 없으면 null', async () => {
    expect(await svc.getBadgeDebugInfo()).toBeNull();
  });

  test('성공 시 outcome=success, 알림 id가 detail에 남음', async () => {
    mockCurrentOS = 'android';
    mockScheduleNotificationAsync.mockResolvedValueOnce('abc-123');
    await svc.setBadgeCount(3);

    const info = await svc.getBadgeDebugInfo();
    expect(info).toMatchObject({
      platform: 'android', remaining: 3, outcome: 'success', permission: 'granted',
    });
    expect(info.detail).toContain('abc-123');
  });

  test('실패 시 outcome=error, 실제 에러 메시지가 그대로 detail에 남음(삼켜지지 않음)', async () => {
    mockCurrentOS = 'android';
    mockScheduleNotificationAsync.mockImplementationOnce(() => Promise.reject(new Error('SecurityException: badge denied')));
    await svc.setBadgeCount(2);

    const info = await svc.getBadgeDebugInfo();
    expect(info).toMatchObject({ outcome: 'error' });
    expect(info.detail).toContain('SecurityException: badge denied');
  });

  test('권한이 거부 상태면 permission 필드에 그대로 반영', async () => {
    mockCurrentOS = 'ios';
    mockGetPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
    await svc.setBadgeCount(1);

    const info = await svc.getBadgeDebugInfo();
    expect(info.permission).toBe('denied');
  });

  test('웹은 skipped-web으로 기록', async () => {
    mockCurrentOS = 'web';
    await svc.setBadgeCount(5);
    const info = await svc.getBadgeDebugInfo();
    expect(info).toMatchObject({ outcome: 'skipped-web', permission: 'n/a' });
  });
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
    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
  });

  describe('iOS — 표준 APNs 배지 API 그대로 사용', () => {
    test('그대로 전달', async () => {
      mockCurrentOS = 'ios';
      await svc.setBadgeCount(3);
      expect(mockSetBadgeCountAsync).toHaveBeenCalledWith(3);
      expect(mockScheduleNotificationAsync).not.toHaveBeenCalled(); // 지속 알림 방식은 안드로이드 전용
    });

    test('음수는 0으로 클램프 — 계산 순서에 따라 done > total이 될 수 있음', async () => {
      mockCurrentOS = 'ios';
      await svc.setBadgeCount(-2);
      expect(mockSetBadgeCountAsync).toHaveBeenCalledWith(0);
    });

    test('setBadgeCountAsync가 실패해도 던지지 않음', async () => {
      mockCurrentOS = 'ios';
      mockSetBadgeCountAsync.mockImplementationOnce(() => Promise.reject(new Error('unsupported')));
      await expect(svc.setBadgeCount(1)).resolves.toBeUndefined();
    });
  });

  describe('Android — 조용한 지속 알림으로 setNumber 반영 (ShortcutBadger는 One UI 6.1+에서 무시됨)', () => {
    test('남은 게 있으면 채널을 만들고 고정 identifier로 알림을 예약(=교체)', async () => {
      mockCurrentOS = 'android';
      await svc.setBadgeCount(3);

      expect(mockSetBadgeCountAsync).not.toHaveBeenCalled(); // 안드로이드는 이 경로를 안 씀
      expect(mockSetNotificationChannelAsync).toHaveBeenCalledWith(
        'daily-status',
        expect.objectContaining({ importance: 2 })
      );
      expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(1);
      const [req]: any[] = mockScheduleNotificationAsync.mock.calls[0];
      expect(req.identifier).toBe('daily-status-badge'); // 같은 id → 쌓이지 않고 교체
      expect(req.content.badge).toBe(3);
      expect(req.content.sticky).toBe(true); // 스와이프로 안 지워짐 — 배지 신뢰성 확보
      expect(req.content.sound).toBe(false); // 조용히 — 매번 소리/진동 없음
      // { channelId }만 있는 트리거는 네이티브에서 "schedulable하지 않다"며 거부됨(실기기 확인).
      // seconds를 가진 TimeIntervalTrigger라야 스케줄 가능 — 그래서 반드시 seconds가 있어야 함.
      expect(req.trigger).toEqual({ seconds: 1, channelId: 'daily-status' });
    });

    test('0이면 새로 예약하지 않고 기존 알림을 지움', async () => {
      mockCurrentOS = 'android';
      await svc.setBadgeCount(0);

      expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
      expect(mockDismissNotificationAsync).toHaveBeenCalledWith('daily-status-badge');
    });

    test('음수도 0 취급 — 알림을 지움', async () => {
      mockCurrentOS = 'android';
      await svc.setBadgeCount(-1);
      expect(mockDismissNotificationAsync).toHaveBeenCalledWith('daily-status-badge');
    });

    test('예약 실패해도 던지지 않음', async () => {
      mockCurrentOS = 'android';
      mockScheduleNotificationAsync.mockImplementationOnce(() => Promise.reject(new Error('fail')));
      await expect(svc.setBadgeCount(2)).resolves.toBeUndefined();
    });
  });
});
