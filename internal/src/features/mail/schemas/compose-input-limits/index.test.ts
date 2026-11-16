import { describe, expect, it } from "bun:test";

import {
	composeLimits,
	FALLBACK_COMPOSE_LIMITS,
	MAX_ATTACHMENT_BYTES_CEILING,
	MAX_RECIPIENTS,
	MAX_REQUEST_BYTES_CEILING,
} from ".";

describe("the composer's limits", () => {
	it("takes the numbers the mail server publishes", () => {
		expect(
			composeLimits({
				maxSizeUpload: 1_000,
				maxSizeRequest: 2_000,
			}),
		).toEqual({
			...FALLBACK_COMPOSE_LIMITS,
			maxAttachmentBytes: 1_000,
			maxRequestBytes: 2_000,
		});
	});

	it("keeps the numbers it held when the server publishes none", () => {
		expect(
			composeLimits({ maxSizeUpload: null, maxSizeRequest: null }),
		).toEqual(FALLBACK_COMPOSE_LIMITS);
		expect(composeLimits(null)).toEqual(FALLBACK_COMPOSE_LIMITS);
	});

	it("holds the limits it had before it asked the server", () => {
		expect(FALLBACK_COMPOSE_LIMITS).toEqual({
			maxText: 1_000_000,
			maxRecipientsText: 20_000,
			maxSubject: 998,
			maxRequestBytes: 1_500_000,
			maxAttachmentBytes: 26_214_400,
			maxTotalAttachmentBytes: null,
			maxAttachments: 20,
			maxRecipients: MAX_RECIPIENTS,
		});
	});

	it("keeps the count of attachments and of recipients, which the session does not publish", () => {
		const limits = composeLimits({
			maxSizeUpload: 1_000,
			maxSizeRequest: 2_000,
		});

		expect(limits.maxAttachments).toBe(20);
		expect(limits.maxRecipients).toBe(MAX_RECIPIENTS);
	});
});

it("carries the total attachment budget only when published", () => {
	expect(
		composeLimits({
			maxSizeUpload: null,
			maxSizeRequest: null,
			maxSizeAttachmentsPerEmail: 24_000_000,
		}).maxTotalAttachmentBytes,
	).toBe(24_000_000);
	expect(composeLimits(null).maxTotalAttachmentBytes).toBeNull();
	expect(
		composeLimits({ maxSizeUpload: null, maxSizeRequest: null })
			.maxTotalAttachmentBytes,
	).toBeNull();
});

describe("the panel's ceilings over what the session publishes", () => {
	const MIB = 1024 * 1024;

	it("names the ceilings: 64 MiB of request, 1 GiB of attachment", () => {
		expect(MAX_REQUEST_BYTES_CEILING).toBe(64 * MIB);
		expect(MAX_ATTACHMENT_BYTES_CEILING).toBe(1024 * MIB);
	});

	it("clamps maxSizeRequest below, at and above its ceiling", () => {
		const request = (maxSizeRequest: number) =>
			composeLimits({ maxSizeUpload: null, maxSizeRequest })
				.maxRequestBytes;
		expect(request(64 * MIB - 1)).toBe(64 * MIB - 1);
		expect(request(64 * MIB)).toBe(64 * MIB);
		expect(request(64 * MIB + 1)).toBe(64 * MIB);
		expect(request(1_073_741_824)).toBe(64 * MIB);
	});

	it("clamps maxSizeUpload and the attachment total at 1 GiB", () => {
		const limits = (value: number) =>
			composeLimits({
				maxSizeUpload: value,
				maxSizeRequest: null,
				maxSizeAttachmentsPerEmail: value,
			});
		expect(limits(1024 * MIB - 1).maxAttachmentBytes).toBe(1024 * MIB - 1);
		expect(limits(1024 * MIB).maxAttachmentBytes).toBe(1024 * MIB);
		expect(limits(1024 * MIB + 1).maxAttachmentBytes).toBe(1024 * MIB);
		expect(limits(2 ** 40).maxTotalAttachmentBytes).toBe(1024 * MIB);
		expect(limits(24_000_000).maxTotalAttachmentBytes).toBe(24_000_000);
	});

	it("keeps the panel's defaults for a number that is no limit", () => {
		for (const bad of [
			Number.NaN,
			Number.POSITIVE_INFINITY,
			Number.NEGATIVE_INFINITY,
			-1,
			0,
			0.5,
			"1073741824",
			null,
			undefined,
			{},
		]) {
			const limits = composeLimits({
				maxSizeUpload: bad as number,
				maxSizeRequest: bad as number,
				maxSizeAttachmentsPerEmail: bad as number,
			});
			expect([bad, limits]).toEqual([bad, FALLBACK_COMPOSE_LIMITS]);
		}
	});

	it("never reaches more than the request ceiling, whatever the server says", () => {
		expect(
			composeLimits({
				maxSizeUpload: Number.MAX_SAFE_INTEGER,
				maxSizeRequest: Number.MAX_SAFE_INTEGER,
			}).maxRequestBytes,
		).toBeLessThanOrEqual(MAX_REQUEST_BYTES_CEILING);
	});
});
