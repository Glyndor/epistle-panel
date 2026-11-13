import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

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
		expect(screen.getByText("allHeaders")).toBeInTheDocument();
		expect(screen.getAllByText("Received")).toHaveLength(2);
		expect(screen.getByText("<script>x</script>")).toBeInTheDocument();
		expect(container.querySelector("script")).toBeNull();
	});
});
