-- ============================================
-- 공유 링크용 메모(daily_logs) SECURITY DEFINER RPC
-- 펫시터는 (1) 오늘의 메모 조회 (2) 메모 추가 가능.
-- 기존 메모 수정/삭제는 불가 — 집사의 기록 보존.
-- ============================================

-- 특정 날짜의 메모 조회 (펫시터 뷰용)
CREATE OR REPLACE FUNCTION public.share_get_logs(p_token text, p_date text)
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
    SELECT jsonb_agg(to_jsonb(l) - 'author_id' ORDER BY l.created_at DESC)
    FROM public.daily_logs l
    WHERE l.household_id = v_hh_id AND l.date = p_date
  ), '[]'::jsonb);
END;
$$;

-- 메모 추가 (펫시터용)
-- 하루 최대 5개 제한 (집사와 공유). author_id는 항상 NULL로 저장 (익명).
CREATE OR REPLACE FUNCTION public.share_insert_log(
  p_token text,
  p_id text,
  p_date text,
  p_cat_id uuid,
  p_text text,
  p_tag_color text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hh_id uuid;
  v_count integer;
BEGIN
  v_hh_id := public._share_resolve_household(p_token);
  IF v_hh_id IS NULL THEN
    RAISE EXCEPTION 'invalid or expired share token';
  END IF;

  -- 고양이 지정된 경우 household 소속 검증 (NULL이면 일반 메모)
  IF p_cat_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.cats WHERE id = p_cat_id AND household_id = v_hh_id
  ) THEN
    RAISE EXCEPTION 'cat not in household';
  END IF;

  -- 일일 메모 제한 (5개) 검증
  SELECT COUNT(*) INTO v_count
  FROM public.daily_logs
  WHERE household_id = v_hh_id AND date = p_date;
  IF v_count >= 5 THEN
    RAISE EXCEPTION 'daily log limit exceeded';
  END IF;

  -- 빈 텍스트 방지
  IF p_text IS NULL OR length(trim(p_text)) = 0 THEN
    RAISE EXCEPTION 'text required';
  END IF;

  INSERT INTO public.daily_logs (
    id, date, cat_id, text, tag_color, household_id, author_id, created_at, updated_at
  )
  VALUES (
    p_id::uuid, p_date, p_cat_id, left(p_text, 500), p_tag_color, v_hh_id, NULL, now(), now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.share_get_logs(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.share_insert_log(text, text, text, uuid, text, text) TO anon, authenticated;
