import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(import.meta.dir, "..", "..");

/**
 * A list that refreshes by itself is the keepalive of the idle timeout, and
 * the person chooses how fast it runs. Two ways to get that wrong compile and
 * pass every other test: a query option that keeps a fixed interval of its own,
 * and a component that asks a polling query for the normal interval and so
 * ignores the person's pace. This reads the sources for both.
 */

/** The query options that poll, by the name the components call them with. */
const POLLING = [
	"statusQueryOptions",
	"queueQueryOptions",
	"deliveriesQueryOptions",
	"suppressionQueryOptions",
	"mailboxesQueryOptions",
	"messageListQueryOptions",
];

function sources(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) {
			return sources(path);
		}
		return /\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name)
			? [path]
			: [];
	});
}

const code = (source: string) =>
	source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/**
 * The text of every call of `name` in `source`, from its opening parenthesis to
 * the one that closes it.
 */
function callsOf(source: string, name: string): string[] {
	const calls: string[] = [];
	for (let at = source.indexOf(`${name}(`); at !== -1; ) {
		let depth = 0;
		let end = at + name.length;
		for (; end < source.length; end += 1) {
			depth += source[end] === "(" ? 1 : source[end] === ")" ? -1 : 0;
			if (depth === 0) {
				break;
			}
		}
		calls.push(source.slice(at, end + 1));
		at = source.indexOf(`${name}(`, end);
	}
	return calls;
}

const files = sources(join(SRC, "features")).map((path) => ({
	path: path.slice(SRC.length + 1),
	source: code(readFileSync(path, "utf8")),
}));

describe("the refreshing lists", () => {
	it("give every polling query option the interval it is handed and keep none of their own", () => {
		const fixed = files
			.filter(({ source }) => /refetchInterval:/.test(source))
			.filter(({ source }) => !/refetchInterval: refreshMs,/.test(source))
			.map(({ path }) => path);

		expect(fixed).toEqual([]);
	});

	it("are read with `useQuery` only at the interval of the person's pace", () => {
		// The account page has a `mailboxesQueryOptions` of its own that does not poll.
		const reads = files.filter(
			({ path, source }) =>
				!path.startsWith("features/account-detail/") &&
				source.includes("useQuery(") &&
				POLLING.some((name) => source.includes(`${name}(`)),
		);

		// The sites the panel has today. The server prefetches the same
		// options with the default interval, which nobody reads.
		expect(reads.map(({ path }) => path).sort()).toEqual([
			"features/deliveries/components/deliveries-table/index.tsx",
			"features/mail/components/folder-pane/index.tsx",
			"features/mail/components/list-toolbar/condition-chips/index.tsx",
			"features/mail/components/mail-search/form/folder-picker/index.tsx",
			"features/mail/components/message-list/index.tsx",
			"features/mail/components/message-reader/index.tsx",
			"features/mail/components/move-menu/index.tsx",
			"features/queue/components/queue-table/index.tsx",
			"features/status/components/status-cards/index.tsx",
			"features/suppression/components/suppression-table/index.tsx",
		]);
		for (const { path, source } of reads) {
			expect([path, source.includes("useRefreshInterval(")]).toEqual([
				path,
				true,
			]);
			// And the interval it read is the one the polling query is given.
			for (const name of POLLING) {
				for (const call of callsOf(source, name)) {
					expect([path, name, call.includes("refreshMs")]).toEqual([
						path,
						name,
						true,
					]);
				}
			}
		}
	});
});
