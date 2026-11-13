# Name of the session cookie, sourced by scripts/e2e/run.sh and
# scripts/headers/verify.sh so the two cannot drift apart. It has to equal
# SESSION_COOKIE in internal/src/lib/auth/session/index.ts; the test in
# scripts/e2e/html-checks.test.ts fails when they differ. A script
# that sends a stale name is redirected to /login and can still look green.
SESSION_COOKIE_NAME="__Host-epistle_session"
