// moodle REST base endpoint (server.php)
const MOODLE_BASE_URL =
  process.env.MOODLE_BASE_URL ||
  "https://moodle24-26.coastal.edu/webservice/rest/server.php";

// always request JSON
const MOODLE_FORMAT = "json";

module.exports = {
  MOODLE_BASE_URL,
  MOODLE_FORMAT,
};