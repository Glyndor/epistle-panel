import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { AttachmentList } from ".";

afterEach(cleanup);

describe("AttachmentList", () => {
	it("shows nothing without attachments", () => {
		const { container } = render(
			<AttachmentList messageId="m" attachments={[]} />,
		);
		expect(container).toBeEmptyDOMElement();
	});

	it("links each file to the panel's own route with its name and size", () => {
		render(
			<AttachmentList
				messageId="m1"
				attachments={[
					{
						part: "2",
						name: "report.pdf",
						type: "application/pdf",
						size: 2048,
					},
					{
						part: "3",
						name: "big.zip",
						type: "application/zip",
						size: 5_000_000,
					},
					{ part: "4", name: "tiny", type: "text/plain", size: 3 },
				]}
			/>,
		);
		const links = screen.getAllByRole("link");
		expect(links.map((l) => l.getAttribute("href"))).toEqual([
			"/app/mail/attachment/m1/2",
			"/app/mail/attachment/m1/3",
			"/app/mail/attachment/m1/4",
		]);
		expect(screen.getByText("2 KB")).toBeInTheDocument();
		expect(screen.getByText("5 MB")).toBeInTheDocument();
		expect(screen.getByText("1 KB")).toBeInTheDocument();
		expect(
			screen.getByRole("region", { name: "attachmentsLabel" }),
		).toBeInTheDocument();
	});
});
