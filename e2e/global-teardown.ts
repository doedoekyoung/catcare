import { cleanupTestData } from './helpers/cleanup';

/**
 * 글로벌 teardown: 테스트 데이터 정리
 */
async function globalTeardown() {
  try {
    await cleanupTestData();
    console.log('🧹 Global teardown: 테스트 데이터 정리 완료');
  } catch (e) {
    console.error('❌ Global teardown 데이터 정리 실패:', e);
  }
}

export default globalTeardown;
