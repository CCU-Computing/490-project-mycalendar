const express = require("express");
const {
  createUser,
  verifyPassword,
  getUserById,
  updateMoodleToken,
} = require("../db/users");

const router = express.Router();

/**
 * POST /auth/register
 * register a new user
 */
router.post("/register", async (req, res) => {
  try {
    const { email, firstName, lastName, password } = req.body || {};

    if (!email || !firstName || !lastName || !password) {
      return res.status(400).json({
        error: "email, firstName, lastName, and password are required",
      });
    }

    // validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // validate password length
    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });
    }

    const user = await createUser({
      email,
      firstName,
      lastName,
      password,
    });

    // set session
    req.session.userId = user.id;
    req.session.email = user.email;

    res.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  } catch (e) {
    if (e.message.includes("UNIQUE constraint failed")) {
      return res.status(400).json({ error: "Email already registered" });
    }
    res.status(500).json({ error: e.message || "Registration failed" });
  }
});

/**
 * POST /auth/login
 * login with email and password
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: "email and password required" });
    }

    const user = await verifyPassword(email, password);
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // set session
    req.session.userId = user.id;
    req.session.email = user.email;
    req.session.userid = user.id; // For backward compatibility with existing code

    // if user has a Moodle token, also set it in session
    if (user.moodleToken) {
      req.session.token = user.moodleToken;
    }

    res.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message || "Login failed" });
  }
});

/**
 * POST /auth/logout
 * logout current user
 */
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Logout failed" });
    }
    res.json({ ok: true });
  });
});

/**
 * GET /auth/session
 * get current session info
 */
router.get("/session", async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = getUserById(req.session.userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message || "Failed to get session" });
  }
});

/**
 * PUT /auth/moodle-token
 * update user's Moodle token
 */
router.put("/moodle-token", async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { token } = req.body || {};
    if (!token) {
      return res.status(400).json({ error: "token required" });
    }

    updateMoodleToken(req.session.userId, token);
    req.session.token = token; // also update session

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || "Failed to update token" });
  }
});

module.exports = router;
