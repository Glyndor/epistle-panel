import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { ErrorNotice } from ".";

afterEach(cleanup);

const labels = {
	heading: "heading",
	body: "body",
	retry: "retry",
	home: "home",
};

describe("ErrorNotice", () => {
	it("names the problem, offers a retry and a way back to the root, which carries no admin id", () => {
		const onRetry = mock(() => {});
		render(<ErrorNotice labels={labels} onRetry={onRetry} />);

		expect(
			screen.getByRole("heading", { level: 1, name: "heading" }),
		).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "home" })).toHaveAttribute(
			"href",
			"/",
		);
		fireEvent.click(screen.getByRole("button", { name: "retry" }));
		expect(onRetry).toHaveBeenCalledTimes(1);
	});

	it("uses no inline style, which the style-src policy blocks", () => {
		const { container } = render(
			<ErrorNotice labels={labels} onRetry={() => {}} />,
		);

		expect(container.querySelector("style, [style]")).toBeNull();
	});
});
