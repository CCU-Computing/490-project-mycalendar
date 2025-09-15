const express = require("express");
const session = require("express-session");
const path = require("path");
const apiRouter = require("../src/routes/api");

const app = express();

app.disable("x-powered-by");
app.use(express.json());

// Session (swap for Redis in prod/future coastal)
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

app.use("/api", apiRouter);

app.use(express.static(path.join(__dirname, "../client")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`[server] Listening on http://localhost:${PORT}`)
);