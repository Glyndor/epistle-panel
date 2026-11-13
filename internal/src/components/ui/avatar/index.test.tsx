import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import { Avatar, AvatarFallback } from ".";

afterEach(cleanup);

describe("Avatar", () => {
	it("shows its initials at once, in the server markup too", () => {
		const html = renderToStaticMarkup(
			<Avatar>
				<AvatarFallback>JC</AvatarFallback>
			</Avatar>,
		);

		expect(html).toContain(">JC</span>");
		// No picture is loaded from anywhere.
		expect(html).not.toContain("<img");
	});

	it("is round, on the primary tone, in two sizes", () => {
		render(
			<>
				<Avatar data-testid="default">
					<AvatarFallback>A</AvatarFallback>
				</Avatar>
				<Avatar size="sm" data-testid="small">
					<AvatarFallback>B</AvatarFallback>
				</Avatar>
			</>,
		);

		expect(screen.getByTestId("default")).toHaveClass(
			"size-8",
			"rounded-full",
		);
		expect(screen.getByTestId("default")).toHaveAttribute(
			"data-size",
			"default",
		);
		expect(screen.getByTestId("small")).toHaveAttribute("data-size", "sm");
		expect(screen.getByTestId("small")).toHaveClass(
			"data-[size=sm]:size-6",
		);
		expect(screen.getByText("A")).toHaveClass(
			"bg-primary",
			"text-primary-foreground",
		);
	});

	it("uses no inline style and passes its props on", () => {
		const { container } = render(
			<Avatar aria-hidden="true" className="extra">
				<AvatarFallback className="more">A</AvatarFallback>
			</Avatar>,
		);

		expect(container.querySelector("[style]")).toBeNull();
		expect(container.firstElementChild).toHaveAttribute(
			"aria-hidden",
			"true",
		);
		expect(container.firstElementChild).toHaveClass("extra");
		expect(screen.getByText("A")).toHaveClass("more");
	});
});
