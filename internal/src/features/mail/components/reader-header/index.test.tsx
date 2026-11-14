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
	it("lists every label of the message as a chip with its whole name, isolated", () => {
		render(
			<ReaderHeader
				headingId="h"
				message={detail({
					labels: [
						{ keyword: "Work", name: "Work", tone: 1 },
						{ keyword: "Home", name: "Home", tone: 2 },
						{ keyword: "Tax", name: "Tax", tone: 3 },
						{ keyword: "Later", name: "Later", tone: 4 },
					],
				})}
			/>,
		);
		const list = screen.getByRole("list", { name: "labelsTitle" });
		const chips = Array.from(
			list.querySelectorAll('[data-slot="label-chip"]'),
		);

		// All four, where a row of the list would count three of them.
		expect(chips.map((chip) => chip.textContent)).toEqual([
			"Work",
			"Home",
			"Tax",
			"Later",
		]);
		for (const chip of chips) {
			expect(chip.querySelector("bdi")).not.toBeNull();
			// Read by a screen reader here: the reader has no other sentence for them.
			expect(chip).not.toHaveAttribute("aria-hidden");
			expect(chip.className).not.toMatch(/(^|\s)hidden(\s|$)/);
		}
	});

	it("draws no list of labels for a message with none", () => {
		render(<ReaderHeader headingId="h" message={detail()} />);

		expect(screen.queryByRole("list", { name: "labelsTitle" })).toBeNull();
	});
});
