import "server-only";

import { z } from "zod";

import { ConfigError } from "../config-error";

/**
 * Name of the variable that holds the line the panel shows at the foot of its
 * pages.
 */
export const COPYRIGHT_NOTICE_VARIABLE = "EPISTLE_PANEL_COPYRIGHT_NOTICE";

/**
 * The line the panel shows when the operator sets none: the original notice of
 * the panel's own copyright.
 */
export const DEFAULT_COPYRIGHT_NOTICE = "© 2026 Glyndor";

/**
 * The value that says the panel shows no line at all. A white label carries no
 * notice of another company, so the operator spells it exactly like this:
 * `none`, in lower case and alone. Any other value is the line itself, as
 * plain text, and a line that reads `none` cannot be shown.
 */
export const COPYRIGHT_NOTICE_NONE = "none";

/** Longest line an operator may set, in characters. */
export const MAX_COPYRIGHT_NOTICE_LENGTH = 200;

/**
 * The line an operator may set: plain text, at most
 * {@link MAX_COPYRIGHT_NOTICE_LENGTH} characters once trimmed, and without a
 * control character (a line break in a foot is a defect, not a notice). It is
 * rendered as text and never as markup: React escapes it wherever it is shown,
 * so a value that looks like HTML is shown as the characters it is.
 */
const copyrightNoticeSchema = z
	.string()
	.trim()
	.min(1)
	.max(MAX_COPYRIGHT_NOTICE_LENGTH)
	// biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting control characters is the point
	.regex(/^[^\u0000-\u001f\u007f]+$/);

/**
 * The line the operator chose, read from the variable.
 *
 * Unset or empty keeps the panel's own line. The word `none` says no line at
 * all, and `null` is what that means. Any other value is the line itself.
 *
 * A value that cannot be shown is a mistake an operator must hear about: it
 * throws a `ConfigError` that names the variable and never the value, and the
 * start refuses to go on with it.
 */
export function readCopyrightNotice(): string | null {
	const value = (process.env[COPYRIGHT_NOTICE_VARIABLE] ?? "").trim();
	if (value === "") {
		return DEFAULT_COPYRIGHT_NOTICE;
	}
	if (value === COPYRIGHT_NOTICE_NONE) {
		return null;
	}
	const parsed = copyrightNoticeSchema.safeParse(value);
	if (!parsed.success) {
		throw new ConfigError(
			`${COPYRIGHT_NOTICE_VARIABLE} is set to a line that cannot be shown`,
		);
	}
	return parsed.data;
}

/**
 * The line the panel shows, or the panel's own when the variable cannot be
 * read.
 *
 * The start is the gate: it refuses to go on with a value that does not parse,
 * so a server that kept running would only be a server whose environment
 * changed under it.
 */
export function copyrightNotice(): string | null {
	try {
		return readCopyrightNotice();
	} catch {
		return DEFAULT_COPYRIGHT_NOTICE;
	}
}
