// 공유 링크 RPC end-to-end 검증.
// 테스트 계정 로그인 → household share_token 발급 → anon 키로 RPC 3종 호출 검증.
// 실행: node e2e/scripts/verify-share-rpc.mjs

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

function loadEnv(file) {
  const p = path.resolve(process.cwd(), file);
  if (!fs.existsSync(p)) return {};
  return Object.fromEntries(
    fs.readFileSync(p, 'utf8').split('\n')
      .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
      .map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      })
  );
}

const env = { ...loadEnv('.env.local'), ...loadEnv('.env.test') };
const url = env.EXPO_PUBLIC_SUPABASE_URL;
const anon = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const testEmail = env.E2E_TEST_EMAIL;
const testPassword = env.E2E_TEST_PASSWORD;

if (!url || !anon) { console.error('✗ SUPABASE URL/KEY 없음'); process.exit(1); }

const anonClient = createClient(url, anon);

async function main() {
  console.log('• Supabase:', url.replace(/https:\/\//, ''));

  // 1) 함수 존재 검증 (잘못된 토큰 → null)
  const { data: bad, error: badErr } = await anonClient.rpc('share_get_data', {
    p_token: 'not-a-real-token-xxxxx',
  });
  if (badErr) {
    console.error('✗ share_get_data 함수 호출 실패:', badErr.message);
    console.error('  → SQL 마이그레이션이 반영되지 않았을 수 있음.');
    process.exit(1);
  }
  if (bad !== null) { console.error('✗ 잘못된 토큰인데 null 아님:', bad); process.exit(1); }
  console.log('✓ share_get_data 함수 존재 (잘못된 토큰 → null)');

  // 2) 테스트 계정으로 로그인 → 실제 share_token 발급
  if (!testEmail || !testPassword) {
    console.log('ℹ  실계정 검증 건너뜀 (.env.test 없음)');
    console.log('\n✅ 스모크 테스트 통과');
    return;
  }

  const userClient = createClient(url, anon);
  const { data: auth, error: authErr } = await userClient.auth.signInWithPassword({
    email: testEmail, password: testPassword,
  });
  if (authErr) { console.error('✗ 테스트 계정 로그인 실패:', authErr.message); process.exit(1); }
  console.log('✓ 테스트 계정 로그인');

  const { data: userRow, error: userErr } = await userClient
    .from('users').select('household_id').eq('uid', auth.user.id).single();
  if (userErr || !userRow?.household_id) {
    console.error('✗ household 조회 실패:', userErr?.message);
    process.exit(1);
  }

  let { data: hh, error: hhErr } = await userClient
    .from('households').select('id, name, share_token, share_token_expiry')
    .eq('id', userRow.household_id).single();
  if (hhErr) { console.error('✗ household 조회 실패:', hhErr.message); process.exit(1); }

  // share_token이 없거나 만료됐으면 새로 발급
  const expired = hh.share_token_expiry && new Date(hh.share_token_expiry) <= new Date();
  if (!hh.share_token || expired) {
    const newToken = Math.random().toString(36).slice(2, 10).toUpperCase();
    const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error: updErr } = await userClient
      .from('households')
      .update({ share_token: newToken, share_token_expiry: newExpiry })
      .eq('id', hh.id);
    if (updErr) { console.error('✗ share_token 발급 실패:', updErr.message); process.exit(1); }
    hh = { ...hh, share_token: newToken, share_token_expiry: newExpiry };
    console.log('✓ share_token 새로 발급');
  }
  console.log('✓ share_token 준비:', hh.share_token.slice(0, 4) + '***');

  // 3) anon 키로 (펫시터 시점) RPC 호출
  const { data: bundle, error: bundleErr } = await anonClient.rpc('share_get_data', {
    p_token: hh.share_token,
  });
  if (bundleErr) { console.error('✗ share_get_data (real):', bundleErr.message); process.exit(1); }
  if (!bundle) { console.error('✗ 유효 토큰인데 null'); process.exit(1); }
  console.log('✓ share_get_data (real)');
  console.log('  household:', bundle.household?.name);
  console.log('  cats:', (bundle.cats ?? []).length);
  console.log('  recipes:', (bundle.recipes ?? []).length);
  // share_token 필드가 응답에 포함되지 않았는지 검증
  if (bundle.household?.share_token || bundle.household?.share_token_expiry) {
    console.error('✗ household 응답에 share_token 유출');
    process.exit(1);
  }
  console.log('✓ share_token 유출 없음');

  const today = new Date().toISOString().slice(0, 10);
  const { data: checks, error: ckErr } = await anonClient.rpc('share_get_checks', {
    p_token: hh.share_token, p_date: today,
  });
  if (ckErr) { console.error('✗ share_get_checks:', ckErr.message); process.exit(1); }
  console.log('✓ share_get_checks (오늘', (checks ?? []).length, '건)');

  // 4) share_upsert_check — recipe/cat가 있을 때만
  if (bundle.recipes?.length && bundle.cats?.length) {
    const r = bundle.recipes[0];
    const c = bundle.cats[0];
    const slot = (r.times?.[0]) ?? 'morning';
    const ckId = `${today}_${r.id}_${c.id}_${slot}_SMOKE`;
    const { error: upErr } = await anonClient.rpc('share_upsert_check', {
      p_token: hh.share_token,
      p_id: ckId, p_date: today,
      p_recipe_id: r.id, p_cat_id: c.id,
      p_done: true,
      p_done_at: new Date().toISOString(),
      p_done_by: 'smoke',
    });
    if (upErr) { console.error('✗ share_upsert_check:', upErr.message); process.exit(1); }
    console.log('✓ share_upsert_check (done=true)');

    // cleanup: done=false로 되돌림
    await anonClient.rpc('share_upsert_check', {
      p_token: hh.share_token,
      p_id: ckId, p_date: today,
      p_recipe_id: r.id, p_cat_id: c.id,
      p_done: false, p_done_at: null, p_done_by: 'smoke',
    });
    console.log('✓ cleanup done');
  } else {
    console.log('ℹ  upsert 테스트 건너뜀 (recipe/cat 없음)');
  }

  // 5) 크로스-household 교차 삽입 차단 검증 (보안)
  const { error: crossErr } = await anonClient.rpc('share_upsert_check', {
    p_token: hh.share_token,
    p_id: `${today}_cross_test`, p_date: today,
    p_recipe_id: '00000000-0000-0000-0000-000000000000',
    p_cat_id: '00000000-0000-0000-0000-000000000000',
    p_done: true, p_done_at: null, p_done_by: 'attacker',
  });
  if (!crossErr) { console.error('✗ 타 household recipe/cat 삽입이 차단되지 않음'); process.exit(1); }
  console.log('✓ 크로스 household 삽입 차단 (예상된 에러)');

  console.log('\n✅ 공유 RPC end-to-end 검증 통과');
}

main().catch((e) => { console.error('✗ 예외:', e); process.exit(1); });
