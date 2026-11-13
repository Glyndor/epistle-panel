import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import {
	sentRequests,
	stubFetchJson,
	stubFetchReject,
} from "@/lib/api/test-support/fetch";
import {
	mockRequestCookies,
	NotFoundSignal,
} from "@/lib/auth/test-support/cookies";
import { withAdminArea } from "@/test/admin-routes";
import { firstPaint, resolveServerTree } from "@/test/server-tree";

const originalFetch = globalThis.fetch;
const cookies = mockRequestCookies();

const { default: HomePage } = await import("./page");

beforeEach(async () => {
	cookies.reset();
	await cookies.signIn();
});
afterEach(() => {
	cleanup();
	globalThis.fetch = originalFetch;
});

describe("HomePage", () => {
	it("renders a card per counter at once from the server prefetch", async () => {
		stubFetchJson({
			version: "0.1.0",
			domains: 2,
			accounts: 5,
			queue_size: 3,
		});

		render(withAdminArea(await resolveServerTree(await HomePage())));

		// No wait: the data was dehydrated into the page, so the first render has it.
		expect(screen.getByText("0.1.0")).toBeInTheDocument();
		expect(screen.getByText("2")).toBeInTheDocument();
		expect(screen.getByText("5")).toBeInTheDocument();
		expect(screen.getByText("3")).toBeInTheDocument();
		expect(sentRequests()).toHaveLength(1);
	});

	it("renders the unreachable notice, as a warning, when the API errors", async () => {
		stubFetchReject();

		render(withAdminArea(await resolveServerTree(await HomePage())));

		const alert = await screen.findByRole("alert");
		expect(alert).toHaveTextContent("unreachable");
		expect(alert).toHaveClass("bg-warning");
	});

	it("returns its heading and the skeleton before asking the API anything", async () => {
		stubFetchJson({
			version: "0.1.0",
			domains: 2,
			accounts: 5,
			queue_size: 3,
		});

		const page = await HomePage();
		expect(sentRequests()).toHaveLength(0);
		render(withAdminArea(firstPaint(page)));

		expect(
			screen.getByRole("heading", { level: 1, name: "heading" }),
		).toBeInTheDocument();
		expect(screen.getByTestId("status-skeleton")).toHaveAttribute(
			"aria-busy",
			"true",
		);
		expect(screen.getByRole("status")).toHaveTextContent("loading");
	});

	it("answers 404, not a redirect, without a session and never calls the API", async () => {
		cookies.reset();
		stubFetchJson({});

		const outcome = await (async () => await HomePage())().catch(
			(error) => error,
		);

		expect(outcome).toBeInstanceOf(NotFoundSignal);
		expect(sentRequests()).toHaveLength(0);
	});
});
