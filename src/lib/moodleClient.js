const { MOODLE_BASE_URL, MOODLE_FORMAT } = require("../config");

/**
 * build URLSearchParams while supporting Moodle's array syntax: key[index]=value
 */
function buildParams(params) {
  const usp = new URLSearchParams();
  for (const [key, val] of Object.entries(params || {})) {
    if (Array.isArray(val)) {
      val.forEach((item, idx) => usp.append(`${key}[${idx}]`, String(item)));
    } else if (val !== undefined && val !== null) {
      usp.append(key, String(val));
    }
  }
  return usp;
}

/**
 * perform a Moodle REST call (get) with wsfunction, user token, and params
 */
async function moodleGet({ token, wsfunction, params = {} }) {
  if (!token) throw new Error("Missing token");
  if (!wsfunction) throw new Error("Missing wsfunction");

  const baseParams = {
    wstoken: token,
    moodlewsrestformat: MOODLE_FORMAT,
    wsfunction,
  };

  const usp = buildParams({ ...baseParams, ...params });
  const url = `${MOODLE_BASE_URL}?${usp.toString()}`;

  const resp = await fetch(url, {
    method: "GET",
    headers: { "Accept": "application/json" },
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(
      `Moodle request failed (${resp.status}): ${text || resp.statusText}`
    );
  }

  const json = await resp.json().catch(() => ({}));

  if (json && json.exception) {
    throw new Error(`Moodle error: ${json.message || json.errorcode}`);
  }
  return json;
}

module.exports = {
  moodleGet,
};