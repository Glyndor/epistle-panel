"use client";

import { useState } from "react";

import type { ComposeRefusal } from "@/features/mail/queries/compose-message";

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

/** Where the composer posts. */
export const COMPOSE_ENDPOINT = "/app/mail/compose-message";

/**
 * Post the composer's message to its route and read the closed answer. A
 * network failure, a refusal that is not JSON and an answer of another shape are
 * all `unavailable`: the message stays on screen, nothing is lost.
 */
export function useComposeSubmit() {
	const [pending, setPending] = useState<"draft" | "send" | null>(null);
	const [outcome, setOutcome] = useState<ComposeOutcome>({ kind: "idle" });

	const submit = async (request: ComposeRequest): Promise<ComposeOutcome> => {
		setPending(request.op);
		let result: ComposeOutcome = { kind: "unavailable" };
		try {
			const response = await fetch(COMPOSE_ENDPOINT, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(request),
			});
			const body = (await response.json()) as {
				ok?: boolean;
				result?: ComposeOutcome;
			};
			if (response.ok && body.ok === true && body.result !== undefined) {
				result = body.result;
			}
		} catch {
			result = { kind: "unavailable" };
		}
		setOutcome(result);
		setPending(null);
		return result;
	};

	return { submit, pending, outcome };
}
