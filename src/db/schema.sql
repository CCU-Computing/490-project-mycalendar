-- users table (authentication and profile)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  moodle_token TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- user preferences (flexible key-value store for UI preferences)
CREATE TABLE IF NOT EXISTS user_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  pref_key TEXT NOT NULL,
  pref_value TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, pref_key)
);

-- course color preferences (normalized for fast lookups)
CREATE TABLE IF NOT EXISTS course_colors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  course_id TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, course_id)
);

-- event overrides (customize Moodle events)
CREATE TABLE IF NOT EXISTS event_overrides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  event_id TEXT NOT NULL,
  color TEXT,
  text_color TEXT,
  hidden INTEGER DEFAULT 0,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, event_id)
);

-- assignment type color preferences (colors for assignment types: assign, quiz, etc.)
CREATE TABLE IF NOT EXISTS assignment_type_colors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  assignment_type TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, assignment_type)
);

-- custom calendar events (user-created, not from Moodle)
CREATE TABLE IF NOT EXISTS custom_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  course_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT DEFAULT 'custom',
  start_time DATETIME NOT NULL,
  end_time DATETIME,
  all_day INTEGER DEFAULT 0,
  color TEXT,
  recurrence_rule TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- user-submitted assignment data (predictions, overrides, extra info)
CREATE TABLE IF NOT EXISTS user_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  course_id TEXT NOT NULL,
  moodle_assignment_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATETIME,
  predicted_due_date DATETIME,
  estimated_hours REAL,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'pending',
  completed_at DATETIME,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- course metadata (user-submitted data not from Moodle)
CREATE TABLE IF NOT EXISTS course_metadata (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  course_id TEXT NOT NULL,
  course_name TEXT,
  custom_image_url TEXT,
  instructor_name TEXT,
  office_hours TEXT,
  external_url TEXT,
  notes TEXT,
  avg_assignments_per_week REAL,
  typical_due_day TEXT,
  typical_due_time TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, course_id)
);

-- time blocks (study schedules, recurring availability)
CREATE TABLE IF NOT EXISTS time_blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  block_type TEXT DEFAULT 'study',
  day_of_week INTEGER,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  specific_date DATE,
  recurrence_rule TEXT,
  color TEXT,
  location TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_course_colors_user ON course_colors(user_id);
CREATE INDEX IF NOT EXISTS idx_event_overrides_user ON event_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_assignment_type_colors_user ON assignment_type_colors(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_events_user_date ON custom_events(user_id, start_time);
CREATE INDEX IF NOT EXISTS idx_user_assignments_user_due ON user_assignments(user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_course_metadata_user ON course_metadata(user_id);
CREATE INDEX IF NOT EXISTS idx_time_blocks_user_day ON time_blocks(user_id, day_of_week);

-- schema version tracking
PRAGMA user_version = 1;
