export function b64url(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes))
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replaceAll("=", "");
}

/** Sign an arbitrary payload object with the test secret, like the minter does. */
export async function signRaw(payload: unknown): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(
			process.env["EPISTLE_PANEL_SESSION_SECRET"] as string,
		),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const encoded = b64url(
		new TextEncoder().encode(
			JSON.stringify({
				iat: nowSeconds(),
				jti: "AAAAAAAAAAAAAAAAAAAAAA",
				...(payload as Record<string, unknown>),
			}),
		),
	);
	const signature = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(encoded),
	);
	return `${encoded}.${b64url(new Uint8Array(signature))}`;
}

export const nowSeconds = () => Math.floor(Date.now() / 1000);

/** The claims a token carries, read from its payload. */
export function payloadOf(token: string): {
	sub: string;
	role: string;
	exp: number;
	act?: number;
	jti?: string;
} {
	const encoded = token.split(".")[0] as string;
	return JSON.parse(
		atob(encoded.replaceAll("-", "+").replaceAll("_", "/")),
	) as { sub: string; role: string; exp: number; act?: number; jti?: string };
}
