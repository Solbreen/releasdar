CREATE TABLE users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name  TEXT    NOT NULL,
  last_name   TEXT    NOT NULL,
  name_key    TEXT    NOT NULL UNIQUE,
  color       TEXT    NOT NULL,
  version     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL
);

CREATE TABLE vacation_days (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date    TEXT    NOT NULL,
  PRIMARY KEY (user_id, date)
);

CREATE INDEX vacation_days_date_idx ON vacation_days(date);
