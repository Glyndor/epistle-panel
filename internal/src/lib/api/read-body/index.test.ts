import { describe, expect, it } from "bun:test";

import { EpistleApiResponseTooLargeError } from "../error";
import { type ChunkCounter, zeroStream } from "../test-support/fetch";
import { MAX_RESPONSE_BYTES, readJsonBody } from ".";

const CHUNK = 64 * 1024;

describe("readJsonBody", () => {
	it("parses a small JSON body", async () => {
		const response = new Response(JSON.stringify({ a: 1 }));
		expect(await readJsonBody(response)).toEqual({ a: 1 });
	});

	it("reassembles a body split across chunks, multi-byte characters included", async () => {
		const bytes = new TextEncoder().encode(
			JSON.stringify({ name: "añ€😀" }),
		);
		const body = new ReadableStream<Uint8Array>({
			start(controller) {
				for (let i = 0; i < bytes.length; i += 3) {
					controller.enqueue(bytes.slice(i, i + 3));
				}
				controller.close();
			},
		});
		expect(await readJsonBody(new Response(body))).toEqual({
			name: "añ€😀",
		});
	});

	it("accepts a body of exactly the cap", async () => {
		const text = JSON.stringify("a".repeat(97));
		const bytes = new TextEncoder().encode(text).length;
		expect(await readJsonBody(new Response(text), bytes)).toBe(
			"a".repeat(97),
		);
	});

	it("rejects a non-JSON body with a SyntaxError", async () => {
		const error = await readJsonBody(new Response("<html>")).catch(
			(e) => e,
		);
		expect(error).toBeInstanceOf(SyntaxError);
	});

	it("rejects a bodiless response", async () => {
		const error = await readJsonBody(new Response(null)).catch((e) => e);
		expect(error).toBeInstanceOf(SyntaxError);
	});

	it("stops reading a 50 MB stream shortly after the cap", async () => {
		const counter: ChunkCounter = { pulled: 0 };
		const response = new Response(zeroStream(800, CHUNK, counter));
		const error = await readJsonBody(response).catch((e) => e);
		expect(error).toBeInstanceOf(EpistleApiResponseTooLargeError);
		// 5 MiB is 80 chunks of 64 KiB; one more crosses the cap. A reader that
		// kept going would pull all 800. The stream's own prefetch may add a few.
		expect(counter.pulled).toBeLessThan(90);
		expect(counter.pulled).toBeGreaterThanOrEqual(
			MAX_RESPONSE_BYTES / CHUNK,
		);
		expect(counter.cancelled).toBe(true);
	});

	it("refuses an oversized content-length without reading the body", async () => {
		const counter: ChunkCounter = { pulled: 0 };
		const response = new Response(zeroStream(10, CHUNK, counter), {
			headers: { "content-length": String(MAX_RESPONSE_BYTES + 1) },
		});
		const error = await readJsonBody(response).catch((e) => e);
		expect(error).toBeInstanceOf(EpistleApiResponseTooLargeError);
		expect(counter.pulled).toBeLessThanOrEqual(1);
		expect(counter.cancelled).toBe(true);
	});

	it("still counts the stream when content-length understates it", async () => {
		const counter: ChunkCounter = { pulled: 0 };
		const response = new Response(zeroStream(800, CHUNK, counter), {
			headers: { "content-length": "10" },
		});
		const error = await readJsonBody(response).catch((e) => e);
		expect(error).toBeInstanceOf(EpistleApiResponseTooLargeError);
		expect(counter.pulled).toBeLessThan(90);
	});

	it("ignores a malformed content-length and counts the stream", async () => {
		const response = new Response(JSON.stringify({ ok: true }), {
			headers: { "content-length": "not-a-number" },
		});
		expect(await readJsonBody(response)).toEqual({ ok: true });
	});
});
