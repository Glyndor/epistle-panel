import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { HeadersDisclosure } from ".";

afterEach(cleanup);

describe("HeadersDisclosure", () => {
	it("shows nothing without headers", () => {
		const { container } = render(<HeadersDisclosure headers={[]} />);
		expect(container).toBeEmptyDOMElement();
	});

	it("lists every header, the repeated ones too, as text", () => {
		const { container } = render(
			<HeadersDisclosure
				headers={[
					{ name: "Received", value: "a" },
					{ name: "Received", value: "<script>x</script>" },
				]}
			/>,
		);
		const button = screen.getByRole("button", { name: "allHeaders" });
		// Closed to start with: the headers are not in the page until asked for.
		expect(button).toHaveAttribute("aria-expanded", "false");
		expect(screen.queryAllByText("Received")).toHaveLength(0);

		fireEvent.click(button);

		expect(button).toHaveAttribute("aria-expanded", "true");
		expect(screen.getAllByText("Received")).toHaveLength(2);
		expect(screen.getByText("<script>x</script>")).toBeInTheDocument();
		expect(container.querySelector("script")).toBeNull();
	});
});
