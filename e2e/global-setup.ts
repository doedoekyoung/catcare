import { cleanupTestData } from './helpers/cleanup';

/**
 * 글로벌 셋업: 테스트 시작 전 기존 테스트 데이터 정리
 */
async function globalSetup() {
  try {
    await cleanupTestData();
    console.log('✅ Global setup: 테스트 데이터 정리 완료');
  } catch (e) {
    console.error('❌ Global setup 데이터 정리 실패:', e);
    // 정리 실패해도 테스트는 진행
  }
}

export default globalSetup;
