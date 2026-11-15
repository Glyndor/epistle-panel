import "server-only";

import { z } from "zod";

import { EpistleApiError } from "@/lib/api/error";
import { logApiFailure } from "@/lib/api/log-failure";
import { readJsonBody } from "@/lib/api/read-body";
import { apiBaseUrl } from "@/lib/config/api-url";

import { JMAP_TIMEOUT_MS } from "../call";
import type { MailSession } from "../credentials";

/** The core capability of a JMAP session (RFC 8620 §2). */
export const CORE_CAPABILITY = "urn:ietf:params:jmap:core";

/** The mail capability of a JMAP session (RFC 8621 §1). */
export const MAIL_CAPABILITY = "urn:ietf:params:jmap:mail";

/**
 * Largest number the panel believes a session publishes: epistle's own ceiling
 * for a message, 1 GiB. A number past it is not a limit the panel can work
 * with, so it is not believed.
 */
const MAX_SESSION_NUMBER = 1024 * 1024 * 1024;

/**
 * One capability number: a whole number of bytes or of objects, and not zero
 * (a zero limit is no limit, not a limit of nothing). A value that is
 * missing, of another type, not a whole number, zero, negative, not a number
 * at all or past the ceiling is not a limit the panel can use, and is read as
 * none.
 */
const capabilityNumber = z
	.number()
	.int()
	.positive()
	.max(MAX_SESSION_NUMBER)
	.optional()
	.catch(undefined);

const capabilitySchema = z.object({
	maxSizeUpload: capabilityNumber,
	maxSizeRequest: capabilityNumber,
	maxObjectsInGet: capabilityNumber,
	maxObjectsInSet: capabilityNumber,
	maxSizeAttachmentsPerEmail: capabilityNumber,
});

const sessionSchema = z.object({
	capabilities: z.record(z.string(), z.unknown()).optional(),
});

/**
 * The limits a JMAP session publishes. The composer reads the two it needs
 * (`maxSizeUpload` and `maxSizeRequest`); the others are here because the
 * session states them and the panel may want to know what the server says.
 */
export interface SessionCapabilities {
	/** The largest upload the server accepts, in bytes (`maxSizeUpload`). */
	readonly maxSizeUpload: number | null;
	/** The largest request the server accepts, in bytes (`maxSizeRequest`). */
	readonly maxSizeRequest: number | null;
	/** The most ids one `/get` call may name (`maxObjectsInGet`). */
	readonly maxObjectsInGet: number | null;
	/** The most objects one `/set` call may carry (`maxObjectsInSet`). */
	readonly maxObjectsInSet: number | null;
	/** The largest total of attachments one message may carry (`maxSizeAttachmentsPerEmail`). */
	readonly maxSizeAttachmentsPerEmail: number | null;
}

/** What a session that publishes nothing leaves the panel with. */
export const NO_CAPABILITIES: SessionCapabilities = {
	maxSizeUpload: null,
	maxSizeRequest: null,
	maxObjectsInGet: null,
	maxObjectsInSet: null,
	maxSizeAttachmentsPerEmail: null,
};

/** The numbers of one capability, or nothing when it is not an object the panel can read. */
function readCapability(
	capabilities: Readonly<Record<string, unknown>>,
	name: string,
): z.output<typeof capabilitySchema> | null {
	const raw = capabilities[name];
	if (raw === undefined) {
		return null;
	}
	const parsed = capabilitySchema.safeParse(raw);
	return parsed.success ? parsed.data : null;
}

/**
 * Read the JMAP session resource of `session` and say what limits it
 * publishes.
 *
 * The session resource is where a JMAP server states its own limits (RFC 8620
 * §2), so the panel asks for it instead of holding numbers of its own. Every
 * number is read on its own: one that is missing, of another type, zero,
 * negative, not a number or past the ceiling leaves the others alone, and a
 * session that cannot be read at all leaves every number unset. A number the
 * panel cannot use is never guessed at: the caller falls back to what it held
 * before.
 *
 * The bearer never leaves the server, and the answer is read through the
 * panel's byte cap. A failure is logged with a fixed operation name and
 * nothing of the answer.
 */
export async function readSessionCapabilities(
	session: MailSession,
): Promise<SessionCapabilities> {
	let body: unknown;
	try {
		const response = await fetch(`${apiBaseUrl()}/jmap/session`, {
			headers: {
				Authorization: `Bearer ${session.bearer}`,
				Accept: "application/json",
			},
			cache: "no-store",
			redirect: "error",
			signal: AbortSignal.timeout(JMAP_TIMEOUT_MS),
		});
		if (!response.ok) {
			await response.body?.cancel();
			logApiFailure(
				"mail session limits",
				new EpistleApiError(
					response.status,
					"invalid",
					"the session resource was refused",
				),
			);
			return NO_CAPABILITIES;
		}
		body = await readJsonBody(response);
	} catch (error) {
		logApiFailure("mail session limits", error);
		return NO_CAPABILITIES;
	}
	const parsed = sessionSchema.safeParse(body);
	if (!parsed.success) {
		return NO_CAPABILITIES;
	}
	const capabilities = parsed.data.capabilities ?? {};
	const core = readCapability(capabilities, CORE_CAPABILITY);
	const mail = readCapability(capabilities, MAIL_CAPABILITY);
	return {
		maxSizeUpload: core?.maxSizeUpload ?? null,
		maxSizeRequest: core?.maxSizeRequest ?? null,
		maxObjectsInGet: core?.maxObjectsInGet ?? null,
		maxObjectsInSet: core?.maxObjectsInSet ?? null,
		maxSizeAttachmentsPerEmail: mail?.maxSizeAttachmentsPerEmail ?? null,
	};
}
