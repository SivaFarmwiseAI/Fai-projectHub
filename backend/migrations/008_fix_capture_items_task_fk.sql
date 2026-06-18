-- ============================================================
-- ProjectHub — Fix capture_items.converted_to_task_id FK
-- Original constraint had no ON DELETE rule, so deleting a
-- project (which cascades through tasks) failed when any
-- capture_item still referenced one of those tasks.
-- The column is nullable and represents "this capture was
-- converted into this task" — SET NULL is the right behavior.
-- ============================================================

DO $$
DECLARE
  fk_name TEXT;
BEGIN
  SELECT conname INTO fk_name
  FROM pg_constraint
  WHERE conrelid = 'capture_items'::regclass
    AND contype = 'f'
    AND pg_get_constraintdef(oid) LIKE '%(converted_to_task_id)%';

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE capture_items DROP CONSTRAINT %I', fk_name);
  END IF;

  ALTER TABLE capture_items
    ADD CONSTRAINT capture_items_converted_to_task_id_fkey
    FOREIGN KEY (converted_to_task_id)
    REFERENCES tasks(id)
    ON DELETE SET NULL;
END $$;
