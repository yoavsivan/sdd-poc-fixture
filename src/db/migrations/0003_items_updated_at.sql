ALTER TABLE items ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';

UPDATE items SET updated_at = created_at WHERE updated_at = '';
