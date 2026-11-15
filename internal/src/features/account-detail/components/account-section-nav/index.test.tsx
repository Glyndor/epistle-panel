import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { TEST_ADMIN_ID } from "@/lib/config/test-support/admin-id";
import { adminRoutes } from "@/lib/routes";

import { AccountSectionNav } from ".";

const BASE = adminRoutes(TEST_ADMIN_ID).accountDetail("alice");
const NAMES = {
	overview: "Overview",
	profile: "Profile",
	security: "Security",
	mailboxes: "Mailboxes",
	masked: "Masked addresses",
	archive: "Archive",
};

const show = (section: "overview" | "profile" | "security") =>
	render(
		<AccountSectionNav
			base={BASE}
			section={section}
			label="Sections"
			names={NAMES}
		/>,
	);

afterEach(cleanup);

describe("AccountSectionNav", () => {
	it("is a named navigation with a link per section", () => {
		show("overview");

		expect(
			screen.getByRole("navigation", { name: "Sections" }),
		).toBeInTheDocument();
		expect(
			screen.getAllByRole("link").map((link) => link.textContent),
		).toEqual([
			"Overview",
			"Profile",
			"Security",
			"Mailboxes",
			"Masked addresses",
			"Archive",
		]);
	});

	it("puts the section in the address, and nothing for the default one", () => {
		show("overview");

		expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute(
			"href",
			BASE,
		);
		expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute(
			"href",
			`${BASE}?section=profile`,
		);
		expect(screen.getByRole("link", { name: "Security" })).toHaveAttribute(
			"href",
			`${BASE}?section=security`,
		);
	});

	it("marks the current section for a screen reader, and no other", () => {
		show("security");
		const current = screen.getByRole("link", { name: "Security" });
		const other = screen.getByRole("link", { name: "Overview" });

		expect(current).toHaveAttribute("aria-current", "page");
		expect(current).toHaveClass("bg-secondary", "font-semibold");
		expect(other).not.toHaveAttribute("aria-current");
		expect(other).not.toHaveClass("bg-secondary");
		expect(other).not.toHaveClass("font-semibold");
		expect(
			screen
				.getAllByRole("link")
				.filter((link) => link.getAttribute("aria-current") === "page"),
		).toHaveLength(1);
	});

	it("keeps one live region ready for a pending navigation", () => {
		show("overview");

		const status = screen.getByRole("status");
		expect(status).toHaveAttribute("aria-live", "polite");
		expect(status).toHaveTextContent("");
	});

	it("draws the links with the button's own variants", () => {
		show("profile");

		expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute(
			"data-variant",
			"secondary",
		);
		expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute(
			"data-variant",
			"ghost",
		);
	});
});
