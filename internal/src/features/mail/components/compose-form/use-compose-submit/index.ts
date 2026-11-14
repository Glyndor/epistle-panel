import { useState } from "react";

import type { ComposeRefusal } from "@/features/mail/queries/compose-message";
import { MAX_COMPOSE_BYTES } from "@/features/mail/schemas/compose-input-limits";

/** What the form shows after a request: nothing, a saved draft, a sent message, or why not. */
export type ComposeOutcome =
	| { readonly kind: "idle" }
	| { readonly kind: "draft"; readonly id: string }
	| { readonly kind: "sent" }
	| {
			readonly kind: "refused";
			readonly reason: ComposeRefusal;
			readonly draftId: string | null;
	  }
	| { readonly kind: "noSender" }
	| { readonly kind: "unavailable" };

/** The request body: the structured message the route's schema reads. */
export interface ComposeRequest {
	readonly op: "draft" | "send";
	readonly draftId?: string | undefined;
	readonly to: unknown[];
	readonly cc: unknown[];
	readonly bcc: unknown[];
	readonly subject: string;
	readonly text: string;
	readonly attachments: unknown[];
	readonly inReplyTo?: string | undefined;
	readonly references?: string[] | undefined;
}

/** The message is over the size the route reads: nothing was sent or saved. */
const TOO_LARGE: ComposeOutcome = {
	kind: "refused",
	reason: "tooLarge",
	draftId: null,
};

/** Where the composer posts. */
export const COMPOSE_ENDPOINT = "/app/mail/compose-message";

/**
 * Post the composer's message to its route and read the closed answer. A
 * message over the size the route reads is refused as too large, here before it
 * is sent and again if the route answers 413. A network failure, a refusal that
 * is not JSON and an answer of another shape are all `unavailable`. In every
 * case the message stays on screen, nothing is lost.
 */
export function useComposeSubmit() {
	const [pending, setPending] = useState<"draft" | "send" | null>(null);
	const [outcome, setOutcome] = useState<ComposeOutcome>({ kind: "idle" });

	const submit = async (request: ComposeRequest): Promise<ComposeOutcome> => {
		setPending(request.op);
		let result: ComposeOutcome = { kind: "unavailable" };
		const json = JSON.stringify(request);
		if (new TextEncoder().encode(json).byteLength > MAX_COMPOSE_BYTES) {
			// The route would refuse it by its size: say so here, and send nothing.
			result = TOO_LARGE;
		} else {
			try {
				const response = await fetch(COMPOSE_ENDPOINT, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: json,
				});
				if (response.status === 413) {
					result = TOO_LARGE;
				} else {
					const body = (await response.json()) as {
						ok?: boolean;
						result?: ComposeOutcome;
					};
					if (
						response.ok &&
						body.ok === true &&
						body.result !== undefined
					) {
						result = body.result;
					}
				}
			} catch {
				result = { kind: "unavailable" };
			}
		}
		setOutcome(result);
		setPending(null);
		return result;
	};

	return { submit, pending, outcome };
}
