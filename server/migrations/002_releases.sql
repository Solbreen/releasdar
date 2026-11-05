CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  manager TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL
);
CREATE TABLE releases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  date TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT ''
);
CREATE INDEX releases_date_idx ON releases(date);
DELETE FROM vacation_days;
DELETE FROM users;
