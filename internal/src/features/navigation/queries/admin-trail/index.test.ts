import { describe, expect, it } from "bun:test";

import { navLabelKeySchema } from "@/features/navigation/schemas/nav-item";
import { TEST_ADMIN_ID } from "@/lib/config/test-support/admin-id";
import { adminRoutes } from "@/lib/routes";
import { adminTrail } from ".";

const routes = adminRoutes(TEST_ADMIN_ID);
const base = `/app/${TEST_ADMIN_ID}`;

describe("adminTrail", () => {
	it("starts every trail at the administration", () => {
		for (const page of navLabelKeySchema.options) {
			expect(adminTrail(routes, page)[0]).toEqual({
				kind: "area",
				href: base as never,
			});
		}
	});

	it("gives each page the address the navigation gives it", () => {
		const hrefs = Object.fromEntries(
			navLabelKeySchema.options.map((page) => {
				const trail = adminTrail(routes, page);
				expect(trail).toHaveLength(2);
				const step = trail[1];
				expect(step?.kind).toBe("page");
				return [page, step?.kind === "page" ? step.href : undefined];
			}),
		);

		// Written out here, not read from the routes: the test must not
		// agree with a change to them.
		expect<Record<string, string | undefined>>(hrefs).toEqual({
			status: base,
			domains: `${base}/domains`,
			accounts: `${base}/accounts`,
			queue: `${base}/queue`,
			suppression: `${base}/suppression`,
			deliveries: `${base}/deliveries`,
		});
	});

	it("ends at the thing the page is about, by its name or without one yet", () => {
		expect(adminTrail(routes, "accounts", "alice")).toEqual([
			{ kind: "area", href: base as never },
			{
				kind: "page",
				label: "accounts",
				href: `${base}/accounts` as never,
			},
			{ kind: "leaf", text: "alice" },
		]);
		expect(adminTrail(routes, "accounts", null).at(-1)).toEqual({
			kind: "leaf",
			text: null,
		});
	});

	it("never builds an address from the name of the thing", () => {
		for (const name of ["../queue", "a/b", "https://evil.example", ""]) {
			const trail = adminTrail(routes, "accounts", name);

			expect(trail.at(-1)).toEqual({ kind: "leaf", text: name });
			expect(JSON.stringify(trail.slice(0, 2))).toBe(
				JSON.stringify(adminTrail(routes, "accounts")),
			);
		}
	});
});
