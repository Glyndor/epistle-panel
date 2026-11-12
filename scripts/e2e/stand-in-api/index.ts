/**
 * Stand-in for the epistle management API, used only by the end-to-end checks
 * in `scripts/e2e`. It answers the paths the panel calls with the shapes the
 * panel's zod schemas accept, and it records every request so a check can tell
 * whether the panel reached it.
 *
 * Run it with `bun scripts/e2e/stand-in-api/index.ts`. Configuration comes from
 * the environment: `STAND_IN_PORT` (default 18025) and `STAND_IN_TOKEN`, the
 * bearer token it expects. It binds to 127.0.0.1 only.
 *
 * The log never holds a secret. An `Authorization` header is reduced to
 * `absent`, `valid` or `wrong`, and a sign-in body is reduced to the account
 * name.
 */

/** Behaviour of the data endpoints, switched at run time through the control path. */
export type Mode = "ok" | "hang" | "huge";

/** One recorded request. */
export interface LoggedRequest {
	method: string;
	path: string;
	/** Whether the bearer token was missing, matched the configured one or did not. */
	bearer: "absent" | "valid" | "wrong";
	/** Lower-case names of the headers received, values left out. */
	headers: string[];
	/** The account name of a sign-in call; never the password. */
	name?: string;
}

/** Options of {@link createStandIn}. */
export interface StandInOptions {
	/** Port to listen on; 0 picks a free one. */
	port?: number;
	/** Bearer token the API accepts. */
	token: string;
}

/** Accounts the stand-in knows: name to password and admin flag. */
export const ACCOUNTS: Readonly<
	Record<string, { password: string; admin: boolean }>
> = {
	admin: { password: "correct-horse", admin: true },
	ops: { password: "other-battery", admin: true },
	user: { password: "plain-staple", admin: false },
};

/** Entries the queue holds at the start, in the order the API lists them. */
const SEED_IDS = [
	"11111111-1111-4111-8111-111111111111",
	"22222222-2222-4222-8222-222222222222",
	"33333333-3333-4333-8333-333333333333",
	"44444444-4444-4444-8444-444444444444",
	"55555555-5555-4555-8555-555555555555",
];

/** Entries per queue page when the caller gives no `limit`. */
const DEFAULT_PAGE = 2;

/** Bytes the `huge` mode streams: well over the panel's 5 MiB cap. */
const HUGE_BYTES = 64 * 1024 * 1024;

const CHUNK = new TextEncoder().encode(`${" ".repeat(65_535)}\n`);

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

function apiError(status: number, code: string, message: string): Response {
	return json({ error: { code, message } }, status);
}

/** A body that never ends within the panel's budget and has no `content-length`. */
function hugeBody(): Response {
	let sent = 0;
	const stream = new ReadableStream<Uint8Array>({
		pull(controller) {
			if (sent === 0) {
				controller.enqueue(new TextEncoder().encode('{"domains":["'));
			}
			controller.enqueue(CHUNK);
			sent += CHUNK.byteLength;
			if (sent >= HUGE_BYTES) {
				controller.enqueue(new TextEncoder().encode('"]}'));
				controller.close();
			}
		},
	});
	return new Response(stream, {
		headers: { "Content-Type": "application/json" },
	});
}

/** Start a stand-in API and return the server together with its control handle. */
export function createStandIn(options: StandInOptions) {
	const log: LoggedRequest[] = [];
	let mode: Mode = "ok";
	let queue = [...SEED_IDS];

	const bearerOf = (request: Request): LoggedRequest["bearer"] => {
		const header = request.headers.get("authorization");
		if (header === null) {
			return "absent";
		}
		return header === `Bearer ${options.token}` ? "valid" : "wrong";
	};

	async function handleControl(
		request: Request,
		path: string,
	): Promise<Response> {
		if (path === "/__control/log") {
			return json(log);
		}
		if (path === "/__control/reset") {
			log.length = 0;
			mode = "ok";
			queue = [...SEED_IDS];
			return json({ ok: true });
		}
		if (path === "/__control/mode" && request.method === "POST") {
			const body = (await request.json()) as { mode?: string };
			if (body.mode !== "ok" && body.mode !== "hang" && body.mode !== "huge") {
				return json({ error: "unknown mode" }, 400);
			}
			mode = body.mode;
			return json({ mode });
		}
		return json({ error: "unknown control path" }, 404);
	}

	function handleQueue(request: Request, url: URL): Response {
		const limit = Number(url.searchParams.get("limit")) || DEFAULT_PAGE;
		const cursor = url.searchParams.get("cursor");
		const start = cursor === null ? 0 : queue.indexOf(cursor);
		if (start < 0) {
			return apiError(400, "bad_cursor", "Unknown cursor");
		}
		const ids = queue.slice(start, start + limit);
		const next = queue[start + limit];
		return json({
			entries: ids.map((id) => ({
				id,
				reverse_path: `sender-${id.slice(0, 1)}@example.test`,
				recipients: [`rcpt-${id.slice(0, 1)}@example.net`],
			})),
			...(next === undefined ? {} : { next_cursor: next }),
		});
	}

	async function handle(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;
		if (path.startsWith("/__control/")) {
			return handleControl(request, path);
		}

		const entry: LoggedRequest = {
			method: request.method,
			path: url.pathname + url.search,
			bearer: bearerOf(request),
			headers: [...request.headers.keys()].sort(),
		};
		log.push(entry);

		if (entry.bearer !== "valid") {
			return apiError(401, "unauthorized", "Missing or invalid token");
		}

		if (path === "/api/v1/auth/verify" && request.method === "POST") {
			const body = (await request.json()) as {
				name?: string;
				password?: string;
			};
			entry.name = String(body.name ?? "");
			const account = ACCOUNTS[entry.name];
			const valid = account !== undefined && account.password === body.password;
			return json({ valid, admin: valid && account.admin });
		}

		if (mode === "hang") {
			return new Promise<Response>(() => {});
		}
		if (mode === "huge") {
			return hugeBody();
		}

		if (path === "/api/v1/status") {
			return json({
				version: "0.0.0-stand-in",
				domains: 1,
				accounts: Object.keys(ACCOUNTS).length,
				queue_size: queue.length,
			});
		}
		if (path === "/api/v1/domains") {
			return json({ domains: ["example.test"] });
		}
		if (path === "/api/v1/accounts") {
			return json({
				accounts: Object.keys(ACCOUNTS).map((name) => ({
					name,
					addresses: [`${name}@example.test`],
				})),
			});
		}
		if (path === "/api/v1/queue" && request.method === "GET") {
			return handleQueue(request, url);
		}
		const removal = /^\/api\/v1\/queue\/([^/]+)$/.exec(path);
		if (removal && request.method === "DELETE") {
			const id = decodeURIComponent(removal[1] ?? "");
			if (!queue.includes(id)) {
				return apiError(404, "not_found", "No such queue entry");
			}
			queue = queue.filter((other) => other !== id);
			return json({ removed: id });
		}
		return apiError(404, "not_found", "No such endpoint");
	}

	const server = Bun.serve({
		hostname: "127.0.0.1",
		port: options.port ?? 0,
		// A `hang` response must outlive Bun's default idle timeout.
		idleTimeout: 0,
		fetch: handle,
	});
	return { server, log };
}

if (import.meta.main) {
	const token = process.env.STAND_IN_TOKEN;
	if (!token) {
		console.error("STAND_IN_TOKEN is required");
		process.exit(1);
	}
	const { server } = createStandIn({
		port: Number(process.env.STAND_IN_PORT ?? 18025),
		token,
	});
	console.log(`stand-in API listening on ${server.url}`);
}
