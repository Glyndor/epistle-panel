/** What a test says about the request a route handler gets. */
export interface FakeRequestOptions {
	readonly url?: string;
	readonly origin?: string | null;
	readonly host?: string | null;
	readonly type?: string;
	/** The `Content-Length` header: a number, `null` for none (a chunked body). */
	readonly length?: number | null;
	readonly body?: string | Uint8Array;
}

/**
 * A request as a route handler reads it: headers by name, the body as text or
 * bytes. The test DOM's own `Request` drops `Host` and `Origin` (a browser does
 * for script) and these tests need to set them, so the handler gets this object;
 * it uses only what the handler calls.
 */
export function fakeRequest(options: FakeRequestOptions = {}): Request {
	const body = options.body ?? "";
	const bytes =
		typeof body === "string" ? new TextEncoder().encode(body) : body;
	const headers: Record<string, string> = {};
	if (options.origin !== null) {
		headers["origin"] = options.origin ?? "https://panel.test";
	}
	if (options.host !== null) {
		headers["host"] = options.host ?? "panel.test";
	}
	if (options.type !== undefined) {
		headers["content-type"] = options.type;
	}
	if (options.length !== null) {
		headers["content-length"] = String(options.length ?? bytes.byteLength);
	}
	return {
		url: options.url ?? "https://panel.test/app/mail/x",
		headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
		body: new ReadableStream<Uint8Array>({
			start(controller) {
				for (let at = 0; at < bytes.byteLength; at += 16_384) {
					controller.enqueue(bytes.slice(at, at + 16_384));
				}
				controller.close();
			},
		}),
		arrayBuffer: async () =>
			bytes.buffer.slice(
				bytes.byteOffset,
				bytes.byteOffset + bytes.byteLength,
			),
	} as unknown as Request;
}
