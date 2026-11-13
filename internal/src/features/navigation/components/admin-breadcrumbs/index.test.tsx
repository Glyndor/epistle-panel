import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen, within } from "@testing-library/react";

import { navLabelKeySchema } from "@/features/navigation/schemas/nav-item";
import { TEST_ADMIN_ID } from "@/lib/config/test-support/admin-id";
import { adminRoutes } from "@/lib/routes";
import { AdminBreadcrumbs } from ".";

afterEach(cleanup);

const routes = adminRoutes(TEST_ADMIN_ID);
const base = `/app/${TEST_ADMIN_ID}`;
const trail = () => screen.getByRole("navigation", { name: "breadcrumb" });
const steps = () =>
	within(trail())
		.getAllByRole("listitem")
		.map((item) => item.textContent);

describe("AdminBreadcrumbs", () => {
	it("is a named navigation landmark with an ordered list", () => {
		render(<AdminBreadcrumbs routes={routes} page="queue" />);

		expect(trail().querySelector("ol")).not.toBeNull();
		// Its text lines up with the heading below: the list gives back the
		// padding each step keeps for its hover fill.
		expect(trail().querySelector("ol")).toHaveClass("-ms-1");
		expect(steps()).toEqual(["administration", "queue"]);
	});

	it("links the administration and marks the page as the current one, for every page", () => {
		for (const page of navLabelKeySchema.options) {
			render(<AdminBreadcrumbs routes={routes} page={page} />);

			const links = within(trail()).getAllByRole("link");
			expect(links).toHaveLength(1);
			expect(links[0]).toHaveTextContent("administration");
			expect(links[0]).toHaveAttribute("href", base);
			const current = trail().querySelectorAll('[aria-current="page"]');
			expect(current).toHaveLength(1);
			expect(current[0]).toHaveTextContent(page);
			// The current page is where the person is: not a link.
			expect(current[0]?.closest("a")).toBeNull();
			cleanup();
		}
	});

	it("links the page and marks the thing as current on a page about one thing", () => {
		render(
			<AdminBreadcrumbs routes={routes} page="accounts" leaf="alice" />,
		);

		expect(steps()).toEqual(["administration", "accounts", "alice"]);
		const links = within(trail()).getAllByRole("link");
		expect(links.map((link) => link.getAttribute("href"))).toEqual([
			base,
			`${base}/accounts`,
		]);
		const current = trail().querySelectorAll('[aria-current="page"]');
		expect(current).toHaveLength(1);
		expect(current[0]).toHaveTextContent("alice");
	});

	it("shows a name as text, whatever it holds, and cuts a long one short on its one line", () => {
		const name = '<img src=x onerror="alert(1)">/../queue';
		render(
			<AdminBreadcrumbs routes={routes} page="accounts" leaf={name} />,
		);

		const current = trail().querySelector('[aria-current="page"]');
		expect(current?.textContent).toBe(name);
		expect(trail().querySelector("img")).toBeNull();
		expect(current).toHaveClass("truncate");
		// The name is in no address.
		for (const link of within(trail()).getAllByRole("link")) {
			expect(link.getAttribute("href")).not.toContain("queue");
		}
	});

	it("holds the place of a name it does not know yet, with no current page", () => {
		render(
			<AdminBreadcrumbs routes={routes} page="accounts" leaf={null} />,
		);

		expect(steps()).toEqual(["administration", "accounts", ""]);
		expect(trail().querySelector('[aria-current="page"]')).toBeNull();
		const bar = trail().querySelector('[data-slot="skeleton"]');
		expect(bar).toHaveAttribute("aria-hidden", "true");
		expect(within(trail()).getAllByRole("link")).toHaveLength(2);
	});

	it("puts a decorative mark between the steps, and none before the first", () => {
		render(
			<AdminBreadcrumbs routes={routes} page="accounts" leaf="alice" />,
		);

		const list = trail().querySelector("ol") as HTMLElement;
		const kinds = [...list.children].map((child) =>
			child.getAttribute("data-slot"),
		);
		expect(kinds).toEqual([
			"breadcrumb-item",
			"breadcrumb-separator",
			"breadcrumb-item",
			"breadcrumb-separator",
			"breadcrumb-item",
		]);
		for (const mark of list.querySelectorAll(
			'[data-slot="breadcrumb-separator"]',
		)) {
			expect(mark).toHaveAttribute("aria-hidden", "true");
		}
	});

	it("keeps the trail on one line of one height, with a name, a long one or the bar that holds its place", () => {
		for (const leaf of ["alice", "a".repeat(64), null]) {
			render(
				<AdminBreadcrumbs
					routes={routes}
					page="accounts"
					leaf={leaf}
				/>,
			);

			const list = trail().querySelector("ol") as HTMLElement;
			expect(list).toHaveClass("flex-nowrap");
			const items = [
				...list.querySelectorAll('[data-slot="breadcrumb-item"]'),
			];
			// The steps before the last keep their width; the last gives way.
			expect(
				items.map((item) => item.className.includes("shrink-0")),
			).toEqual([true, true, false]);
			expect(items[2]).toHaveClass("min-w-0");
			const bar = list.querySelector('[data-slot="skeleton"]');
			if (leaf === null) {
				expect(bar).toHaveClass("max-w-full");
			} else {
				expect(bar).toBeNull();
			}
			cleanup();
		}
	});

	it("draws nothing without routes", () => {
		const { container } = render(
			<AdminBreadcrumbs routes={undefined} page="queue" />,
		);

		expect(container.innerHTML).toBe("");
	});

	it("uses no inline style", () => {
		const { container } = render(
			<AdminBreadcrumbs routes={routes} page="accounts" leaf={null} />,
		);

		expect(container.querySelector("[style]")).toBeNull();
	});
});
