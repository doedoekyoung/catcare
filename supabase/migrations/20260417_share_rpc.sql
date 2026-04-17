-- ============================================
-- 공유 링크용 SECURITY DEFINER RPC
-- 익명 사용자(펫시터)가 RLS를 거치지 않고 토큰으로만 접근할 수 있도록 설계.
-- 모든 함수가 토큰 유효성·만료를 내부에서 검증하므로 RLS를 느슨하게 풀 필요 없음.
-- ============================================

-- 공통: 토큰 → household_id 검증. 만료되었거나 없으면 NULL.
CREATE OR REPLACE FUNCTION public._share_resolve_household(p_token text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id FROM public.households
  WHERE share_token = p_token
    AND (share_token_expiry IS NULL OR share_token_expiry > now());
$$;

-- 공유 초기 데이터 — household + cats + recipes (활성만) 한 번에 반환
CREATE OR REPLACE FUNCTION public.share_get_data(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_hh_id uuid;
  v_result jsonb;
BEGIN
  v_hh_id := public._share_resolve_household(p_token);
  IF v_hh_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'household', (
      SELECT to_jsonb(h) - 'share_token' - 'share_token_expiry'
      FROM public.households h WHERE h.id = v_hh_id
    ),
    'cats', COALESCE((
      SELECT jsonb_agg(to_jsonb(c) ORDER BY c.created_at)
      FROM public.cats c WHERE c.household_id = v_hh_id
    ), '[]'::jsonb),
    'recipes', COALESCE((
      SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at)
      FROM public.recipes r WHERE r.household_id = v_hh_id AND r.active = true
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- 특정 날짜의 체크 기록 조회 (펫시터 뷰용)
CREATE OR REPLACE FUNCTION public.share_get_checks(p_token text, p_date text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_hh_id uuid;
BEGIN
  v_hh_id := public._share_resolve_household(p_token);
  IF v_hh_id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(to_jsonb(c))
    FROM public.check_records c
    WHERE c.household_id = v_hh_id AND c.date = p_date
  ), '[]'::jsonb);
END;
$$;

-- 체크 기록 upsert (펫시터가 체크/해제)
-- p_done_by는 text로 받지만 check_records.done_by는 UUID.
-- 펫시터는 계정이 없으므로 UUID가 아닌 값('guest' 등)은 NULL로 저장.
CREATE OR REPLACE FUNCTION public.share_upsert_check(
  p_token text,
  p_id text,
  p_date text,
  p_recipe_id uuid,
  p_cat_id uuid,
  p_done boolean,
  p_done_at timestamptz,
  p_done_by text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hh_id uuid;
  v_done_by uuid;
BEGIN
  v_hh_id := public._share_resolve_household(p_token);
  IF v_hh_id IS NULL THEN
    RAISE EXCEPTION 'invalid or expired share token';
  END IF;

  -- 토큰에 매칭된 household의 recipe·cat인지 검증 (토큰 유출 시 교차 삽입 방지)
  IF NOT EXISTS (
    SELECT 1 FROM public.recipes WHERE id = p_recipe_id AND household_id = v_hh_id
  ) OR NOT EXISTS (
    SELECT 1 FROM public.cats WHERE id = p_cat_id AND household_id = v_hh_id
  ) THEN
    RAISE EXCEPTION 'recipe or cat not in household';
  END IF;

  -- UUID 형식이 아니면 NULL (펫시터 / 익명 체크로 간주)
  BEGIN
    v_done_by := p_done_by::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    v_done_by := NULL;
  END;

  INSERT INTO public.check_records (id, date, recipe_id, cat_id, done, done_at, done_by, household_id)
  VALUES (p_id, p_date, p_recipe_id, p_cat_id, p_done, p_done_at, v_done_by, v_hh_id)
  ON CONFLICT (id) DO UPDATE
    SET done = EXCLUDED.done,
        done_at = EXCLUDED.done_at,
        done_by = EXCLUDED.done_by;
END;
$$;

-- 익명·인증 사용자 모두 실행 가능하도록 권한 부여
GRANT EXECUTE ON FUNCTION public.share_get_data(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.share_get_checks(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.share_upsert_check(text, text, text, uuid, uuid, boolean, timestamptz, text) TO anon, authenticated;
