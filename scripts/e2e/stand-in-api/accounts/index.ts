/**
 * The per-account half of the stand-in API: the endpoints behind the account
 * detail page. It follows the real server's answers (status codes, error codes,
 * the shapes in epistle's OpenAPI document) and keeps its state in memory so a
 * scenario can read what a change did through `snapshot()`.
 *
 * It never keeps a secret. A new password is checked against the policy and
 * dropped, only the number of changes is counted; the TOTP secret it hands out
 * is a fixed public string.
 */

/** The TOTP secret the stand-in returns on enrolment. Public, so a log or a page that holds it is a finding. */
export const STAND_IN_TOTP_SECRET = "STANDINTOTPSECRET2";

/** Passwords the stand-in treats as breached, as the server's list would. */
const BREACHED = new Set(["password1234", "qwertyuiop12"]);

/** Masked addresses one account may hold before the stand-in answers `409`. */
export const MASKED_LIMIT = 3;

const DOMAIN = "example.test";

interface MaskedEntry {
	address: string;
	label: string;
	enabled: boolean;
	created_at: number;
	last_used_at?: number;
}

interface ArchiveEntry {
	id: string;
	mailbox: string;
	deleted_at: number;
}

interface AccountState {
	displayName: string | null;
	totp: boolean;
	passwordChanges: number;
	masked: MaskedEntry[];
	/** `null` answers `404 archive not available`, as a server with retention off does. */
	archive: ArchiveEntry[] | null;
	addresses: string[];
	/** False for an account "declared in the configuration file": the API cannot delete it. */
	dynamic: boolean;
}

/** The seed account the stand-in treats as declared in the configuration file. */
export const FILE_ACCOUNT = "ops";

/** What `snapshot()` reports for one account: state a check can read, never a secret. */
export type AccountSnapshot = Omit<AccountState, "archive"> & {
	archive: string[] | null;
};

const ARCHIVE_SEED: ArchiveEntry[] = [
	{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", mailbox: "INBOX", deleted_at: 1_700_000_000 },
	{ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", mailbox: "Gone", deleted_at: 1_700_000_500 },
];

const MAILBOXES = [
	{ id: "INBOX", name: "INBOX", parent_id: null },
	{ id: "INBOX/Work", name: "Work", parent_id: "INBOX" },
	{ id: "Sent", name: "Sent", parent_id: null },
];

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

const apiError = (status: number, code: string, message: string) =>
	json({ error: { code, message } }, status);

const slug = (label: string) =>
	label
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");

/** Eight base32 characters from a counter, so addresses are stable within a run. */
const BASE32 = "abcdefghijklmnopqrstuvwxyz234567";
const suffix = (n: number) =>
	`aaaaaa${BASE32[n % 32]}${BASE32[Math.floor(n / 32) % 32]}`;

async function bodyOf(request: Request): Promise<Record<string, unknown> | null> {
	if (!request.headers.get("content-type")?.includes("application/json")) {
		return null;
	}
	try {
		const body: unknown = await request.json();
		return typeof body === "object" && body !== null && !Array.isArray(body)
			? (body as Record<string, unknown>)
			: null;
	} catch {
		return null;
	}
}

/** The accounts' state and the handler for their endpoints. `names` are the accounts the stand-in knows. */
export function createAccountsStore(names: readonly string[]) {
	let counter = 0;
	let state = fresh();

	function fresh(): Map<string, AccountState> {
		counter = 0;
		return new Map(
			names.map((name) => [
				name,
				{
					displayName: name === "admin" ? "Admin Person" : null,
					totp: false,
					passwordChanges: 0,
					masked: [],
					archive: name === "admin" ? ARCHIVE_SEED.map((e) => ({ ...e })) : null,
					addresses: [`${name}@example.test`],
					dynamic: name !== FILE_ACCOUNT,
				},
			]),
		);
	}

	const unknownAccount = () => apiError(404, "not_found", "no such account");

	async function handle(request: Request, path: string): Promise<Response | null> {
		const match = /^\/api\/v1\/accounts\/([^/]+)\/([^/]+)(?:\/(.+))?$/.exec(path);
		if (!match) {
			return null;
		}
		const name = decodeURIComponent(match[1] ?? "");
		const section = match[2];
		const rest = match[3] === undefined ? undefined : decodeURIComponent(match[3]);
		const account = state.get(name);
		const method = request.method;

		if (account === undefined) {
			return unknownAccount();
		}
		if (section === "mailboxes" && method === "GET") {
			return json({ mailboxes: MAILBOXES.map((m) => m.id), tree: MAILBOXES });
		}
		if (section === "display_name" && method === "PUT") {
			const body = await bodyOf(request);
			if (body === null || typeof body["display_name"] !== "string") {
				return apiError(422, "invalid_input", "Failed to deserialize the JSON body");
			}
			const trimmed = body["display_name"].trim();
			if ([...trimmed].length > 128 || /\p{Cc}/u.test(trimmed)) {
				return apiError(400, "invalid_input", "the display name is not acceptable");
			}
			account.displayName = trimmed === "" ? null : trimmed;
			return json({ display_name: account.displayName });
		}
		if (section === "password" && method === "PUT") {
			const body = await bodyOf(request);
			const password = body?.["password"];
			if (typeof password !== "string") {
				return apiError(422, "invalid_input", "Failed to deserialize the JSON body");
			}
			if (
				password.length < 12 ||
				password.length > 64 ||
				!/^[\x20-\x7e]+$/.test(password) ||
				BREACHED.has(password.toLowerCase())
			) {
				return apiError(400, "invalid_input", "the password is not acceptable");
			}
			account.passwordChanges += 1;
			return json({ updated: name });
		}
		if (section === "totp" && method === "POST") {
			account.totp = true;
			return json({
				secret: STAND_IN_TOTP_SECRET,
				otpauth_uri: `otpauth://totp/${DOMAIN}:${name}?secret=${STAND_IN_TOTP_SECRET}&issuer=${DOMAIN}`,
			});
		}
		if (section === "totp" && method === "DELETE") {
			account.totp = false;
			return json({ updated: name });
		}
		if (section === "masked") {
			return handleMasked(request, account, rest);
		}
		if (section === "archive") {
			return handleArchive(account, method, rest);
		}
		return apiError(404, "not_found", "No such endpoint");
	}

	async function handleMasked(
		request: Request,
		account: AccountState,
		rest: string | undefined,
	): Promise<Response> {
		if (rest === undefined && request.method === "GET") {
			return json({ addresses: account.masked });
		}
		if (rest === undefined && request.method === "POST") {
			const body = await bodyOf(request);
			if (body === null || typeof body["label"] !== "string") {
				return apiError(422, "invalid_input", "Failed to deserialize the JSON body");
			}
			const base = slug(body["label"]);
			if (base === "") {
				return apiError(400, "invalid_input", "the label has no letter or digit");
			}
			if (account.masked.length >= MASKED_LIMIT) {
				return apiError(409, "conflict", `masked-address limit (${MASKED_LIMIT}) reached for account`);
			}
			counter += 1;
			const address = `${base}.${suffix(counter)}@${DOMAIN}`;
			account.masked.push({
				address,
				label: body["label"].trim(),
				enabled: true,
				created_at: 1_700_000_000 + counter,
			});
			return json({ address }, 201);
		}
		if (rest !== undefined && request.method === "DELETE") {
			const index = account.masked.findIndex((entry) => entry.address === rest);
			if (index < 0) {
				return apiError(404, "not_found", "no such masked address");
			}
			account.masked.splice(index, 1);
			return json({ removed: rest });
		}
		return apiError(404, "not_found", "No such endpoint");
	}

	function handleArchive(account: AccountState, method: string, rest: string | undefined): Response {
		if (account.archive === null) {
			return apiError(404, "not_found", "archive not available: no such directory");
		}
		if (rest === undefined && method === "GET") {
			return json({ entries: account.archive });
		}
		const restore = rest === undefined ? null : /^([^/]+)\/restore$/.exec(rest);
		if (restore && method === "POST") {
			const id = restore[1];
			const index = account.archive.findIndex((entry) => entry.id === id);
			const entry = account.archive[index];
			if (entry === undefined) {
				return apiError(404, "not_found", "cannot restore: no such archived message");
			}
			account.archive.splice(index, 1);
			return json({ id, restored_to: entry.mailbox === "Gone" ? "INBOX" : entry.mailbox });
		}
		return apiError(404, "not_found", "No such endpoint");
	}

	return {
		handle,
		/** The state a scenario reads. Holds no secret: passwords are only counted. */
		snapshot(): Record<string, AccountSnapshot> {
			return Object.fromEntries(
				[...state].map(([name, value]) => [
					name,
					{ ...value, archive: value.archive?.map((entry) => entry.id) ?? null },
				]),
			);
		},
		/** The account view the listing returns: the person's name and whether the API manages it. */
		view(name: string) {
			const account = state.get(name);
			return { display_name: account?.displayName ?? null, dynamic: account?.dynamic ?? true };
		},
		/** Every account as the listing returns it, the seed ones first and then those created through the API. */
		list() {
			return [...state].map(([name, account]) => ({
				name,
				display_name: account.displayName,
				dynamic: account.dynamic,
				addresses: account.addresses,
			}));
		},
		/** Whether the account exists and, when it does, whether the API manages it. */
		kind(name: string): "dynamic" | "file" | "none" {
			const account = state.get(name);
			return account === undefined ? "none" : account.dynamic ? "dynamic" : "file";
		},
		/** Every address some account holds. */
		addressesInUse(): Set<string> {
			return new Set([...state.values()].flatMap((account) => account.addresses));
		},
		/** Store an account made through the API. */
		add(name: string, displayName: string | null, addresses: string[]): void {
			state.set(name, { displayName, totp: false, passwordChanges: 0, masked: [], archive: null, addresses, dynamic: true });
		},
		remove(name: string): void {
			state.delete(name);
		},
		reset(): void {
			state = fresh();
		},
	};
}
