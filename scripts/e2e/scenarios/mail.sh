# shellcheck shell=bash disable=SC2154,SC2034
# Scenario mail of scripts/e2e/run.sh: the webmail against the stand-in JMAP,
# hostile messages included.
# Sourced by the runner, which provides the helpers in scripts/e2e/lib.

MAIL_HOSTILE_HTML=00000000-0000-4000-8000-000000000003
MAIL_HOSTILE_HEADERS=00000000-0000-4000-8000-000000000004
MAIL_ATTACHMENTS=00000000-0000-4000-8000-000000000005
MAIL_MXSS=00000000-0000-4000-8000-000000000006
MAIL_NEWSLETTER=00000000-0000-4000-8000-000000000002
MAIL_TEXT_ONLY=00000000-0000-4000-8000-000000000007

scenario_mail() {
	echo "# mail: three-pane webmail, sanitised bodies, attachments, hostile messages"
	fresh
	login admin correct-horse
	local good=$cookie
	reset_api

	local path
	for path in /app/mail "/app/mail?box=Sent&msg=$MAIL_HOSTILE_HTML" "/app/mail/body/$MAIL_HOSTILE_HTML" "/app/mail/attachment/$MAIL_ATTACHMENTS/2"; do
		fetch "$path"
		assert_eq "no cookie: GET $path" "$status" 307
		assert_eq "no cookie: $path goes to the sign-in page" "$(header location)" "/"
	done
	assert_eq "the denied calls reached no endpoint" "$(api_count '"method"')" 0

	fetch /app/mail "$good"
	assert_eq "GET /app/mail with a session" "$status" 200
	assert_contains "the inbox lists the first message" "$(cat "$work/b")" "Welcome to your mailbox"
	assert_contains "the folder tree lists a folder" "$(cat "$work/b")" "Archive"
	assert_eq "no inline style attribute or element" \
		"$({ grep -o -E ' style="|<style' "$work/b" || true; } | wc -l | tr -d ' ')" 0
	assert_contains "the page carries the panel's own policy" "$(header content-security-policy)" "frame-ancestors 'none'"
	assert_eq "one main landmark" "$({ grep -o '<main' "$work/b" || true; } | wc -l | tr -d ' ')" 1
	assert_absent "the bearer token is not in the page" "$(cat "$work/b")" "$(cat "$api_token_file")"

	fetch "/app/mail?page=2" "$good"
	assert_contains "page 2 lists an older message" "$(cat "$work/b")" "Bulk message"
	fetch "/app/mail?filter=flagged" "$good"
	assert_contains "the flagged filter keeps the starred message" "$(cat "$work/b")" "Starred and answered"
	assert_absent "and leaves the others out" "$(cat "$work/b")" "Weekly newsletter"
	fetch "/app/mail?q=newsletter" "$good"
	assert_contains "a search finds by subject" "$(cat "$work/b")" "Weekly newsletter"
	fetch "/app/mail?box=Archive" "$good"
	assert_contains "another folder lists its own message" "$(cat "$work/b")" "Old thread"
	fetch "/app/mail?box=%0a&page=-1&filter=zzz&q=%00&msg=../x" "$good"
	assert_eq "hostile parameters degrade to the default view" "$status" 200
	assert_contains "which is the inbox" "$(cat "$work/b")" "Welcome to your mailbox"

	# Headers and addresses with line breaks and bidi controls are text.
	fetch "/app/mail?msg=$MAIL_HOSTILE_HEADERS" "$good"
	assert_eq "the message with hostile headers renders" "$status" 200
	assert_contains "its subject is shown as one line of text" "$(cat "$work/b")" "Invoicetxt.exe Bcc: attacker@example.org"
	assert_eq "no bidi override reaches the page" "$({ grep -o -P '[\x{202A}-\x{202E}\x{2066}-\x{2069}]' "$work/b" || true; } | wc -l | tr -d ' ')" 0
	assert_absent "no injected header became markup" "$(cat "$work/b")" "<X-Injected"

	# A message whose body is plain text keeps its markup as text.
	fetch "/app/mail?msg=$MAIL_TEXT_ONLY" "$good"
	assert_contains "the markup in a text body is escaped" "$(cat "$work/b")" "&lt;script&gt;alert(&#x27;text&#x27;)&lt;/script&gt;"

	# The framed body: sanitised, under its own policy.
	fetch "/app/mail/body/$MAIL_HOSTILE_HTML" "$good"
	assert_eq "GET the hostile body" "$status" 200
	local body
	body=$(cat "$work/b")
	assert_contains "its policy allows nothing but images" "$(header content-security-policy)" "default-src 'none'"
	assert_contains "its policy sandboxes the response" "$(header content-security-policy)" "sandbox allow-popups allow-popups-to-escape-sandbox"
	assert_absent "its policy has no script allowance" "$(header content-security-policy)" "allow-scripts"
	assert_eq "it may be framed by the panel only" "$(header x-frame-options)" "SAMEORIGIN"
	assert_eq "it is never cached" "$(header cache-control)" "private, no-store"
	assert_eq "it is never sniffed" "$(header x-content-type-options)" "nosniff"
	assert_contains "it is HTML" "$(header content-type)" "text/html"
	local needle
	for needle in "<script" "<svg" "<style" "<iframe" "<form" "<base" "<meta http" "onclick" "onerror" "javascript:" "style=" "tracker.example" "evil.example"; do
		assert_absent "the hostile body carries no '$needle'" "$body" "$needle"
	done
	assert_contains "the safe link survives, in a new window without opener" "$body" 'href="https://example.org/ok" target="_blank" rel="noopener noreferrer nofollow"'
	assert_contains "the blocked image keeps its description as text" "$body" "remote picture"

	fetch "/app/mail/body/$MAIL_NEWSLETTER" "$good"
	assert_absent "remote images are blocked by default" "$(cat "$work/b")" "tracker.example"
	assert_contains "and the policy allows no remote image" "$(header content-security-policy)" "img-src data:;"
	fetch "/app/mail/body/$MAIL_NEWSLETTER?images=1" "$good"
	assert_contains "they load when asked" "$(cat "$work/b")" 'src="https://tracker.example/open.gif?u=1"'
	assert_contains "and then only the policy allows them" "$(header content-security-policy)" "img-src data: https: http:;"

	fetch "/app/mail/body/$MAIL_MXSS" "$good"
	assert_eq "GET the mutation payloads" "$status" 200
	assert_absent "no mutation payload leaves an event handler" "$(cat "$work/b")" "onerror"
	assert_absent "nor an img with a payload attribute" "$(cat "$work/b")" "<img"

	# A hostile id or a message with no HTML body is a 404, and reaches nothing.
	local before
	before=$(api_count '"path":"/jmap/api"')
	for path in "/app/mail/body/not-an-id" "/app/mail/body/..%2f..%2fetc" "/app/mail/body/$MAIL_TEXT_ONLY"; do
		fetch "$path" "$good"
		assert_eq "GET $path" "$status" 404
	done
	assert_eq "only the message with a valid id asked JMAP" "$(($(api_count '"path":"/jmap/api"') - before))" 1

	# Attachments: always a download, a forced type, a clean name.
	fetch "/app/mail/attachment/$MAIL_ATTACHMENTS/2" "$good"
	assert_eq "GET the PDF" "$status" 200
	assert_eq "its type is kept" "$(header content-type)" "application/pdf"
	assert_contains "it is an attachment" "$(header content-disposition)" "attachment; filename=\"report.pdf\""
	assert_eq "it is never sniffed" "$(header x-content-type-options)" "nosniff"
	assert_contains "the panel's own policy covers it, which forbids framing" "$(header content-security-policy)" "frame-ancestors 'none'"
	assert_contains "its bytes arrive" "$(cat "$work/b")" "%PDF-1.4"
	fetch "/app/mail/attachment/$MAIL_ATTACHMENTS/3" "$good"
	assert_eq "the HTML attachment is octet-stream" "$(header content-type)" "application/octet-stream"
	assert_contains "and an attachment" "$(header content-disposition)" "attachment;"
	assert_absent "its name has no path and no bidi control" "$(header content-disposition)" ".."
	assert_eq "no bidi control in the name" "$({ grep -i '^content-disposition' "$work/h" | grep -o -P '[\x{202A}-\x{202E}]' || true; } | wc -l | tr -d ' ')" 0
	fetch "/app/mail/attachment/$MAIL_ATTACHMENTS/4" "$good"
	assert_eq "the SVG attachment is octet-stream" "$(header content-type)" "application/octet-stream"
	for path in "/app/mail/attachment/$MAIL_ATTACHMENTS/1" "/app/mail/attachment/$MAIL_ATTACHMENTS/9" "/app/mail/attachment/$MAIL_ATTACHMENTS/..%2f2" "/app/mail/attachment/x/2"; do
		fetch "$path" "$good"
		assert_eq "GET $path is not a listed attachment" "$status" 404
	done

	assert_eq "the webmail only reads: no DELETE reached the API" "$(api_count '"method":"DELETE"')" 0
	assert_eq "every call carried the valid bearer" "$(api_count '"bearer":"valid"')" "$(api_count '"method"')"
}
