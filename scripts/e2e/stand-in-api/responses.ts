/** Response builders shared by the stand-in's modules. */

export function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

/** The error shape of the epistle API: `{"error": {"code", "message"}}`. */
export function apiError(
	status: number,
	code: string,
	message: string,
): Response {
	return json({ error: { code, message } }, status);
}
