# HTML checks sourced by scripts/e2e/run.sh and scripts/headers/verify.sh.
# Plain POSIX sh, so both scripts can load it.

# unnonced_scripts FILE NONCE: print how many <script ...> tags in FILE do not
# carry nonce="NONCE". Every tag counts whatever its other attributes are
# (src, async, type, noModule), in any case, and a tag split over several lines
# is joined first. Under `script-src 'nonce-...' 'strict-dynamic'` a tag
# without the nonce is blocked, so the answer must be 0.
unnonced_scripts() {
	tr '\n' ' ' <"$1" |
		{ grep -o -i '<script[^>]*>' || true; } |
		{ grep -v -F "nonce=\"$2\"" || true; } |
		wc -l | tr -d ' '
}
