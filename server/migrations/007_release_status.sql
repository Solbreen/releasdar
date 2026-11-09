ALTER TABLE releases ADD COLUMN status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'rejected', 'in_progress', 'completed'));
