import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env.local') });
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env.test') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const testEmail = process.env.E2E_TEST_EMAIL || 'e2e-test@catcare.test';
const testPassword = process.env.E2E_TEST_PASSWORD || 'TestPass123!';

/**
 * 테스트 계정의 모든 데이터(cats, recipes, checks, logs)를 Supabase API로 직접 삭제.
 */
export async function cleanupTestData() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1. 테스트 계정으로 로그인
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });
  if (authError) throw new Error(`Cleanup login failed: ${authError.message}`);

  const userId = authData.user!.id;

  // 2. 사용자의 household 조회
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('household_id')
    .eq('uid', userId)
    .single();

  if (userError || !userData?.household_id) {
    console.log(`Cleanup: No household found (${userError?.message ?? 'no data'})`);
    await supabase.auth.signOut();
    return;
  }

  const householdId = userData.household_id;

  // 3. household의 모든 데이터 삭제 (순서: checks → logs → recipes → cats)
  const tables = ['check_records', 'daily_logs', 'recipes', 'cats'] as const;
  for (const table of tables) {
    const { error, count } = await supabase
      .from(table)
      .delete({ count: 'exact' })
      .eq('household_id', householdId);
    if (error) {
      console.error(`Cleanup ${table} failed:`, error.message);
    } else {
      console.log(`Cleanup ${table}: ${count ?? 0} rows deleted`);
    }
  }

  await supabase.auth.signOut();
}
