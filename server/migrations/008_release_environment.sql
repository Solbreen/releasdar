ALTER TABLE releases ADD COLUMN environment TEXT NOT NULL DEFAULT 'Test' CHECK (environment IN ('Dev', 'Test', 'Prod'));
ALTER TABLE releases ADD COLUMN release_type TEXT NOT NULL DEFAULT '';
