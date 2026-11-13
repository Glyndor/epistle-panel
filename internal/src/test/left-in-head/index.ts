/**
 * Remove the scripts a case left in the document's head.
 *
 * Test files share one document in one process. A component that loads a script
 * (the CAPTCHA widget) adds a `<script>` to the head, and unmounting it does not
 * take the script away, as it would not in a browser. A later case that counts
 * the scripts in the head then counts another file's: the sign-in page's file
 * left two, and the form's "no script when the CAPTCHA is off" case, when it
 * ran right after, found two instead of none. The preload calls this before
 * every case, so a case sees only the scripts it added itself.
 */
export function removeScriptsLeftInHead(): number {
	const left = [...document.head.querySelectorAll("script")];
	for (const script of left) {
		script.remove();
	}
	return left.length;
}
