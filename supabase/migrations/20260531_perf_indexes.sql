-- 성능 인덱스 추가 — 현재 데이터 양(수십~수백 행)에선 옵티마이저가 무시할 수도 있지만
-- 사용자/데이터 누적에 따라 자동으로 Index Scan으로 전환된다.
--
-- 대상 패턴:
--   - 모든 fetch가 household_id 필터로 시작 (RLS 평가 + 명시적 .eq)
--   - check_records, daily_logs는 추가로 date range/order 자주 사용
--   - cats, recipes는 단순 household_id fetch지만 RLS 평가 시 매번 풀스캔 회피용
--
-- 비용:
--   - 인덱스 추가 자체 거의 0 (현재 행 수 적음)
--   - 인서트 비용 microsecond 단위 증가 — 우리 워크로드(분당 수 회)에 무영향
--   - (household_id, date)는 date가 PK 일부라 immutable → fragmentation 없음
--
-- 모두 IF NOT EXISTS로 멱등 — 재실행해도 안전.

create index if not exists idx_check_records_household_date
  on public.check_records (household_id, date);

create index if not exists idx_daily_logs_household_date
  on public.daily_logs (household_id, date);

create index if not exists idx_cats_household
  on public.cats (household_id);

create index if not exists idx_recipes_household
  on public.recipes (household_id);
