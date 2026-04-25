-- ============================================
-- 가구 집사 추가/제거 SECURITY DEFINER RPC
-- 기존 클라이언트 직접 update는 RLS에 의해 silent fail (다른 유저 행 update 불가)
-- → 서버에서 권한 검증 후 households.member_ids + users.household_id를 한 번에 처리
-- ============================================

-- 호출자가 household의 owner인지 검증
CREATE OR REPLACE FUNCTION public._is_household_owner(p_household_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.households
    WHERE id = p_household_id AND owner_id = auth.uid()
  );
$$;

-- 집사 추가
-- 1) 호스트가 owner인지 확인
-- 2) households.member_ids에 추가 (중복 시 no-op)
-- 3) users.household_id를 호스트 가구로 변경
CREATE OR REPLACE FUNCTION public.add_household_member(
  p_household_id uuid,
  p_member_uid uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing uuid[];
BEGIN
  IF NOT public._is_household_owner(p_household_id) THEN
    RAISE EXCEPTION 'forbidden: caller is not household owner';
  END IF;

  -- 대상 유저 존재 확인
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE uid = p_member_uid) THEN
    RAISE EXCEPTION 'member user not found';
  END IF;

  -- households.member_ids에 추가 (중복 방지)
  SELECT member_ids INTO v_existing FROM public.households WHERE id = p_household_id;
  IF NOT (p_member_uid::text = ANY(COALESCE(v_existing, ARRAY[]::uuid[])::text[])) THEN
    UPDATE public.households
       SET member_ids = COALESCE(member_ids, ARRAY[]::uuid[]) || ARRAY[p_member_uid]
     WHERE id = p_household_id;
  END IF;

  -- users.household_id 업데이트 — 0 rows이면 에러
  UPDATE public.users SET household_id = p_household_id WHERE uid = p_member_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'failed to update user household_id';
  END IF;
END;
$$;

-- 집사 제거
-- 1) 호스트가 owner인지 확인
-- 2) households.member_ids에서 삭제
-- 3) 제거 대상의 users.household_id를 본인 소유 가구로 복원 (없으면 NULL)
CREATE OR REPLACE FUNCTION public.remove_household_member(
  p_household_id uuid,
  p_member_uid uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_own_hh uuid;
BEGIN
  IF NOT public._is_household_owner(p_household_id) THEN
    RAISE EXCEPTION 'forbidden: caller is not household owner';
  END IF;

  -- owner는 자신을 제거할 수 없음 (가구 자체가 사라지면 안 됨)
  IF EXISTS (SELECT 1 FROM public.households WHERE id = p_household_id AND owner_id = p_member_uid) THEN
    RAISE EXCEPTION 'cannot remove household owner';
  END IF;

  UPDATE public.households
     SET member_ids = ARRAY(
       SELECT m FROM unnest(COALESCE(member_ids, ARRAY[]::uuid[])) AS m WHERE m <> p_member_uid
     )
   WHERE id = p_household_id;

  -- 본인 owner 가구 찾기
  SELECT id INTO v_own_hh FROM public.households WHERE owner_id = p_member_uid LIMIT 1;

  UPDATE public.users SET household_id = v_own_hh WHERE uid = p_member_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'failed to restore user household_id';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_household_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_household_member(uuid, uuid) TO authenticated;
