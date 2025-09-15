module.exports = function requireSession(req, res, next) {
  if (!req.session || !req.session.moodleToken) {
    return res.status(401).json({ error: "Not logged in" });
  }
  next();
};