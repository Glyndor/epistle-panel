/**
 * Admin session tokens for the panel.
 *
 * A session is a compact `payload.signature` string carried in an httpOnly
 * cookie. The payload is HMAC-SHA256 signed with a server-side secret, so the
 * browser cannot forge or tamper with it, and it is verified with the Web
 * Crypto API — which works in both the Node (server action) and Edge
 * (middleware) runtimes, so this module must not use any Node-only or
 * `server-only` API.
 */

/** Name of the httpOnly session cookie. */
export const SESSION_COOKIE = "epistle_admin_session";

/** Absolute session lifetime, in seconds (8 hours). */
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

interface SessionPayload {
	/** The admin account name the session belongs to. */
	sub: string;
	/** Absolute expiry, in Unix seconds. */
	exp: number;
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
	const secret = process.env.EPISTLE_PANEL_SESSION_SECRET;
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
 * Verify a session token's signature and expiry, returning the admin name it
 * belongs to, or `null` if it is missing, malformed, forged or expired.
 */
export async function verifySession(
	token: string | undefined,
): Promise<{ sub: string } | null> {
	if (!token) {
		return null;
	}
	const [encoded, signature] = token.split(".");
	if (!encoded || !signature) {
		return null;
	}
	let valid: boolean;
	try {
		valid = await crypto.subtle.verify(
			"HMAC",
			await hmacKey(),
			base64UrlDecode(signature),
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
		payload = JSON.parse(
			new TextDecoder().decode(base64UrlDecode(encoded)),
		);
	} catch {
		return null;
	}
	if (typeof payload.sub !== "string" || typeof payload.exp !== "number") {
		return null;
	}
	if (payload.exp <= Math.floor(Date.now() / 1000)) {
		return null;
	}
	return { sub: payload.sub };
}
