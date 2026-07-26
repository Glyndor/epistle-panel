import { describe, expect, it, mock } from "bun:test";
import { render, screen } from "@testing-library/react";

mock.module("next/navigation", () => ({
	usePathname: () => "/domains",
	redirect: () => {
		throw new Error("NEXT_REDIRECT");
	},
}));
mock.module("next-intl", () => ({
	useTranslations: () => (key: string) => key,
}));

const { SiteNav } = await import("./site-nav");

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
});
