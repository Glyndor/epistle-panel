import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen, within } from "@testing-library/react";

import { emailFixture, stubJmap } from "@/features/mail/test-support/jmap-stub";
import {
	mockRequestCookies,
	RedirectSignal,
} from "@/lib/auth/test-support/cookies";
import { clearSecretCache } from "@/lib/config/secret";
import { firstPaint, resolveServerTree } from "@/test/server-tree";

const originalFetch = globalThis.fetch;
const savedEnv = { ...process.env };
const cookies = mockRequestCookies();
const { PlaceTrail } = await import(".");

const ID = "00000000-0000-4000-8000-0000000000f1";
const none = Promise.resolve({});

beforeEach(async () => {
	clearSecretCache();
	cookies.reset();
	process.env["EPISTLE_API_URL"] = "http://127.0.0.1:8025";
	process.env["EPISTLE_API_TOKEN"] = "t";
	await cookies.signIn("admin");
});
afterEach(() => {
	process.env = { ...savedEnv };
	cleanup();
	globalThis.fetch = originalFetch;
});

const steps = () =>
	within(screen.getByRole("navigation", { name: "breadcrumb" }))
		.getAllByRole("listitem")
		.map((item) => item.textContent);

describe("PlaceTrail", () => {
	it("redirects to sign-in without a session", async () => {
		cookies.reset();

		expect(
			await PlaceTrail({
				place: { role: "inbox" },
				message: undefined,
				searchParams: none,
			}).catch((e) => e),
		).toBeInstanceOf(RedirectSignal);
	});

	it("names a folder with no message open without asking the mail server", async () => {
		const seen = stubJmap({});

		render(
			await resolveServerTree(
				await PlaceTrail({
					place: { box: "Work/Q4" },
					message: undefined,
					searchParams: none,
				}),
			),
		);

		expect(steps()).toEqual(["heading", "Q4"]);
		expect(seen).toHaveLength(0);
	});

	it("streams the subject of the open message behind a bar that holds its place", async () => {
		const seen = stubJmap({
			"Email/get": {
				list: [emailFixture({ id: ID, subject: "Minutes" })],
			},
		});
		const boundary = await PlaceTrail({
			place: { role: "sent" },
			message: ID,
			searchParams: none,
		});

		render(firstPaint(boundary));
		expect(steps()).toEqual(["heading", "role_sent", ""]);
		expect(seen).toHaveLength(0);
		cleanup();

		render(await resolveServerTree(boundary));
		expect(steps()).toEqual(["heading", "role_sent", "Minutes"]);
		// One read of the message: the reader beside it shares it.
		expect(
			seen
				.flatMap((request) => request.calls)
				.filter((call) => call[0] === "Email/get"),
		).toHaveLength(1);
	});

	it("starts over for another message, so one subject never stands in for the next", async () => {
		const first = (await PlaceTrail({
			place: { role: "inbox" },
			message: ID,
			searchParams: none,
		})) as React.ReactElement;
		const second = (await PlaceTrail({
			place: { role: "inbox" },
			message: "00000000-0000-4000-8000-0000000000f2",
			searchParams: none,
		})) as React.ReactElement;

		expect(first.key).toBe(ID);
		expect(second.key).not.toBe(first.key);
	});
});
