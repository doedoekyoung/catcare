-- ============================================
-- Row limit triggers (어뷰징 방지)
-- Supabase SQL Editor에서 실행
-- ============================================

-- 1. 고양이: household당 최대 20마리
CREATE OR REPLACE FUNCTION check_cats_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT count(*) FROM cats WHERE household_id = NEW.household_id) >= 20 THEN
    RAISE EXCEPTION '고양이는 가구당 최대 20마���까지 등록할 수 있습니다.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_cats_limit ON cats;
CREATE TRIGGER enforce_cats_limit
  BEFORE INSERT ON cats
  FOR EACH ROW EXECUTE FUNCTION check_cats_limit();

-- 2. 루틴: household당 최대 50개
CREATE OR REPLACE FUNCTION check_recipes_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT count(*) FROM recipes WHERE household_id = NEW.household_id) >= 50 THEN
    RAISE EXCEPTION '루틴은 가구당 최대 50개까지 등록할 수 있습니다.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_recipes_limit ON recipes;
CREATE TRIGGER enforce_recipes_limit
  BEFORE INSERT ON recipes
  FOR EACH ROW EXECUTE FUNCTION check_recipes_limit();

-- 3. 메모: household당 하루 최대 5개
CREATE OR REPLACE FUNCTION check_daily_logs_limit()
RETURNS TRIGGER AS $$
BEGIN
  -- UPDATE(기존 메모 수정)는 제한하지 않음
  IF TG_OP = 'INSERT' THEN
    IF (SELECT count(*) FROM daily_logs WHERE household_id = NEW.household_id AND date = NEW.date) >= 5 THEN
      RAISE EXCEPTION '메모는 하루 최대 5개까지 등록할 수 있습니다.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_daily_logs_limit ON daily_logs;
CREATE TRIGGER enforce_daily_logs_limit
  BEFORE INSERT ON daily_logs
  FOR EACH ROW EXECUTE FUNCTION check_daily_logs_limit();

-- 4. 텍스트 길이 제한 (이름 30자, 텍스트 500자)
CREATE OR REPLACE FUNCTION check_text_length()
RETURNS TRIGGER AS $$
BEGIN
  -- cats.name
  IF TG_TABLE_NAME = 'cats' AND length(NEW.name) > 30 THEN
    RAISE EXCEPTION '고양이 이름은 30자까지 입력할 수 있습니다.';
  END IF;
  -- recipes.name
  IF TG_TABLE_NAME = 'recipes' AND length(NEW.name) > 30 THEN
    RAISE EXCEPTION '루틴 이름은 30자까지 입력할 수 있습니다.';
  END IF;
  -- daily_logs.text
  IF TG_TABLE_NAME = 'daily_logs' AND length(NEW.text) > 500 THEN
    RAISE EXCEPTION '메모는 500자까지 입력할 수 있습니다.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_text_length ON cats;
CREATE TRIGGER enforce_text_length
  BEFORE INSERT OR UPDATE ON cats
  FOR EACH ROW EXECUTE FUNCTION check_text_length();

DROP TRIGGER IF EXISTS enforce_text_length ON recipes;
CREATE TRIGGER enforce_text_length
  BEFORE INSERT OR UPDATE ON recipes
  FOR EACH ROW EXECUTE FUNCTION check_text_length();

DROP TRIGGER IF EXISTS enforce_text_length ON daily_logs;
CREATE TRIGGER enforce_text_length
  BEFORE INSERT OR UPDATE ON daily_logs
  FOR EACH ROW EXECUTE FUNCTION check_text_length();
