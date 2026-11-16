import { mediaTypeSchema } from "@/features/mail/schemas/compose-input";

/**
 * The type an attachment leaves with when the one it claims is not one that
 * can be handed over as it is. Every browser and every mail client saves a
 * file of this type instead of running it.
 */
export const SAFE_ATTACHMENT_TYPE = "application/octet-stream";

/**
 * The types a browser or a mail client runs or renders as a page: markup that
 * can carry script, and the scripting types themselves. An attachment that
 * claims one of these is rendered, not saved, by whoever receives it.
 */
const ACTIVE_TYPES: ReadonlySet<string> = new Set([
	"text/html",
	"text/html-sandboxed",
	"application/xhtml",
	"application/xhtml+xml",
	"image/svg",
	"image/svg+xml",
	"text/xml",
	"application/xml",
	"text/xsl",
	"application/xslt+xml",
	"text/javascript",
	"application/javascript",
	"text/ecmascript",
	"application/ecmascript",
	// The rest of the WHATWG MIME Sniffing "JavaScript MIME type" list: a
	// browser runs a script served under any of these aliases.
	"application/x-javascript",
	"application/x-ecmascript",
	"text/x-javascript",
	"text/x-ecmascript",
	"text/jscript",
	"text/livescript",
	"text/javascript1.0",
	"text/javascript1.1",
	"text/javascript1.2",
	"text/javascript1.3",
	"text/javascript1.4",
	"text/javascript1.5",
]);

/**
 * Whether `type` is one of those. The structured suffix counts as well: a
 * subtype that ends in `+xml` is markup under another name, whatever its type
 * says.
 */
function isActiveType(type: string): boolean {
	const subtype = type.slice(type.indexOf("/") + 1);
	return ACTIVE_TYPES.has(type) || subtype.endsWith("+xml");
}

/**
 * The type an attachment goes out with, given the one it claims.
 *
 * The claim comes from the browser, so it is read twice: it must be a plain
 * media type (`type/subtype`, no parameters, no control characters, of a
 * bounded length), and it must not be one a browser or a mail client runs or
 * renders as a page. Anything else leaves as `application/octet-stream`. The
 * ordinary types keep the one they have: a PDF, an image, an office document,
 * an archive, plain text, a CSV, a message.
 */
export function safeAttachmentType(
	declared: string | null | undefined,
): string {
	if (declared === null || declared === undefined) {
		return SAFE_ATTACHMENT_TYPE;
	}
	if (!mediaTypeSchema.safeParse(declared).success) {
		return SAFE_ATTACHMENT_TYPE;
	}
	return isActiveType(declared) ? SAFE_ATTACHMENT_TYPE : declared;
}
