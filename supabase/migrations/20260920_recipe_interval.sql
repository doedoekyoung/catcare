-- 루틴 "N일마다" 반복(격일 등) 지원
--
--   interval_days : N일마다 (2 이상). NULL이면 기존 요일(days) 방식.
--   start_date    : N일마다의 기준(시작)일. 이 날부터 N일 간격으로 해당하며, 이전 날짜는 해당 없음.
--
-- 기존 행은 두 컬럼이 NULL이라 지금과 똑같이 동작한다(데이터 이전 불필요).
-- 공유 RPC(share_get_data)는 to_jsonb(r)로 행 전체를 반환하므로 수정할 필요 없음.
-- 여러 번 실행해도 안전(idempotent).

alter table public.recipes
  add column if not exists interval_days integer,
  add column if not exists start_date date;

alter table public.recipes
  drop constraint if exists recipes_interval_days_check;

alter table public.recipes
  add constraint recipes_interval_days_check
  check (
    interval_days is null
    or (interval_days between 2 and 365 and start_date is not null)
  );
