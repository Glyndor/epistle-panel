import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import {
	cleanup,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import { isValidElement, type ReactNode, Suspense } from "react";
import {
	deliveryEntries,
	stubOverviewApi,
} from "@/features/overview/test-support/api";
import { sentRequests, stubFetchReject } from "@/lib/api/test-support/fetch";
import {
	mockRequestCookies,
	NotFoundSignal,
} from "@/lib/auth/test-support/cookies";
import { TEST_ADMIN_ID } from "@/lib/config/test-support/admin-id";
import { withAdminArea } from "@/test/admin-routes";
import { settled } from "@/test/query-wrapper";
import { firstPaint, resolveServerTree } from "@/test/server-tree";

const originalFetch = globalThis.fetch;
const cookies = mockRequestCookies();

const { default: HomePage } = await import("./page");

const at = (since?: string | string[]) => ({
	searchParams: Promise.resolve(since === undefined ? {} : { since }),
});
const paths = () =>
	sentRequests().map((request) => {
		const url = new URL(request.url);
		return url.pathname + url.search;
	});
const show = async (since?: string | string[]) =>
	render(withAdminArea(await resolveServerTree(await HomePage(at(since)))));

/** A version 7 queue id made at 2027-01-15 08:00:00 UTC. */
const QUEUED = "01a3185c-5000-7abc-8def-0123456789ab";

beforeEach(async () => {
	cookies.reset();
	await cookies.signIn();
});
afterEach(async () => {
	cleanup();
	await settled();
	globalThis.fetch = originalFetch;
});

describe("HomePage", () => {
	it("renders a card per counter at once from the server prefetch", async () => {
		stubOverviewApi();

		await show();

		// No wait: the data was dehydrated into the page, so the first render has it.
		expect(screen.getByText("9.9.9")).toBeInTheDocument();
		expect(screen.getByText("version")).toBeInTheDocument();
		// The prefetch and the notice of the page ask through one function that
		// React caches for the request. A test renders outside a request, where
		// that cache is a plain call, so this counts the askers, not the calls:
		// the e2e scenario counts what the API really receives, once each.
		expect(
			paths().filter((path) => path === "/api/v1/status").length,
		).toBeLessThanOrEqual(2);
		expect(screen.queryByRole("alert")).toBeNull();
	});

	it("draws the four charts on the server from the API's data", async () => {
		stubOverviewApi({
			deliveries: deliveryEntries(Math.floor(Date.now() / 1000) - 60, {
				delivered: 3,
				failed: 1,
			}),
			queue: [[{ id: QUEUED, recipients: ["a@example.net"] }]],
			suppression: [["x@example.org", "y@example.org"]],
		});

		await show();

		for (const title of [
			"outcomes.title",
			"timeline.title",
			"queue.title",
			"suppression.title",
		]) {
			expect(
				screen.getByRole("img", { name: title }),
			).toBeInTheDocument();
		}
		expect(
			within(
				screen.getByRole("figure", { name: "outcomes.title" }),
			).getByText("4"),
		).toBeVisible();
		expect(screen.getByText("example.org")).toBeVisible();
	});

	it("asks for the default period, 24 hours, when the address names none", async () => {
		stubOverviewApi();

		await show();

		expect(paths()).toContain("/api/v1/deliveries?since=24h&limit=100");
		expect(
			screen.getByRole("link", { name: "period.24h" }),
		).toHaveAttribute("aria-current", "page");
	});

	it("asks for the period in the address and marks it as the current one", async () => {
		stubOverviewApi();

		await show("7d");

		expect(paths()).toContain("/api/v1/deliveries?since=7d&limit=100");
		expect(paths()).not.toContain("/api/v1/deliveries?since=24h&limit=100");
		expect(screen.getByRole("link", { name: "period.7d" })).toHaveAttribute(
			"aria-current",
			"page",
		);
	});

	it("drops a period that is not on offer and sends none of it to the API", async () => {
		stubOverviewApi();

		await show("1e9d&outcome=failed");

		const asked = paths().filter((path) =>
			path.startsWith("/api/v1/deliveries"),
		);
		expect(asked.length).toBeGreaterThan(0);
		expect(new Set(asked)).toEqual(
			new Set(["/api/v1/deliveries?since=24h&limit=100"]),
		);
	});

	it("reads nothing but the status, the log, the queue and the suppression list, with GET", async () => {
		stubOverviewApi();

		await show("30d");

		expect(new Set(paths())).toEqual(
			new Set([
				"/api/v1/status",
				"/api/v1/deliveries?since=30d&limit=100",
				"/api/v1/queue?limit=100",
				"/api/v1/suppression?limit=100",
			]),
		);
		expect(
			sentRequests().every((request) => request.method === "GET"),
		).toBe(true);
	});

	it("gives one warning for the page when the API errors, at the top, with a link that loads it again", async () => {
		const log = spyOn(console, "error").mockImplementation(() => {});
		stubFetchReject();

		const { container } = await show("7d");

		// The counters say so once their own request has failed too.
		await waitFor(() =>
			expect(
				container.querySelector('[data-slot="status-unavailable"]'),
			).not.toBeNull(),
		);
		// One alert, not one per part: the counters and the four cards each
		// say in a quiet line that they were not loaded.
		const alert = screen.getByRole("alert");
		expect(alert).toHaveTextContent("unreachable");
		expect(alert).toHaveClass("bg-warning");
		expect(screen.getAllByText("unavailableTitle")).toHaveLength(4);
		// It comes before the counters and the charts.
		const heading = screen.getByRole("heading", { level: 1 });
		expect(heading.nextElementSibling).toBe(alert);
		// A plain link to the address the reader is on, period included.
		const retry = within(alert).getByRole("link", { name: "retry" });
		expect(retry).toHaveAttribute("href", `/app/${TEST_ADMIN_ID}?since=7d`);
		log.mockRestore();
	});

	it("warns once when a single read fails and draws the rest", async () => {
		const log = spyOn(console, "error").mockImplementation(() => {});
		stubOverviewApi({
			deliveries: 500,
			queue: [[{ id: QUEUED, recipients: ["a@example.net"] }]],
			suppression: [["x@example.org"]],
		});

		await show();

		expect(screen.getAllByRole("alert")).toHaveLength(1);
		// The two delivery cards were not loaded; the other two are drawn.
		expect(screen.getAllByText("unavailableTitle")).toHaveLength(2);
		expect(screen.getByRole("img", { name: "queue.title" })).toBeVisible();
		expect(
			screen.getByRole("img", { name: "suppression.title" }),
		).toBeVisible();
		expect(screen.getByText("9.9.9")).toBeInTheDocument();
		log.mockRestore();
	});

	it("gives no warning and no retry link when every read answers", async () => {
		stubOverviewApi();

		await show();

		expect(screen.queryByRole("alert")).toBeNull();
		expect(screen.queryByRole("link", { name: "retry" })).toBeNull();
	});

	it("returns its heading, the frame of the charts and the skeletons before asking the API anything", async () => {
		stubOverviewApi();

		const page = await HomePage(at("7d"));
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
		expect(screen.getAllByTestId("chart-skeleton")).toHaveLength(4);
		// Each skeleton already carries the title of its card, and the
		// timeline's its legend: they need no data either.
		for (const title of [
			"outcomes.title",
			"timeline.title",
			"queue.title",
			"suppression.title",
		]) {
			expect(
				screen.getByRole("heading", { level: 3, name: title }),
			).toBeInTheDocument();
		}
		expect(screen.getByText("outcomes.suppressed")).toBeInTheDocument();
		// The period links need no data: they are in the first paint.
		expect(screen.getByRole("link", { name: "period.7d" })).toHaveAttribute(
			"href",
			`/app/${TEST_ADMIN_ID}?since=7d`,
		);
		expect(sentRequests()).toHaveLength(0);
	});

	it("keys every part that waits for the API by the period, so a click on another shows at once", async () => {
		stubOverviewApi();
		const keys = (node: ReactNode): string[] => {
			if (Array.isArray(node)) {
				return node.flatMap(keys);
			}
			if (!isValidElement<{ children?: ReactNode }>(node)) {
				return [];
			}
			return [
				...(node.type === Suspense ? [String(node.key)] : []),
				...keys(node.props.children),
			];
		};

		expect(keys(await HomePage(at("7d")))).toEqual([
			"notice-7d",
			"status-7d",
			"outcomes-7d",
			"timeline-7d",
			"queue-7d",
			"suppression-7d",
		]);
		expect(keys(await HomePage(at()))).toEqual([
			"notice-24h",
			"status-24h",
			"outcomes-24h",
			"timeline-24h",
			"queue-24h",
			"suppression-24h",
		]);
	});

	it("answers 404, not a redirect, without a session and never calls the API", async () => {
		cookies.reset();
		stubOverviewApi();

		const outcome = await (async () => await HomePage(at()))().catch(
			(error) => error,
		);

		expect(outcome).toBeInstanceOf(NotFoundSignal);
		expect(sentRequests()).toHaveLength(0);
	});
});
