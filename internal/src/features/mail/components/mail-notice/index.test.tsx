import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { MailNotice } from ".";

afterEach(cleanup);

describe("MailNotice", () => {
	it("announces an error as an alert and shows its action", () => {
		render(
			<MailNotice
				tone="error"
				action={<button type="button">again</button>}
			>
				down
			</MailNotice>,
		);
		expect(screen.getByRole("alert")).toHaveTextContent("down");
		expect(
			screen.getByRole("button", { name: "again" }),
		).toBeInTheDocument();
	});

	it("shows an empty state as a polite status, not busy", () => {
		render(<MailNotice tone="empty">nothing</MailNotice>);
		const status = screen.getByRole("status");
		expect(status).toHaveTextContent("nothing");
		expect(status).not.toHaveAttribute("aria-busy");
	});

	it("marks a waiting state busy", () => {
		render(<MailNotice tone="loading">wait</MailNotice>);
		expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
	});
});
