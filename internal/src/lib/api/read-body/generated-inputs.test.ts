import { describe, expect, it } from "bun:test";

import { createRng, type Rng, runCases } from "@/test/prng";

import { EpistleApiResponseTooLargeError } from "../error";
import { MAX_RESPONSE_BYTES, readJsonBody } from ".";

const encoder = new TextEncoder();

/** A JSON string literal of exactly `bytes` UTF-8 bytes (at least 2). */
function jsonStringOfSize(bytes: number, rng: Rng): string {
	let inner = "";
	let used = 2;
	while (used < bytes) {
		const char = rng.pick(["a", "a", "é", "€", "\u{1f600}"]);
		const size = encoder.encode(char).length;
		if (used + size > bytes) {
			break;
		}
		inner += char;
		used += size;
	}
	return `"${inner}${"a".repeat(bytes - used)}"`;
}

/** Cut `bytes` into chunks of random size, empty chunks included now and then. */
function split(
	bytes: Uint8Array,
	rng: Rng,
	widest = rng.pick([1, 2, 3, 7, 64, Math.max(1, bytes.length)]),
): Uint8Array[] {
	const chunks: Uint8Array[] = [];
	for (let at = 0; at < bytes.length; ) {
		if (rng.chance(0.05)) {
			chunks.push(new Uint8Array(0));
		}
		const size = rng.int(1, widest);
		chunks.push(bytes.slice(at, at + size));
		at += size;
	}
	return chunks;
}

/** A pull-driven body that records how many bytes were handed out. */
function countedBody(chunks: Uint8Array[]): {
	body: ReadableStream<Uint8Array>;
	handedOut: () => number;
} {
	let next = 0;
	let total = 0;
	const body = new ReadableStream<Uint8Array>(
		{
			pull(controller) {
				const chunk = chunks[next++];
				if (chunk === undefined) {
					controller.close();
					return;
				}
				total += chunk.byteLength;
				controller.enqueue(chunk);
			},
		},
		{ highWaterMark: 0 },
	);
	return { body, handedOut: () => total };
}

type Verdict = { value: unknown } | { error: string };

async function verdictOf(response: Response, max: number): Promise<Verdict> {
	try {
		return { value: await readJsonBody(response, max) };
	} catch (error) {
		if (error instanceof EpistleApiResponseTooLargeError) {
			return { error: "too large" };
		}
		if (error instanceof SyntaxError) {
			return { error: "not json" };
		}
		throw error;
	}
}

/** What the module promises, from the cap, the header and the real size. */
function reference(
	text: string,
	max: number,
	header: string | undefined,
): Verdict {
	const declared = Number(header ?? null);
	if (Number.isFinite(declared) && declared > max) {
		return { error: "too large" };
	}
	if (encoder.encode(text).length > max) {
		return { error: "too large" };
	}
	try {
		return { value: JSON.parse(text) };
	} catch {
		return { error: "not json" };
	}
}

describe("readJsonBody on generated splits of a body", () => {
	it("decides like the unsplit body for every split around the cap", async () => {
		let tooLarge = 0;
		let parsed = 0;
		await runCases("chunk splits", 1500, async (rng) => {
			const max = rng.int(8, 400);
			const size = Math.max(2, max + rng.int(-3, 3));
			const text =
				rng.chance(0.1) && size > 3
					? `${jsonStringOfSize(size - 1, rng)}x`
					: jsonStringOfSize(size, rng);
			const bytes = encoder.encode(text);
			// No header, an exact one, a low one, an unreadable one.
			const header = rng.pick([
				undefined,
				String(bytes.length),
				String(Math.max(0, bytes.length - rng.int(1, 50))),
				String(max + rng.int(1, 1000)),
				String(bytes.length + rng.int(1, 50)),
				"abc",
				"",
				"-5",
			]);
			const headers: Record<string, string> =
				header === undefined ? {} : { "content-length": header };

			const whole = await verdictOf(new Response(text, { headers }), max);
			const chunks = split(bytes, rng);
			const { body, handedOut } = countedBody(chunks);
			const pieces = await verdictOf(
				new Response(body, { headers }),
				max,
			);

			expect(pieces).toEqual(whole);
			expect(whole).toEqual(reference(text, max, header));
			if (Number(header ?? null) > max) {
				// A declared size over the cap is refused before any byte is read.
				expect(handedOut()).toBe(0);
			}
			if ("error" in pieces && pieces.error === "too large") {
				tooLarge++;
				// The stream is cut off at the cap, plus at most the chunk that crossed it.
				const widest = Math.max(...chunks.map((c) => c.byteLength));
				expect(handedOut()).toBeLessThanOrEqual(max + widest);
			} else {
				parsed++;
			}
		});
		expect(tooLarge).toBeGreaterThan(200);
		expect(parsed).toBeGreaterThan(200);
	});

	it("refuses a body of the default cap plus one byte and accepts the cap exactly", async () => {
		const literal = (bytes: number) => `"${"a".repeat(bytes - 2)}"`;
		const chunked = (text: string, width: number) =>
			new Response(
				countedBody(split(encoder.encode(text), createRng(1), width))
					.body,
			);
		const at = literal(MAX_RESPONSE_BYTES);
		const over = literal(MAX_RESPONSE_BYTES + 1);
		for (const width of [65536, 1_000_003]) {
			expect(
				await verdictOf(chunked(at, width), MAX_RESPONSE_BYTES),
			).toEqual({ value: JSON.parse(at) });
			expect(
				await verdictOf(chunked(over, width), MAX_RESPONSE_BYTES),
			).toEqual({ error: "too large" });
		}
	});
});
