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

# mail_change ARGS_JSON [COOKIE]: post the change-message action the way the browser's client does.
mail_change() {
	local saved=${action_page:-}
	action_page=/app/mail
	post_action features/mail/actions/change-message/index.ts "$1" "${2:-}"
	action_page=$saved
}

# mail_state: the stand-in's view of every message.
mail_state() {
	curl -s "$api/__control/mail"
}

# mail_post PATH BODY COOKIE [ORIGIN] [TYPE]: post to a mail route the way the browser's client does,
# from the panel's own origin unless another is given ("-" sends none). Status printed, body in $work/b.
mail_post() {
	local origin=${4:-$panel} type=${5:-application/json} extra=()
	[[ "$origin" != "-" ]] && extra=(-H "Origin: $origin")
	curl -s -o "$work/b" -w '%{http_code}' -X POST -b "$3" "${extra[@]}" -H "Content-Type: $type" --data-binary "$2" "$panel$1"
}

# mail_sent: what the stand-in was asked to send.
mail_sent() {
	curl -s "$api/__control/sent"
}

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
	assert_eq "what came from outside sends no referrer at all, unlike the panel's own pages" "$(header referrer-policy)" "no-referrer"
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
	# A file that turns out longer than the panel relays, with no size declared:
	# the download breaks off, so it is never saved as a whole file.
	set_oversize_blobs true
	local cut_exit=0 cut_size
	cut_size=$(curl -s -o /dev/null -w '%{size_download}' -b "$good" "$panel/app/mail/attachment/$MAIL_ATTACHMENTS/2") || cut_exit=$?
	set_oversize_blobs false
	assert_eq "a download past 25 MiB breaks off: curl does not end it cleanly" "$([[ $cut_exit -ne 0 ]] && echo broken || echo whole)" broken
	assert_eq "and no byte past 25 MiB was passed on" "$([[ $cut_size -le 26214400 ]] && echo within || echo "over: $cut_size")" within
	fetch "/app/mail/attachment/$MAIL_ATTACHMENTS/2" "$good"
	assert_eq "the next download is whole again" "$status" 200
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

	# Actions on messages.
	local welcome=00000000-0000-4000-8000-000000000001 flagged=00000000-0000-4000-8000-000000000008
	assert_eq "no cookie: change-message is redirected" "$(mail_change "[{\"id\":\"$welcome\",\"op\":\"read\"}]")" 307
	before=$(api_count '"method"')
	for hostile in '[{"id":"x","op":"read"}]' "[{\"id\":\"$welcome\",\"op\":\"delete\"}]" "[{\"id\":\"$welcome\",\"op\":\"move\"}]" "[{\"id\":\"$welcome\",\"op\":\"read\",\"extra\":1}]" "[{\"id\":\"$welcome\",\"op\":\"move\",\"box\":\"a\\nb\"}]" '[null]' '[]'; do
		mail_change "$hostile" "$good" >/dev/null
		assert_contains "hostile change '${hostile:0:40}' is refused" "$(cat "$work/b")" "invalid"
	done
	assert_eq "hostile changes reached no JMAP call" "$(api_count '"method"')" "$before"
	assert_contains "the welcome message starts unread" "$(mail_state)" "\"id\":\"$welcome\",\"mailbox\":\"INBOX\",\"keywords\":{}"
	assert_eq "mark read" "$(mail_change "[{\"id\":\"$welcome\",\"op\":\"read\"}]" "$good")" 200
	assert_contains "the answer says it was done" "$(cat "$work/b")" "done"
	assert_contains "the message is read on the server" "$(mail_state)" "\"id\":\"$welcome\",\"mailbox\":\"INBOX\",\"keywords\":{\"\$seen\":true}"
	mail_change "[{\"id\":\"$welcome\",\"op\":\"star\"}]" "$good" >/dev/null
	assert_contains "star keeps the read flag and adds the star" "$(mail_state)" "\"id\":\"$welcome\",\"mailbox\":\"INBOX\",\"keywords\":{\"\$seen\":true,\"\$flagged\":true}"
	mail_change "[{\"id\":\"$flagged\",\"op\":\"unstar\"}]" "$good" >/dev/null
	assert_contains "unstar drops only the star" "$(mail_state)" "\"id\":\"$flagged\",\"mailbox\":\"INBOX\",\"keywords\":{\"\$answered\":true,\"\$seen\":true}"
	# The fourth message of the state samples is read, answered and labelled; the sixth carries `$Important` as an IMAP client spells it.
	local labelled=00000000-0000-4000-8000-000000000016 by_imap=00000000-0000-4000-8000-000000000018
	assert_eq "mark important" "$(mail_change "[{\"id\":\"$labelled\",\"op\":\"important\"}]" "$good")" 200
	assert_contains "important is added and the label and the other flags stay" "$(mail_state)" "\"id\":\"$labelled\",\"mailbox\":\"INBOX\",\"keywords\":{\"\$seen\":true,\"\$answered\":true,\"Work\":true,\"\$important\":true}"
	mail_change "[{\"id\":\"$by_imap\",\"op\":\"unimportant\"}]" "$good" >/dev/null
	assert_contains "the mark goes in the spelling another client set it in" "$(mail_state)" "\"id\":\"$by_imap\",\"mailbox\":\"INBOX\",\"keywords\":{\"\$flagged\":true}"
	mail_change "[{\"id\":\"$welcome\",\"op\":\"archive\"}]" "$good" >/dev/null
	assert_contains "archive moves it, with a new id" "$(mail_state)" "\"mailbox\":\"Archive\",\"keywords\":{\"\$seen\":true,\"\$flagged\":true},\"subject\":\"Welcome to your mailbox\""
	assert_absent "the old id is gone" "$(mail_state)" "\"id\":\"$welcome\""
	fetch /app/mail "$good"
	assert_absent "the inbox no longer lists it" "$(cat "$work/b")" "Welcome to your mailbox"
	mail_change "[{\"id\":\"$flagged\",\"op\":\"trash\"}]" "$good" >/dev/null
	assert_contains "trash moves it to the trash" "$(mail_state)" "\"mailbox\":\"Trash\""
	local trashed
	trashed=$(mail_state | grep -o '"id":"[^"]*","mailbox":"Trash"' | head -1 | sed 's/"id":"//; s/".*//')
	mail_change "[{\"id\":\"$trashed\",\"op\":\"trash\"}]" "$good" >/dev/null
	assert_absent "deleting from the trash destroys it" "$(mail_state)" "\"id\":\"$trashed\""
	mail_change "[{\"id\":\"$MAIL_NEWSLETTER\",\"op\":\"move\",\"box\":\"Work/Q4\"}]" "$good" >/dev/null
	assert_contains "a move to a named folder" "$(mail_state)" "\"mailbox\":\"Work/Q4\""
	mail_change "[{\"id\":\"$MAIL_TEXT_ONLY\",\"op\":\"spam\"}]" "$good" >/dev/null
	assert_contains "spam moves it to Junk" "$(mail_state)" "\"mailbox\":\"Junk\""
	assert_eq "no DELETE reached the API: a destroy is an Email/set" "$(api_count '"method":"DELETE"')" 0

	# The composer.
	reset_api
	fetch /app/mail/compose "$good"
	assert_eq "GET the composer" "$status" 200
	assert_contains "it is a form with a message field" "$(cat "$work/b")" "<textarea"
	assert_eq "no inline style attribute or element in the composer" "$({ grep -o -E ' style="|<style' "$work/b" || true; } | wc -l | tr -d ' ')" 0
	fetch "/app/mail/compose?mode=reply&msg=$MAIL_NEWSLETTER" "$good"
	assert_contains "a reply is addressed to the sender" "$(cat "$work/b")" "News Bot &lt;news@example.org&gt;"
	assert_contains "with the subject marked" "$(cat "$work/b")" "Re: Weekly newsletter"
	assert_contains "and the original quoted" "$(cat "$work/b")" "&gt; Newsletter, plain version."
	fetch "/app/mail/compose?mode=reply&msg=$MAIL_HOSTILE_HTML" "$good"
	assert_eq "a reply to a hostile message renders" "$status" 200
	assert_absent "its quoted text carries no markup from the sender" "$(cat "$work/b")" "<script>document"
	assert_absent "nor the code that was in it" "$(cat "$work/b")" "pwned"
	fetch "/app/mail/compose?mode=forward&msg=$MAIL_NEWSLETTER" "$good"
	assert_contains "a forward is marked" "$(cat "$work/b")" "Fwd: Weekly newsletter"
	fetch "/app/mail/compose?mode=reply&msg=../x" "$good"
	assert_eq "a hostile id opens an empty composer" "$status" 200

	local draft='{"op":"draft","to":[{"email":"to@example.org"}],"cc":[],"bcc":[{"email":"hidden@example.org"}],"subject":"Draft subject","text":"draft body","attachments":[]}'
	assert_eq "no cookie: compose route is redirected" "$(mail_post /app/mail/compose-message "$draft" "")" 307
	# The upload route is outside the proxy, which would hold its 25 MiB body in
	# memory, so the route answers for itself: no redirect, its own refusal.
	assert_eq "no cookie: the upload route refuses for itself" "$(mail_post /app/mail/upload "x" "" "$panel" application/pdf)" 401
	assert_contains "as unauthenticated" "$(cat "$work/b")" '"reason":"unauthenticated"'
	curl -s -o /dev/null -D "$work/h" -X POST -H "Origin: $panel" -H 'Content-Type: application/pdf' --data-binary x "$panel/app/mail/upload"
	assert_eq "its answer carries its own policy" "$(header content-security-policy)" "default-src 'none'; frame-ancestors 'none'"
	assert_eq "is not to be sniffed" "$(header x-content-type-options)" "nosniff"
	assert_eq "is not to be indexed" "$(header x-robots-tag)" "noindex, nofollow, noarchive, nosnippet, noimageindex"
	assert_eq "and is not to be kept" "$(header cache-control)" "private, no-store"
	assert_eq "a path beside it is still the proxy's: no cookie is sent to sign in" "$(mail_post /app/mail/uploadx "x" "")" 307
	assert_eq "and so is the path with a slash after it" "$(curl -s -o /dev/null -w '%{http_code}' -X POST -H "Origin: $panel" --data-binary x "$panel/app/mail/upload/")" 308
	# A body is declared and never sent: whoever answers has decided without it.
	assert_eq "no cookie: the upload route refuses before any of the body arrives" "$(node "$root/scripts/e2e/lib/declare-only.mjs" "$panel/app/mail/upload?name=a.bin" 26214400)" 401
	assert_eq "a session: a file declared over 25 MiB is refused before any of it arrives" "$(node "$root/scripts/e2e/lib/declare-only.mjs" "$panel/app/mail/upload?name=a.bin" 26214401 "$good")" 413
	before=$(api_count '"method"')
	assert_eq "a foreign origin is refused" "$(mail_post /app/mail/compose-message "$draft" "$good" https://evil.test)" 403
	assert_eq "no origin is refused" "$(mail_post /app/mail/compose-message "$draft" "$good" -)" 403
	assert_eq "a null origin is refused" "$(mail_post /app/mail/compose-message "$draft" "$good" null)" 403
	assert_eq "a foreign origin cannot upload" "$(mail_post /app/mail/upload "x" "$good" https://evil.test application/pdf)" 403
	assert_eq "a body that is not JSON is refused" "$(mail_post /app/mail/compose-message "$draft" "$good" "$panel" text/plain)" 415
	for hostile in '{"op":"send"}' '{"op":"send","to":[{"email":"nope"}],"cc":[],"bcc":[],"subject":"s","text":"t","attachments":[]}' '{"op":"draft","to":[],"cc":[],"bcc":[],"subject":"a\r\nBcc: x@y.org","text":"t","attachments":[]}' '{"op":"draft","to":[],"cc":[],"bcc":[],"subject":"s","text":"t","attachments":[{"blobId":"../../etc/passwd","name":"x","type":"text/plain"}]}' '{"op":"draft","extra":1,"to":[],"cc":[],"bcc":[],"subject":"s","text":"t","attachments":[]}' '{broken'; do
		assert_eq "hostile compose request '${hostile:0:40}' is a 400" "$(mail_post /app/mail/compose-message "$hostile" "$good")" 400
	done
	assert_eq "none of them reached the mail server" "$(api_count '"method"')" "$before"

	assert_eq "saving a draft" "$(mail_post /app/mail/compose-message "$draft" "$good")" 200
	assert_contains "the answer is a closed result" "$(cat "$work/b")" '"kind":"draft"'
	assert_contains "the draft is in the drafts folder, from the account's own address" "$(mail_state)" '"mailbox":"Drafts"'
	assert_absent "the answer carries nothing of the server" "$(cat "$work/b")" "example.test"
	local draft_id
	draft_id=$(grep -o '"id":"[^"]*"' "$work/b" | head -1 | sed 's/"id":"//; s/"//')
	assert_eq "saving it again replaces it" "$(mail_post /app/mail/compose-message "${draft/\"op\":\"draft\"/\"op\":\"draft\",\"draftId\":\"$draft_id\"}" "$good")" 200
	draft_id=$(grep -o '"id":"[^"]*"' "$work/b" | head -1 | sed 's/"id":"//; s/"//')
	assert_eq "there is still one draft" "$({ mail_state | grep -o '"mailbox":"Drafts"' || true; } | wc -l | tr -d ' ')" 1
	fetch "/app/mail?box=Drafts" "$good"
	assert_contains "the drafts folder lists it" "$(cat "$work/b")" "Draft subject"

	assert_eq "a draft id that names an ordinary message is refused" "$(mail_post /app/mail/compose-message "${draft/\"op\":\"draft\"/\"op\":\"draft\",\"draftId\":\"$MAIL_NEWSLETTER\"}" "$good")" 200
	assert_contains "as invalid" "$(cat "$work/b")" '"reason":"invalid"'
	assert_contains "and that message is still there" "$(mail_state)" "\"id\":\"$MAIL_NEWSLETTER\""
	assert_eq "a chunked body, with no Content-Length, is a 411" "$(curl -s -o /dev/null -w '%{http_code}' -X POST -b "$good" -H "Origin: $panel" -H 'Content-Type: application/json' -H 'Transfer-Encoding: chunked' --data-binary "$draft" "$panel/app/mail/compose-message")" 411

	local file_status blob
	file_status=$(mail_post "/app/mail/upload?name=..%2F..%2Freport%22.pdf" "%PDF-1.4 attachment" "$good" "$panel" application/pdf)
	assert_eq "uploading a file" "$file_status" 200
	assert_contains "the answer names a blob and a clean name" "$(cat "$work/b")" '"name":"report_.pdf"'
	blob=$(grep -o '"blobId":"[^"]*"' "$work/b" | sed 's/"blobId":"//; s/"//')
	head -c 12000000 /dev/zero >"$work/big.bin"
	file_status=$(curl -s -o "$work/b" -w '%{http_code}' -X POST -b "$good" -H "Origin: $panel" -H 'Content-Type: application/octet-stream' --data-binary "@$work/big.bin" "$panel/app/mail/upload?name=big.bin")
	assert_eq "a 12 MB file is uploaded whole: it does not pass through the proxy's 2 MB buffer" "$file_status" 200
	assert_contains "and its size is the whole file" "$(cat "$work/b")" '"size":12000000'
	local upload_entry
	upload_entry=$(api_log | { grep -o '{[^{}]*"path":"/jmap/upload/[^{}]*}' || true; } | tail -1)
	assert_contains "the mail server was told its length" "$upload_entry" '"content-length"'
	assert_absent "and did not get it in chunks of unknown total" "$upload_entry" '"transfer-encoding"'
	head -c 27000000 /dev/zero >"$work/huge.bin"
	file_status=$(curl -s -o "$work/b" -w '%{http_code}' -X POST -b "$good" -H "Origin: $panel" -H 'Content-Type: application/octet-stream' --data-binary "@$work/huge.bin" "$panel/app/mail/upload?name=huge.bin" || true)
	assert_eq "a file over 25 MiB is refused" "$file_status" 413
	rm -f "$work/big.bin" "$work/huge.bin"
	# The proxy keeps 2 MB of a body. A message over the composer's own 1.5 MB is
	# refused by its route from its declared size, under that buffer and over it.
	head -c 1600000 /dev/zero | tr '\0' 'a' >"$work/long.json"
	assert_eq "a message of 1.6 MB is refused by the composer's own limit" "$(curl -s -o "$work/b" -w '%{http_code}' -X POST -b "$good" -H "Origin: $panel" -H 'Content-Type: application/json' --data-binary "@$work/long.json" "$panel/app/mail/compose-message")" 413
	assert_contains "with the route's own answer" "$(cat "$work/b")" '"reason":"invalid"'
	head -c 3000000 /dev/zero | tr '\0' 'a' >"$work/long.json"
	assert_eq "and so is one of 3 MB, which the proxy's buffer would have cut" "$(curl -s -o "$work/b" -w '%{http_code}' -X POST -b "$good" -H "Origin: $panel" -H 'Content-Type: application/json' --data-binary "@$work/long.json" "$panel/app/mail/compose-message")" 413
	assert_contains "with the route's own answer too" "$(cat "$work/b")" '"reason":"invalid"'
	assert_eq "a body of 3 MB with no session still gets its answer" "$(curl -s -o /dev/null -w '%{http_code}' -X POST -H "Origin: $panel" --data-binary "@$work/long.json" "$panel/app/mail")" 307
	rm -f "$work/long.json"

	local send="{\"op\":\"send\",\"to\":[{\"name\":\"Zed\",\"email\":\"zed@example.org\"}],\"cc\":[],\"bcc\":[{\"email\":\"hidden@example.org\"}],\"subject\":\"Sent subject\",\"text\":\"sent body\",\"attachments\":[{\"blobId\":\"$blob\",\"name\":\"report_.pdf\",\"type\":\"application/pdf\"}],\"draftId\":\"$draft_id\"}"
	assert_eq "sending" "$(mail_post /app/mail/compose-message "$send" "$good")" 200
	assert_contains "it was sent" "$(cat "$work/b")" '"kind":"sent"'
	assert_contains "to the recipient and the hidden one" "$(mail_sent)" '"to":["zed@example.org"],"cc":[],"bcc":["hidden@example.org"]'
	assert_contains "with its attachment" "$(mail_sent)" '"attachments":["report_.pdf"]'
	assert_contains "a copy is in Sent" "$(mail_state)" '"mailbox":"Sent"'
	assert_eq "the draft it came from is gone" "$({ mail_state | grep -o '"mailbox":"Drafts"' || true; } | wc -l | tr -d ' ')" 0
	local blocked='{"op":"send","to":[{"email":"x@blocked.test"}],"cc":[],"bcc":[],"subject":"Refused","text":"t","attachments":[]}'
	assert_eq "a send the server refuses" "$(mail_post /app/mail/compose-message "$blocked" "$good")" 200
	assert_contains "says why, as a category" "$(cat "$work/b")" '"reason":"forbiddenToSend"'
	assert_absent "without the server's words" "$(cat "$work/b")" "suppression"
	assert_contains "and keeps the work as a draft" "$(mail_state)" '"mailbox":"Drafts"'
	assert_eq "no DELETE reached the API from the composer" "$(api_count '"method":"DELETE"')" 0

	assert_eq "the webmail only reads: no DELETE reached the API" "$(api_count '"method":"DELETE"')" 0
	assert_eq "every call carried the valid bearer" "$(api_count '"bearer":"valid"')" "$(api_count '"method"')"
}
