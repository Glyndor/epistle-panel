import { describe, expect, it } from "bun:test";

import { composeLimits, FALLBACK_COMPOSE_LIMITS, MAX_RECIPIENTS } from ".";

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
