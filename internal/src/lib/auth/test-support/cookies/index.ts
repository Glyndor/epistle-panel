import { mock } from "bun:test";

import { createSession, SESSION_COOKIE } from "../../session";

/** What a Server Action or Component asked the cookie store to write. */
export interface CookieWrite {
	name: string;
	value: string;
	options: Record<string, unknown> | undefined;
}

/** Thrown by the stubbed `redirect`, carrying the target path. */
export class RedirectSignal extends Error {
	readonly target: string;

	constructor(target: string) {
		super(`NEXT_REDIRECT ${target}`);
		this.target = target;
	}
}

/** Thrown by the stubbed `notFound`, as the real one throws to render the 404 page. */
export class NotFoundSignal extends Error {
	constructor() {
		super("NEXT_NOT_FOUND");
	}
}

/**
 * Await an action that ends in `redirect()` and return the signal it threw.
 * Any other rejection (a TypeError from the action, say) is rethrown, and an
 * action that returns instead of redirecting fails, so a test that only wants
 * the side effects of a redirecting action cannot swallow a real error.
 */
export async function followRedirect(
	action: Promise<unknown>,
): Promise<RedirectSignal> {
	try {
		await action;
	} catch (error) {
		if (error instanceof RedirectSignal) {
			return error;
		}
		throw error;
	}
	throw new Error("expected the action to redirect, but it returned");
}

/**
 * Replace `next/headers` and `next/navigation` with an in-memory cookie jar and
 * a `redirect` that throws {@link RedirectSignal}, as the real one throws to
 * stop the render. Returns handles to sign a session in or out and to read what
 * was written. Call it from the test file before importing the code under test.
 */
export function mockRequestCookies() {
	const jar = new Map<string, string>();
	const writes: CookieWrite[] = [];

	mock.module("next/headers", () => ({
		cookies: async () => ({
			get: (name: string) => {
				const value = jar.get(name);
				return value === undefined ? undefined : { name, value };
			},
			set: (
				name: string,
				value: string,
				options?: Record<string, unknown>,
			) => {
				writes.push({ name, value, options });
				jar.set(name, value);
			},
			delete: (name: string) => {
				jar.delete(name);
			},
		}),
	}));
	mock.module("next/navigation", () => ({
		redirect: (target: string) => {
			throw new RedirectSignal(target);
		},
		notFound: () => {
			throw new NotFoundSignal();
		},
		usePathname: () => "/",
	}));

	return {
		jar,
		writes,
		/** Put a freshly minted session for `sub` in the jar and return its token. */
		async signIn(sub = "admin"): Promise<string> {
			const token = await createSession(sub);
			jar.set(SESSION_COOKIE, token);
			return token;
		},
		/** Empty the jar and the write log. */
		reset(): void {
			jar.clear();
			writes.length = 0;
		},
	};
}
