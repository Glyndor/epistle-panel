/**
 * Admin session tokens for the panel.
 *
 * A session is a compact `payload.signature` string carried in an httpOnly
 * cookie. The payload is HMAC-SHA256 signed with a server-side secret, so the
 * browser cannot forge or tamper with it, and it is verified with the Web
 * Crypto API. The signing secret comes from `readSecret`, which reads a file
 * and so needs the Node.js runtime: the proxy defaults to it, so do not move
 * the proxy or this module to the Edge runtime.
 */

import { readSecret } from "@/lib/config/secret";

import { isRevoked, revokeToken } from "../revocation";

/**
 * Name of the httpOnly session cookie. The `__Host-` prefix makes a browser
 * accept the cookie only with `Secure`, `Path=/` and no `Domain`, so a sibling
 * subdomain cannot plant or shadow it.
 */
export const SESSION_COOKIE = "__Host-epistle_admin_session";

/** Absolute session lifetime, in seconds (8 hours). */
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

/**
 * Attributes of the session cookie. `secure` is always set because the
 * `__Host-` prefix requires it: a browser drops the cookie otherwise. Browsers
 * that treat `http://localhost` as a secure context (Chrome, Firefox) still
 * accept it there; over plain HTTP on any other host the cookie is rejected,
 * so serve the panel over TLS, typically terminated by the operator's proxy.
 * Deciding `secure` from `NODE_ENV` would let a non-production start emit a
 * cookie that travels in clear, and would break the prefix.
 */
export const SESSION_COOKIE_OPTIONS = {
	httpOnly: true,
	secure: true,
	sameSite: "lax",
	path: "/",
	maxAge: SESSION_MAX_AGE_SECONDS,
} as const;

/** HMAC-SHA256 output size, in bytes. */
const SIGNATURE_BYTES = 32;

interface SessionPayload {
	/** The admin account name the session belongs to. */
	sub: string;
	/** Absolute expiry, in Unix seconds. */
	exp: number;
	/** Random id that makes each token unique, even for the same name and second. */
	jti?: string;
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

/**
 * Mint a signed session token for `sub`, valid for {@link SESSION_MAX_AGE_SECONDS}.
 */
export async function createSession(sub: string): Promise<string> {
	const payload: SessionPayload = {
		sub,
		exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
		jti: base64UrlEncode(crypto.getRandomValues(new Uint8Array(16))),
	};
	const encoded = base64UrlEncode(utf8Bytes(JSON.stringify(payload)));
	const signature = await crypto.subtle.sign(
		"HMAC",
		await hmacKey(),
		utf8Bytes(encoded),
	);
	return `${encoded}.${base64UrlEncode(new Uint8Array(signature))}`;
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
 * and `exp` a finite integer in the future and at most
 * {@link SESSION_MAX_AGE_SECONDS} ahead.
 */
async function readToken(
	token: string | undefined,
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
		!Number.isInteger(payload.exp)
	) {
		return null;
	}
	const now = Math.floor(Date.now() / 1000);
	if (payload.exp <= now || payload.exp > now + SESSION_MAX_AGE_SECONDS) {
		return null;
	}
	return payload;
}

/**
 * Verify a session token's signature, lifetime and revocation, returning the
 * admin name it belongs to, or `null` if it is missing, malformed, forged,
 * expired or revoked by {@link revokeSession}.
 */
export async function verifySession(
	token: string | undefined,
): Promise<{ sub: string } | null> {
	const payload = await readToken(token);
	if (!payload || !token || (await isRevoked(token))) {
		return null;
	}
	return { sub: payload.sub };
}

/**
 * Make a valid token unusable before it expires. An invalid or already expired
 * token is ignored, since it verifies as nothing already. The revocation is
 * held in memory by this process only; see the `revocation` module.
 */
export async function revokeSession(token: string | undefined): Promise<void> {
	const payload = await readToken(token);
	if (payload && token) {
		await revokeToken(token, payload.exp);
	}
}
