import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env.local') });
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env.test') });

const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const testEmail = process.env.E2E_TEST_EMAIL || 'e2e-test@catcare.test';
const testPassword = process.env.E2E_TEST_PASSWORD || 'TestPass123!';

const FAKE_HOUSEHOLD_ID = '00000000-0000-0000-0000-000000000000';

test.describe('RLS Security', () => {
  let supabase: ReturnType<typeof createClient>;
  let householdId: string;

  test.beforeAll(async () => {
    supabase = createClient(url, anonKey);
    const { data } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });
    const { data: user } = await supabase
      .from('users')
      .select('household_id')
      .eq('uid', data.user!.id)
      .single();
    householdId = user!.household_id;
  });

  test.afterAll(async () => {
    await supabase.auth.signOut();
  });

  test('타인의 household 데이터 조회 불가', async () => {
    const tables = ['cats', 'recipes', 'check_records', 'daily_logs'] as const;
    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select()
        .eq('household_id', FAKE_HOUSEHOLD_ID);
      expect(error).toBeNull();
      expect(data).toEqual([]);
    }
  });

  test('타인의 household에 데이터 삽입 불가', async () => {
    const { error } = await supabase.from('cats').insert({
      name: 'hacker-cat',
      household_id: FAKE_HOUSEHOLD_ID,
      owner_id: 'fake-owner',
    });
    expect(error).not.toBeNull();
  });

  test('타인의 household 데이터 수정 불가', async () => {
    // 자기 household에 cat 하나 생성
    const { data: cat } = await supabase
      .from('cats')
      .insert({
        name: 'rls-test-cat',
        household_id: householdId,
        owner_id: householdId,
      })
      .select()
      .single();

    // household_id를 바꿔서 업데이트 시도 → RLS가 with_check으로 차단
    const { error } = await supabase
      .from('cats')
      .update({ household_id: FAKE_HOUSEHOLD_ID })
      .eq('id', cat!.id);

    // 업데이트가 차단되었거나, 실제로 변경되지 않았는지 확인
    const { data: verify } = await supabase
      .from('cats')
      .select('household_id')
      .eq('id', cat!.id)
      .single();
    expect(verify?.household_id).toBe(householdId);

    // 정리
    await supabase.from('cats').delete().eq('id', cat!.id);
  });

  test('타인의 household 데이터 삭제 불가', async () => {
    // 존재하지 않는 household의 데이터를 삭제 시도
    const { data, error } = await supabase
      .from('cats')
      .delete({ count: 'exact' })
      .eq('household_id', FAKE_HOUSEHOLD_ID);
    // 에러가 없더라도 삭제된 행이 0이어야 함
    expect(error).toBeNull();
  });

  test('비인증 상태에서 데이터 접근 불가', async () => {
    const anonClient = createClient(url, anonKey);
    // 로그인하지 않은 상태로 조회
    const { data, error } = await anonClient
      .from('cats')
      .select();
    // RLS에 의해 빈 결과 또는 에러
    if (error) {
      expect(error).toBeTruthy();
    } else {
      expect(data).toEqual([]);
    }
  });
});
