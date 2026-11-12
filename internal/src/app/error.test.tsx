import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

mock.module("next-intl", () => ({
	useTranslations: () => (key: string) => key,
}));

const { default: ErrorPage } = await import("./error");

afterEach(cleanup);

describe("error page", () => {
	it("shows the translated notice and retries through Next's reset", () => {
		const reset = mock(() => {});
		render(<ErrorPage error={new Error("secret detail")} reset={reset} />);

		expect(
			screen.getByRole("heading", { level: 1, name: "heading" }),
		).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "retry" }));
		expect(reset).toHaveBeenCalledTimes(1);
	});

	it("does not show the error message and uses no inline style", () => {
		const { container } = render(
			<ErrorPage error={new Error("secret detail")} reset={() => {}} />,
		);

		expect(container).not.toHaveTextContent("secret detail");
		expect(container.querySelector("style, [style]")).toBeNull();
	});
});
