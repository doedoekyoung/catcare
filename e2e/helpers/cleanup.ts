import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env.local') });
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env.test') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
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

/**
 * 회원가입 테스트 계정을 완전히 삭제 (auth.users + public.users + household + 관련 데이터)
 * service_role 키로 admin API 사용
 */
export async function cleanupSignupTestUser(email: string) {
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. auth.users에서 해당 이메일의 유저 찾기
  const { data: { users } } = await admin.auth.admin.listUsers();
  const authUser = users.find((u) => u.email === email);
  if (!authUser) return;

  // 2. public.users에서 household_id 조회
  const { data: userData } = await admin
    .from('users')
    .select('household_id')
    .eq('uid', authUser.id)
    .single();

  // 3. household 관련 데이터 삭제
  if (userData?.household_id) {
    const hid = userData.household_id;
    for (const table of ['check_records', 'daily_logs', 'recipes', 'cats'] as const) {
      await admin.from(table).delete().eq('household_id', hid);
    }
    await admin.from('households').delete().eq('id', hid);
  }

  // 4. public.users 삭제
  await admin.from('users').delete().eq('uid', authUser.id);

  // 5. auth.users 삭제
  await admin.auth.admin.deleteUser(authUser.id);
}
