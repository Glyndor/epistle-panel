import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from ".";

afterEach(cleanup);

function trail() {
	return render(
		<Breadcrumb aria-label="Trail">
			<BreadcrumbList>
				<BreadcrumbItem>
					<BreadcrumbLink asChild>
						<a href="/app/accounts">Accounts</a>
					</BreadcrumbLink>
				</BreadcrumbItem>
				<BreadcrumbSeparator />
				<BreadcrumbItem>
					<BreadcrumbPage>admin</BreadcrumbPage>
				</BreadcrumbItem>
			</BreadcrumbList>
		</Breadcrumb>,
	);
}

describe("Breadcrumb", () => {
	it("is a named navigation landmark with an ordered list", () => {
		trail();

		const nav = screen.getByRole("navigation", { name: "Trail" });
		expect(nav.querySelector("ol")).not.toBeNull();
		expect(screen.getByRole("link", { name: "Accounts" })).toHaveAttribute(
			"href",
			"/app/accounts",
		);
	});

	it("marks the current page, in bold and not by colour alone", () => {
		trail();

		const page = screen.getByText("admin");
		expect(page).toHaveAttribute("aria-current", "page");
		expect(page).toHaveClass("font-semibold");
	});

	it("hides the separator from assistive technology", () => {
		const { container } = trail();

		const separator = container.querySelector(
			"[data-slot='breadcrumb-separator']",
		);
		expect(separator).toHaveAttribute("aria-hidden", "true");
		expect(separator?.querySelector("svg")).not.toBeNull();
	});

	it("renders a plain anchor when the link is not a child", () => {
		render(
			<BreadcrumbLink href="/x" className="extra">
				x
			</BreadcrumbLink>,
		);

		expect(screen.getByRole("link", { name: "x" })).toHaveClass("extra");
	});
});
