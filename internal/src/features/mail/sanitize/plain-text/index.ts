import { safeBody } from "@/features/mail/sanitize/safe-text";
import { sanitizeHtml } from "@/features/mail/sanitize/sanitize-html";

const ENTITIES: Record<string, string> = {
	"&amp;": "&",
	"&lt;": "<",
	"&gt;": ">",
	"&quot;": '"',
	"&#39;": "'",
	"&nbsp;": " ",
};

/**
 * The text of an HTML body, for quoting it in a reply. It goes through the
 * sanitiser first, so only allow-listed markup is ever looked at; block ends and
 * line breaks become line breaks, every tag is dropped and the few entities the
 * sanitiser writes are decoded. The result is plain text for a text area: it is
 * never put back into a page as markup.
 */
export function plainTextOf(html: string): string {
	const { html: clean } = sanitizeHtml(html, { remoteImages: false });
	const text = clean
		.replace(/<br\s*\/?>/giu, "\n")
		.replace(/<\/(?:p|div|li|tr|h[1-6]|blockquote|pre|table)>/giu, "\n")
		.replace(/<[^>]*>/gu, "")
		.replace(
			/&(?:amp|lt|gt|quot|#39|nbsp);/gu,
			(entity) => ENTITIES[entity] ?? entity,
		);
	return safeBody(text)
		.replace(/\n{3,}/gu, "\n\n")
		.trim();
}
