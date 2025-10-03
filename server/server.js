const express = require("express");
const session = require("express-session");
const path = require("path");
const { getDatabase } = require("../src/db/init");

// routes
const apiRouter = require("../src/routes/api");
const prefsRouter = require("../src/routes/prefs");
const authRouter = require("../src/routes/auth");
const customEventsRouter = require("../src/routes/customEvents");
const userAssignmentsRouter = require("../src/routes/userAssignments");
const courseMetadataRouter = require("../src/routes/courseMetadata");
const timeBlocksRouter = require("../src/routes/timeBlocks");

const app = express();

app.disable("x-powered-by");
app.use(express.json());

// initialize database
console.log("[server] Initializing database...");
getDatabase();
console.log("[server] Database ready");

// session (swap for Redis in prod/future coastal)
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: !!process.env.COOKIE_SECURE,
      maxAge: 1000 * 60 * 60 * 8, // 8 hours
    },
  })
);

// mount routes
app.use("/api", apiRouter);
app.use("/api/prefs", prefsRouter);
app.use("/auth", authRouter);
app.use("/api/custom-events", customEventsRouter);
app.use("/api/user-assignments", userAssignmentsRouter);
app.use("/api/course-metadata", courseMetadataRouter);
app.use("/api/time-blocks", timeBlocksRouter);

// static files
app.use(express.static(path.join(__dirname, "../client")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`[server] Listening on http://localhost:${PORT}`)
);