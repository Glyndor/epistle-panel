import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

/** The clients of the case under way. The preload empties it after every case. */
const live = new Set<QueryClient>();

/** A query client for tests: no retries, so a failed query settles at once, and the
 * same 30 s freshness as the real one, so hydrated data is not fetched again. */
export function testQueryClient(): QueryClient {
	const client = new QueryClient({
		defaultOptions: {
			queries: { retry: false, gcTime: Infinity, staleTime: 30_000 },
		},
	});
	live.add(client);
	return client;
}

/** Wrap `ui` in a fresh query client, the way the signed-in layout does for real. */
export function withQuery(
	ui: ReactNode,
	client = testQueryClient(),
): ReactNode {
	return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
}

/**
 * What the clients of the case under way still have on its way: the key of
 * every query being fetched, and `mutation` for every mutation not yet settled.
 */
export function inFlight(): string[] {
	const found: string[] = [];
	for (const client of live) {
		for (const query of client
			.getQueryCache()
			.findAll({ fetchStatus: "fetching" })) {
			found.push(JSON.stringify(query.queryKey));
		}
		for (let n = client.isMutating(); n > 0; n--) {
			found.push("mutation");
		}
	}
	return found;
}

/** Longest `settled` waits, in milliseconds. A stubbed request answers in one or two. */
const SETTLE_MS = 1000;

/** Longest the preload waits between two cases, in milliseconds. */
const BETWEEN_MS = 250;

/** Wait until nothing is on its way or `within` has passed; answer what is still left. */
async function idle(within: number): Promise<string[]> {
	const start = Date.now();
	while (inFlight().length > 0 && Date.now() - start <= within) {
		await new Promise((resolve) => setTimeout(resolve, 1));
	}
	return inFlight();
}

/**
 * Wait until the clients of this case have nothing on its way. A file calls it
 * in its `afterEach`, while its `fetch` stub is still in place, so the request
 * finishes against the case's own stub and is counted by the case that made
 * it. It throws, naming what is left, when a request does not settle: a promise
 * left open on purpose has to be closed by its case.
 */
export async function settled(within = SETTLE_MS): Promise<void> {
	const left = await idle(within);
	if (left.length > 0) {
		throw new Error(
			`still on its way after ${within} ms: ${left.join(", ")}`,
		);
	}
}

/**
 * What the preload does before every case: let the requests of the case before
 * it finish, then forget its clients.
 *
 * A request that outlives its case lands in the next case's `fetch` stub, with
 * whatever the next case set (the API token is read when the call is made), and
 * the next case then counts a request it did not make. Whether a case ends with
 * a request on its way depends on the moment it ends, so it cannot be held as a
 * rule after the case: the same case leaves one in one run and none in the
 * next. It can be contained before the next one: the preload's `beforeEach`
 * runs ahead of the file's own (measured), when the next stub is not in place
 * yet, so what is still on its way finishes against whatever the last case left
 * and reaches no stub that counts. A request that never answers is given
 * {@link BETWEEN_MS} and left behind: it can land nowhere.
 */
export async function betweenCases(within = BETWEEN_MS): Promise<string[]> {
	const left = await idle(within);
	live.clear();
	return left;
}
