ALTER TABLE products ADD COLUMN manager_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL;
UPDATE products SET manager_id = (SELECT id FROM accounts WHERE role = 'rp' AND full_name = products.manager AND (SELECT COUNT(*) FROM accounts a WHERE a.role = 'rp' AND a.full_name = products.manager) = 1) WHERE manager != '';
