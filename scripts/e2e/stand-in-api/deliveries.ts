import { apiError, json } from "./responses";

const OUTCOMES = ["delivered", "deferred", "failed", "suppressed", "canceled"];

/** Most records a page holds, the real API's ceiling. */
const MAX_LIMIT = 100;

/** Seconds in each unit the API's `since` accepts. */
const UNIT_SECONDS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86_400 };

interface Seed {
	/** Age in seconds at the time the stand-in started. */
	ageSeconds: number;
	account: string | null;
	from: string;
	recipient: string;
	outcome: string;
	remote: string | null;
	reply: string | null;
	attempt: number;
}

/**
 * The records at the start, in the order the real API lists them for one day:
 * oldest first. One reply holds markup, to show the panel prints it as text.
 */
const SEED: Seed[] = [
	{ ageSeconds: 10 * 86_400, account: "admin", from: "admin@example.test", recipient: "old@example.net", outcome: "canceled", remote: null, reply: null, attempt: 0 },
	{ ageSeconds: 2 * 86_400, account: "ops", from: "ops@example.test", recipient: "blocked@example.net", outcome: "suppressed", remote: null, reply: null, attempt: 0 },
	{ ageSeconds: 3 * 3600, account: "admin", from: "admin@example.test", recipient: "missing@example.net", outcome: "failed", remote: "mx.example.net", reply: "550 <script>alert(1)</script> no such user", attempt: 3 },
	{ ageSeconds: 600, account: "ops", from: "ops@example.test", recipient: "slow@example.net", outcome: "deferred", remote: "mx.example.net", reply: "451 try again later", attempt: 1 },
	{ ageSeconds: 60, account: null, from: "", recipient: "ok@example.net", outcome: "delivered", remote: "mx.example.net", reply: "250 ok", attempt: 1 },
];

/** A `since` value as the API reads a duration; `undefined` when it is not one. */
function sinceEpoch(value: string, now: number): number | undefined {
	const match = /^(\d+)([smhd])$/.exec(value);
	if (!match) {
		return undefined;
	}
	return now - Number(match[1]) * (UNIT_SECONDS[match[2] ?? "s"] ?? 1);
}

/**
 * `GET /api/v1/deliveries`, as `epistle` answers it: `recipient`, `account`,
 * `since` (a duration) and `outcome` narrow the records, `limit` is cut to 1 to
 * 100, an unknown outcome or a bad `since` is `400 invalid_input`, and there is
 * no cursor. The log is read-only.
 */
export function createDeliveriesStore() {
	const started = Math.floor(Date.now() / 1000);
	const spoolId = (index: number) =>
		`aaaaaaaa-aaaa-4aaa-8aaa-${String(index + 1).padStart(12, "0")}`;

	return {
		/** Answer a deliveries request, or `undefined` when the path is not one. */
		handle(request: Request, url: URL): Response | undefined {
			if (url.pathname !== "/api/v1/deliveries" || request.method !== "GET") {
				return undefined;
			}
			const params = url.searchParams;
			const outcome = params.get("outcome")?.trim();
			if (outcome && !OUTCOMES.includes(outcome)) {
				return apiError(400, "invalid_input", `unknown outcome "${outcome}"`);
			}
			const sinceText = params.get("since")?.trim();
			const since = sinceText ? sinceEpoch(sinceText, started) : undefined;
			if (sinceText && since === undefined) {
				return apiError(400, "invalid_input", `since "${sinceText}": not a duration`);
			}
			const asked = params.get("limit");
			const limit = Math.min(Math.max(asked === null ? 50 : Number(asked) || 0, 1), MAX_LIMIT);
			const recipient = params.get("recipient")?.trim();
			const account = params.get("account")?.trim();
			const entries = SEED.map((seed, index) => ({
				time: started - seed.ageSeconds,
				spool_id: spoolId(index),
				account: seed.account,
				from: seed.from,
				recipient: seed.recipient,
				outcome: seed.outcome,
				remote: seed.remote,
				reply: seed.reply,
				attempt: seed.attempt,
				extra: {},
			}))
				.filter((entry) => !outcome || entry.outcome === outcome)
				.filter((entry) => since === undefined || entry.time >= since)
				.filter((entry) => !recipient || entry.recipient === recipient)
				.filter((entry) => !account || entry.account === account)
				.slice(0, limit);
			return json({ entries });
		},
	};
}
