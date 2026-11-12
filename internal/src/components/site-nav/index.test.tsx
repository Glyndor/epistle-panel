import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

mock.module("next/navigation", () => ({
	usePathname: () => "/domains",
	redirect: () => {
		throw new Error("NEXT_REDIRECT");
	},
}));
mock.module("next-intl", () => ({
	useTranslations: () => (key: string) => key,
}));

const { SiteNav } = await import(".");

afterEach(cleanup);

describe("SiteNav", () => {
	it("renders the primary links and marks the active route", () => {
		render(<SiteNav />);

		const nav = screen.getByRole("navigation", { name: "label" });
		expect(nav).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "status" })).toHaveAttribute(
			"href",
			"/",
		);
		// On /domains the Domains link is current; Status is not.
		expect(screen.getByRole("link", { name: "domains" })).toHaveAttribute(
			"aria-current",
			"page",
		);
		expect(
			screen.getByRole("link", { name: "status" }),
		).not.toHaveAttribute("aria-current");
	});

	it("gives every link and the sign-out button a 44px touch target", () => {
		// happy-dom computes no layout, so the contract is the utility class:
		// `min-h-11` is 2.75rem, 44px at the default root size. The rendered
		// size is measured in a real browser, see the pull request.
		render(<SiteNav />);

		const controls = [
			...screen.getAllByRole("link"),
			screen.getByRole("button", { name: "logout" }),
		];
		expect(controls).toHaveLength(5);
		for (const control of controls) {
			expect(control).toHaveClass("min-h-11", "min-w-11");
		}
	});
});
