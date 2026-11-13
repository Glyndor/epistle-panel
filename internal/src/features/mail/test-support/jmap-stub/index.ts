import { mock } from "bun:test";

import type { MailSession } from "@/features/mail/jmap/credentials";

/** The session the unit tests act as. */
export const SESSION: MailSession = {
	accountId: "admin",
	bearer: "test-bearer",
};

/** One request the stub saw. */
export interface JmapRequest {
	readonly url: string;
	readonly method: string;
	readonly authorization: string | null;
	readonly calls: ReadonlyArray<
		readonly [string, Record<string, unknown>, string]
	>;
}

type Handler = (args: Record<string, unknown>) => unknown;

/** What a JMAP stub answers a method with: the arguments object, or a function of the call's arguments. */
export type Answers = Record<string, unknown | Handler>;

/**
 * Replace global `fetch` with a JMAP server that answers each method call
 * from `answers` (by method name), and every `/jmap/download` with `blob` when
 * given. A method that has no answer is `unknownMethod`, like the real server.
 * Returns the requests seen, in order.
 */
export function stubJmap(answers: Answers, blob?: Response): JmapRequest[] {
	const seen: JmapRequest[] = [];
	globalThis.fetch = mock(async (input: string | URL, init?: RequestInit) => {
		const url = String(input);
		const headers = new Headers(init?.headers);
		if (url.includes("/jmap/download/")) {
			seen.push({
				url,
				method: init?.method ?? "GET",
				authorization: headers.get("authorization"),
				calls: [],
			});
			return blob ?? new Response("not found", { status: 404 });
		}
		const body = JSON.parse(String(init?.body)) as {
			methodCalls: Array<[string, Record<string, unknown>, string]>;
		};
		seen.push({
			url,
			method: init?.method ?? "GET",
			authorization: headers.get("authorization"),
			calls: body.methodCalls,
		});
		const methodResponses = body.methodCalls.map(([name, args, id]) => {
			const answer = answers[name];
			if (answer === undefined) {
				return ["error", { type: "unknownMethod" }, id];
			}
			return [
				name,
				typeof answer === "function"
					? (answer as Handler)(args)
					: answer,
				id,
			];
		});
		return new Response(JSON.stringify({ methodResponses }), {
			status: 200,
			headers: { "content-type": "application/json" },
		});
	}) as unknown as typeof fetch;
	return seen;
}

let counter = 0;

/** A UUID-shaped id, distinct per call. */
export function uuid(): string {
	counter += 1;
	return `00000000-0000-4000-8000-${counter.toString(16).padStart(12, "0")}`;
}

/** An Email object as epistle returns it, with `overrides` on top. */
export function emailFixture(
	overrides: Record<string, unknown> = {},
): Record<string, unknown> {
	return {
		id: uuid(),
		receivedAt: "2026-11-12T10:00:00Z",
		subject: "Hello",
		from: [{ name: "Ana", email: "ana@example.org" }],
		to: [{ name: null, email: "admin@example.org" }],
		cc: null,
		replyTo: null,
		keywords: {},
		preview: "preview text",
		hasAttachment: false,
		mailboxIds: { INBOX: true },
		messageId: ["m1@example.org"],
		bodyStructure: null,
		textBody: [],
		htmlBody: [],
		attachments: [],
		bodyValues: {},
		...overrides,
	};
}
