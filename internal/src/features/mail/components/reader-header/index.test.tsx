import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { detail } from "@/features/mail/test-support/fixtures";

import { ReaderHeader } from ".";

afterEach(cleanup);

describe("ReaderHeader", () => {
	it("names the article by its subject heading and lists the addresses that exist", () => {
		render(
			<ReaderHeader
				message={detail({
					cc: [{ name: "C", email: "c@example.org" }],
				})}
				headingId="h"
			/>,
		);
		const heading = screen.getByRole("heading", { level: 2 });
		expect(heading).toHaveAttribute("id", "h");
		expect(heading).toHaveAttribute("tabindex", "-1");
		expect(heading).toHaveTextContent("Hello");
		expect(screen.getByText("Ana <ana@example.org>")).toBeInTheDocument();
		expect(screen.getByText("me@example.org")).toBeInTheDocument();
		expect(screen.getByText("C <c@example.org>")).toBeInTheDocument();
		expect(screen.queryByText("replyTo")).toBeNull();
	});

	it("isolates names with bdi and separates several addresses", () => {
		const { container } = render(
			<ReaderHeader
				message={detail({
					to: [
						{ name: null, email: "a@example.org" },
						{ name: null, email: "a@example.org" },
					],
				})}
				headingId="h"
			/>,
		);
		expect(
			container.querySelectorAll("dd bdi").length,
		).toBeGreaterThanOrEqual(3);
		expect(container.textContent).toContain("a@example.org, a@example.org");
	});

	it("shows a placeholder for an empty subject and the date in a time element", () => {
		const { container } = render(
			<ReaderHeader message={detail({ subject: "" })} headingId="h" />,
		);
		expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
			"noSubject",
		);
		expect(container.querySelector("time")).toHaveAttribute(
			"dateTime",
			"2026-11-12T10:00:00Z",
		);
	});
});
