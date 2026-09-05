-- Fix Supabase Schema for WordBomb 2.0
-- (Designed for the prototype allowing anonymous / local profile IDs without full Supabase Auth)

-- 1. Drop constraints that require an authenticated user in auth.users
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE vocabulary_lists DROP CONSTRAINT IF EXISTS vocabulary_lists_user_id_fkey;
ALTER TABLE vocabulary_items DROP CONSTRAINT IF EXISTS vocabulary_items_list_id_fkey;

-- 2. Add word_count column if not exists
ALTER TABLE vocabulary_lists ADD COLUMN IF NOT EXISTS word_count INTEGER DEFAULT 0;

-- 3. Re-link foreign keys cleanly across our own tables
-- Note: vocabulary_lists user_id now just references profiles(id)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'vocabulary_lists_user_id_fkey'
  ) THEN
    ALTER TABLE vocabulary_lists 
    ADD CONSTRAINT vocabulary_lists_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 4. Update RLS Policies to allow anonymous public interactions for the party game

-- PROFILES
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON profiles;

CREATE POLICY "Anyone can insert profiles" ON profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update profiles" ON profiles FOR UPDATE USING (true);
CREATE POLICY "Anyone can view profiles" ON profiles FOR SELECT USING (true);

-- LISTS
DROP POLICY IF EXISTS "Vocabulary lists are public for games" ON vocabulary_lists;
DROP POLICY IF EXISTS "Users can manage their lists" ON vocabulary_lists;

CREATE POLICY "Anyone can insert lists" ON vocabulary_lists FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update lists" ON vocabulary_lists FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete lists" ON vocabulary_lists FOR DELETE USING (true);
CREATE POLICY "Anyone can read lists" ON vocabulary_lists FOR SELECT USING (true);

-- ITEMS
DROP POLICY IF EXISTS "Vocabulary items are public for games" ON vocabulary_items;
DROP POLICY IF EXISTS "Users can manage their items" ON vocabulary_items;

CREATE POLICY "Anyone can insert items" ON vocabulary_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update items" ON vocabulary_items FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete items" ON vocabulary_items FOR DELETE USING (true);
CREATE POLICY "Anyone can read items" ON vocabulary_items FOR SELECT USING (true);
