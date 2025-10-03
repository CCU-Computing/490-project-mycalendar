const bcrypt = require("bcrypt");
const { getDatabase } = require("./init");

const SALT_ROUNDS = 10;

/**
 * create a new user
 */
async function createUser({ email, firstName, lastName, password, moodleToken = null }) {
  const db = getDatabase();

  // hash password
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // insert user
  const result = db
    .prepare(
      `INSERT INTO users (email, first_name, last_name, password_hash, moodle_token)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(email, firstName, lastName, passwordHash, moodleToken);

  return {
    id: result.lastInsertRowid,
    email,
    firstName,
    lastName,
  };
}

/**
 * find user by email
 */
function getUserByEmail(email) {
  const db = getDatabase();
  return db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email);
}

/**
 * find user by ID
 */
function getUserById(id) {
  const db = getDatabase();
  return db
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(id);
}

/**
 * verify user password
 */
async function verifyPassword(email, password) {
  const user = getUserByEmail(email);
  if (!user) {
    return null;
  }

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    return null;
  }

  // return user without password hash
  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    moodleToken: user.moodle_token,
  };
}

/**
 * update user's Moodle token
 */
function updateMoodleToken(userId, token) {
  const db = getDatabase();
  db.prepare(
    "UPDATE users SET moodle_token = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(token, userId);
}

/**
 * update user profile
 */
function updateUser(userId, { firstName, lastName, email }) {
  const db = getDatabase();
  const updates = [];
  const params = [];

  if (firstName) {
    updates.push("first_name = ?");
    params.push(firstName);
  }
  if (lastName) {
    updates.push("last_name = ?");
    params.push(lastName);
  }
  if (email) {
    updates.push("email = ?");
    params.push(email);
  }

  if (updates.length === 0) {
    return getUserById(userId);
  }

  updates.push("updated_at = datetime('now')");
  params.push(userId);

  db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).run(
    ...params
  );

  return getUserById(userId);
}

/**
 * change user password
 */
async function changePassword(userId, newPassword) {
  const db = getDatabase();
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  db.prepare(
    "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(passwordHash, userId);
}

/**
 * delete user (cascades to all related data)
 */
function deleteUser(userId) {
  const db = getDatabase();
  db.prepare("DELETE FROM users WHERE id = ?").run(userId);
}

/**
 * get all users (for admin/demo purposes)
 */
function getAllUsers() {
  const db = getDatabase();
  return db
    .prepare(
      "SELECT id, email, first_name, last_name, created_at FROM users"
    )
    .all();
}

module.exports = {
  createUser,
  getUserByEmail,
  getUserById,
  verifyPassword,
  updateMoodleToken,
  updateUser,
  changePassword,
  deleteUser,
  getAllUsers,
};
