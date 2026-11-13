import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { Empty, EmptyDescription, EmptyHeader, EmptyIcon, EmptyTitle } from ".";

afterEach(cleanup);

describe("Empty", () => {
	it("shows an icon, a title and a line of help with no border", () => {
		const { container } = render(
			<Empty>
				<EmptyIcon>i</EmptyIcon>
				<EmptyHeader>
					<EmptyTitle>Nothing here</EmptyTitle>
					<EmptyDescription>Add one to start.</EmptyDescription>
				</EmptyHeader>
			</Empty>,
		);

		expect(screen.getByText("Nothing here")).toHaveAttribute(
			"data-slot",
			"empty-title",
		);
		expect(screen.getByText("Add one to start.")).toHaveClass(
			"text-muted-foreground",
		);
		expect(screen.getByText("i")).toHaveClass("rounded-xl", "bg-muted");
		expect(container.firstElementChild).not.toHaveClass("border");
		expect(container.querySelector("[style]")).toBeNull();
	});

	it("lets a caller class change its padding", () => {
		const { container } = render(<Empty className="p-3">x</Empty>);

		expect(container.firstElementChild).toHaveClass("p-3");
		expect(container.firstElementChild).not.toHaveClass("p-6");
	});
});
