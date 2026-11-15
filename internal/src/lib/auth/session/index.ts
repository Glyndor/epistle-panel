/**
 * Session tokens for the panel, for every account, admin or not.
 *
 * A session is a compact `payload.signature` string carried in an httpOnly
 * cookie. The payload is HMAC-SHA256 signed with a server-side secret, so the
 * browser cannot forge or tamper with it, and it is verified with the Web
 * Crypto API. The signing secret comes from `readSecret`, which reads a file
 * and so needs the Node.js runtime: the proxy defaults to it, so do not move
 * the proxy or this module to the Edge runtime.
 *
 * The lifetime of a session is the operator's decision (`session-policy`): an
 * absolute one per role, and an optional idle timeout. Both travel in the
 * token, so a session carries what is needed to judge it and no server-side
 * state has to remember it.
 */

import { readSecret } from "@/lib/config/secret";
import {
	readSessionPolicy,
	type SessionPolicy,
	sessionPolicy,
} from "@/lib/config/session-policy";

import { isRevoked, revokeToken } from "../revocation";

/**
 * Name of the httpOnly session cookie. The `__Host-` prefix makes a browser
 * accept the cookie only with `Secure`, `Path=/` and no `Domain`, so a sibling
 * subdomain cannot plant or shadow it.
 */
export const SESSION_COOKIE = "__Host-epistle_session";

/**
 * What a session may do. It is decided on the server when the account signs in
 * (the epistle API says whether the account is an admin) and travels inside the
 * signed token, so a browser cannot change it without breaking the signature.
 */
export type SessionRole = "admin" | "user";

function isSessionRole(value: unknown): value is SessionRole {
	return value === "admin" || value === "user";
}

/**
 * Absolute session lifetime, in seconds (8 hours), when the operator sets
 * nothing. The operator's own lifetime is in `session-policy`.
 */
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

/**
 * Attributes of the session cookie, without its lifetime: the lifetime
 * depends on the role and on the operator's policy, so it is added where the
 * cookie is written. `secure` is always set because the `__Host-` prefix
 * requires it: a browser drops the cookie otherwise. Browsers that treat
 * `http://localhost` as a secure context (Chrome, Firefox) still accept it
 * there; over plain HTTP on any other host the cookie is rejected, so serve
 * the panel over TLS, typically terminated by the operator's proxy. Deciding
 * `secure` from `NODE_ENV` would let a non-production start emit a cookie that
 * travels in clear, and would break the prefix.
 */
export const SESSION_COOKIE_OPTIONS = {
	httpOnly: true,
	secure: true,
	sameSite: "lax",
	path: "/",
} as const;

/** The session cookie's attributes, for a session that lives `maxAgeSeconds` more. */
export function sessionCookieOptions(maxAgeSeconds: number): {
	readonly httpOnly: true;
	readonly secure: true;
	readonly sameSite: "lax";
	readonly path: "/";
	readonly maxAge: number;
} {
	return { ...SESSION_COOKIE_OPTIONS, maxAge: maxAgeSeconds };
}

/** HMAC-SHA256 output size, in bytes. */
const SIGNATURE_BYTES = 32;

interface SessionPayload {
	/** The account name the session belongs to. */
	sub: string;
	/** The role the account had when it signed in. */
	role: SessionRole;
	/** Original issuance, in Unix seconds; never changed by activity. */
	iat: number;
	/** Absolute expiry, in Unix seconds. */
	exp: number;
	/** Last activity, in Unix seconds; absent while the idle timeout is off. */
	act?: number;
	/** Random id that makes each token unique, even for the same name and second. */
	jti: string;
}

function base64UrlEncode(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary)
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replaceAll("=", "");
}

function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> {
	const padded = value.replaceAll("-", "+").replaceAll("_", "/");
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

/** UTF-8 bytes backed by a plain `ArrayBuffer` (the shape Web Crypto wants). */
function utf8Bytes(value: string): Uint8Array<ArrayBuffer> {
	return new Uint8Array(new TextEncoder().encode(value));
}

async function hmacKey(): Promise<CryptoKey> {
	const secret = await readSecret("EPISTLE_PANEL_SESSION_SECRET");
	if (!secret) {
		throw new Error("EPISTLE_PANEL_SESSION_SECRET is not configured");
	}
	return crypto.subtle.importKey(
		"raw",
		utf8Bytes(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign", "verify"],
	);
}

/** The absolute lifetime of a session of this role, in seconds. */
function lifetimeOf(policy: SessionPolicy, role: SessionRole): number {
	return role === "admin"
		? policy.adminMaxAgeSeconds
		: policy.userMaxAgeSeconds;
}

/**
 * The absolute lifetime of a session of this role, in seconds, as the
 * operator's policy says. Throws when the policy cannot be read, naming the
 * variable at fault.
 */
export function sessionMaxAgeSeconds(role: SessionRole): number {
	return lifetimeOf(readSessionPolicy(), role);
}

/** Sign a payload and return the `payload.signature` string that carries it. */
async function signPayload(payload: SessionPayload): Promise<string> {
	const encoded = base64UrlEncode(utf8Bytes(JSON.stringify(payload)));
	const signature = await crypto.subtle.sign(
		"HMAC",
		await hmacKey(),
		utf8Bytes(encoded),
	);
	return `${encoded}.${base64UrlEncode(new Uint8Array(signature))}`;
}

/**
 * Mint a signed session token for `sub` with `role`, valid for the lifetime
 * the operator's policy gives that role. The token carries the absolute expiry
 * and, while the idle timeout is on, the moment of the last activity.
 */
export async function createSession(
	sub: string,
	role: SessionRole,
): Promise<string> {
	const policy = readSessionPolicy();
	const now = Math.floor(Date.now() / 1000);
	const payload: SessionPayload = {
		sub,
		role,
		iat: now,
		exp: now + lifetimeOf(policy, role),
		jti: base64UrlEncode(crypto.getRandomValues(new Uint8Array(16))),
	};
	if (policy.idleTimeoutSeconds !== undefined) {
		payload.act = now;
	}
	return signPayload(payload);
}

/**
 * Decode `value` as base64url and accept it only when it is the canonical
 * encoding of the bytes it decodes to. Without this, a few spare bits in the
 * last character let one token be written as several different strings, which
 * would slip past a revocation keyed on the exact string.
 */
function decodeCanonical(value: string): Uint8Array<ArrayBuffer> | null {
	try {
		const bytes = base64UrlDecode(value);
		return base64UrlEncode(bytes) === value ? bytes : null;
	} catch {
		return null;
	}
}

/**
 * Check shape, signature and lifetime of a token, ignoring revocation. The
 * token must be exactly `payload.signature`, the signature exactly 32 bytes,
 * and `iat`/`exp` safe integers bounding the original lifetime of the
 * claimed role. Omitting policy is for logout only: it authenticates the
 * claims without enforcing current role policy or idle freshness.
 *
 * While the operator's idle timeout is on, the token must also carry the
 * moment of its last activity, and that moment must be inside the session and
 * not in the future: a session nobody used for longer than the timeout is
 * refused.
 */
async function readToken(
	token: string | undefined,
	policy?: SessionPolicy,
): Promise<SessionPayload | null> {
	if (!token) {
		return null;
	}
	const parts = token.split(".");
	if (parts.length !== 2) {
		return null;
	}
	const [encoded, signature] = parts;
	if (!encoded || !signature) {
		return null;
	}
	const signatureBytes = decodeCanonical(signature);
	const payloadBytes = decodeCanonical(encoded);
	if (signatureBytes?.length !== SIGNATURE_BYTES || !payloadBytes) {
		return null;
	}
	let valid: boolean;
	try {
		valid = await crypto.subtle.verify(
			"HMAC",
			await hmacKey(),
			signatureBytes,
			utf8Bytes(encoded),
		);
	} catch {
		return null;
	}
	if (!valid) {
		return null;
	}
	let payload: SessionPayload;
	try {
		payload = JSON.parse(new TextDecoder().decode(payloadBytes));
	} catch {
		return null;
	}
	// A signed `null` parses fine and has no fields to read.
	if (
		payload === null ||
		typeof payload.sub !== "string" ||
		!isSessionRole(payload.role) ||
		!Number.isSafeInteger(payload.exp) ||
		!Number.isSafeInteger(payload.iat) ||
		typeof payload.jti !== "string" ||
		decodeCanonical(payload.jti)?.length !== 16
	) {
		return null;
	}
	const now = Math.floor(Date.now() / 1000);
	if (
		payload.iat <= 0 ||
		payload.iat > now ||
		payload.exp <= now ||
		payload.exp <= payload.iat
	) {
		return null;
	}
	if (
		policy &&
		payload.exp - payload.iat > lifetimeOf(policy, payload.role)
	) {
		return null;
	}
	// Validate activity even when idle expiry is disabled. Missing activity is
	// acceptable only while idle expiry is off; old tokens lack iat and fail above.
	const act = payload.act;
	if (
		act !== undefined &&
		(!Number.isSafeInteger(act) ||
			act < payload.iat ||
			act > now ||
			act >= payload.exp)
	) {
		return null;
	}
	if (
		policy?.idleTimeoutSeconds !== undefined &&
		(act === undefined || now - act >= policy.idleTimeoutSeconds)
	) {
		return null;
	}
	return payload;
}

/** A session that was checked, and the token to send back when it must change. */
export interface CheckedSession {
	/** The account the session belongs to. */
	sub: string;
	/** The role the session carries. */
	role: SessionRole;
	/**
	 * A token with the idle clock restarted, or `null` while the operator's
	 * idle timeout is off and no token has to change.
	 */
	refreshed: string | null;
	/** Seconds the session has left before its absolute expiry. */
	expiresIn: number;
}

/**
 * Verify a session token's signature, lifetime and revocation, and say which
 * token to send back.
 *
 * `refresh` asks for the token to be re-signed with the moment of this
 * request: the proxy wants it, because the browser has to hold the new one,
 * and the pages and the Server Actions do not, because they only read the
 * session.
 *
 * The result is `null` when the token is missing, malformed, forged, expired,
 * idle for longer than the operator's timeout or revoked. A policy that cannot
 * be read locks every route: a session is never granted on a configuration
 * that does not parse.
 */
async function inspectSession(
	token: string | undefined,
	refresh: boolean,
): Promise<CheckedSession | null> {
	const policy = sessionPolicy();
	if (!policy) {
		return null;
	}
	const payload = await readToken(token, policy);
	if (!payload || !token || (await isRevoked(payload.jti))) {
		return null;
	}
	const now = Math.floor(Date.now() / 1000);
	let refreshed: string | null = null;
	try {
		if (refresh && policy.idleTimeoutSeconds !== undefined) {
			refreshed = await signPayload({ ...payload, act: now });
		}
	} catch {
		// A secret removed or made unreadable during refresh grants no session.
		return null;
	}
	const expiresIn = payload.exp - Math.floor(Date.now() / 1000);
	if (expiresIn <= 0) {
		return null;
	}
	return {
		sub: payload.sub,
		role: payload.role,
		refreshed,
		expiresIn,
	};
}

/**
 * Verify a session token and say which token to send back, with the idle
 * clock restarted when the operator's idle timeout is on.
 */
export async function checkSession(
	token: string | undefined,
	refresh = true,
): Promise<CheckedSession | null> {
	return inspectSession(token, refresh);
}

/**
 * Verify a session token's signature, lifetime and revocation, returning the
 * account name and role it belongs to, or `null` if it is missing, malformed, forged,
 * expired or revoked by {@link revokeSession}.
 */
export async function verifySession(
	token: string | undefined,
): Promise<{ sub: string; role: SessionRole } | null> {
	const checked = await inspectSession(token, false);
	if (!checked) {
		return null;
	}
	return { sub: checked.sub, role: checked.role };
}

/**
 * Make a valid token unusable before it expires. An invalid or already expired
 * token is ignored, since it verifies as nothing already. The revocation is
 * held in memory by this process only; see the `revocation` module.
 */
export async function revokeSession(token: string | undefined): Promise<void> {
	// Logout authenticates the original claims, independently of current policy
	// or idle freshness: an older copy can still name an active refreshed copy.
	const payload = await readToken(token);
	if (payload) {
		await revokeToken(payload.jti, payload.exp);
	}
}
