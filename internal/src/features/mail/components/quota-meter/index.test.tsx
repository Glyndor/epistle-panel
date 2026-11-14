import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import { stubJmap } from "@/features/mail/test-support/jmap-stub";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { clearSecretCache } from "@/lib/config/secret";
import { resetIntl, saidWith } from "@/test/next-intl";

const originalFetch = globalThis.fetch;
const savedEnv = { ...process.env };
const cookies = mockRequestCookies();
const { QuotaMeter } = await import(".");

beforeEach(async () => {
	clearSecretCache();
	cookies.reset();
	resetIntl();
	process.env["EPISTLE_API_URL"] = "http://127.0.0.1:8025";
	process.env["EPISTLE_API_TOKEN"] = "t";
	await cookies.signIn("admin");
});
afterEach(() => {
	process.env = { ...savedEnv };
	cleanup();
	globalThis.fetch = originalFetch;
});

const quota = (used: number, limit: number | null) =>
	stubJmap({
		"Quota/get": {
			list: [{ resourceType: "octets", used, limit }],
		},
	});

const section = () => document.querySelector("[data-slot='quota']");

describe("QuotaMeter", () => {
	it("draws a meter with its figures for an account with a limit", async () => {
		quota(1_200_000_000, 5_000_000_000);

		render(await QuotaMeter());

		expect(section()).toHaveAttribute("data-level", "ok");
		expect(
			screen.getByRole("region", { name: "storage" }),
		).toBeInTheDocument();
		const meter = screen.getByRole("meter", { name: "storage" });
		expect(meter).toHaveAttribute("value", "24");
		expect(meter).toHaveAttribute("aria-valuetext", "storageUsed");
		expect(saidWith("storageUsed")).toEqual([
			{ used: "1.2 GB", limit: "5 GB" },
		]);
		// The figures are written out under the bar, not left to the bar alone.
		expect(section()?.querySelector("p")).toHaveTextContent("storageUsed");
		expect(screen.queryByText("storageNear")).toBeNull();
		expect(screen.queryByText("storageFull")).toBeNull();
	});

	it("says in words that an account has no limit, and draws no meter", async () => {
		for (const limit of [null, 0]) {
			resetIntl();
			quota(3_400_000, limit);

			render(await QuotaMeter());

			expect([limit, section()?.getAttribute("data-level")]).toEqual([
				limit,
				"unlimited",
			]);
			expect(screen.queryByRole("meter")).toBeNull();
			expect(
				document.querySelector("[data-slot='meter-track']"),
			).toBeNull();
			expect(section()?.querySelector("p")).toHaveTextContent(
				"storageUnlimited",
			);
			expect(saidWith("storageUnlimited")).toEqual([{ used: "3.4 MB" }]);
			cleanup();
		}
	});

	it("writes the state out, beside the tone, close to the limit and at it", async () => {
		const cases = [
			[899, "ok", null],
			[900, "near", "storageNear"],
			[999, "near", "storageNear"],
			[1000, "full", "storageFull"],
			[5000, "full", "storageFull"],
		] as const;
		for (const [used, level, words] of cases) {
			quota(used * 1_000_000, 1_000_000_000);

			render(await QuotaMeter());

			expect([used, section()?.getAttribute("data-level")]).toEqual([
				used,
				level,
			]);
			expect(
				document.querySelector("[data-slot='meter']"),
			).toHaveAttribute("data-tone", level);
			if (words === null) {
				expect(screen.queryByText("storageNear")).toBeNull();
				expect(screen.queryByText("storageFull")).toBeNull();
			} else {
				expect(screen.getByText(words)).toBeInTheDocument();
			}
			cleanup();
		}
	});

	it("never draws more than the whole bar for an account over its limit", async () => {
		quota(9_000_000_000, 1_000_000_000);

		render(await QuotaMeter());

		expect(screen.getByRole("meter")).toHaveAttribute("value", "100");
		expect(
			document.querySelector("[data-slot='meter-track'] svg"),
		).toHaveAttribute("width", "100%");
	});

	it("draws an empty bar and zero for an account that uses nothing", async () => {
		quota(0, 1_000_000_000);

		render(await QuotaMeter());

		expect(screen.getByRole("meter")).toHaveAttribute("value", "0");
		expect(saidWith("storageUsed")).toEqual([
			{ used: "0 KB", limit: "1 GB" },
		]);
	});

	it("draws nothing for an account with no quota in bytes", async () => {
		stubJmap({ "Quota/get": { list: [] } });

		expect(await QuotaMeter()).toBeNull();
	});

	it("draws nothing when the server cannot be asked or fails", async () => {
		const logged = spyOn(console, "error").mockImplementation(() => {});
		try {
			stubJmap({});
			expect(await QuotaMeter()).toBeNull();

			cookies.reset();
			const seen = quota(1, 2);
			expect(await QuotaMeter()).toBeNull();
			expect(seen).toHaveLength(0);
		} finally {
			logged.mockRestore();
		}
	});

	it("is not drawn while the rail is collapsed to icons, and is kept for a screen reader", async () => {
		quota(1, 2);

		render(await QuotaMeter());

		expect(section()).toHaveClass("group-data-[collapsible=icon]:sr-only");
	});

	it("holds no svg with children and no style, since it arrives in a streamed part", async () => {
		quota(950_000_000, 1_000_000_000);

		const html = renderToStaticMarkup(await QuotaMeter());

		expect(html).not.toContain("style");
		// The one svg is the bar's fill, and it is empty: nothing can be cut
		// inside it.
		expect(html.match(/<svg\b/g)).toHaveLength(1);
		expect(html).toMatch(/<svg\b[^>]*><\/svg>/);
	});
});
