import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render } from "@testing-library/react";

import { Addresses } from ".";

afterEach(cleanup);

describe("Addresses", () => {
	it("writes the name first when there is one, and the address alone when there is none", () => {
		const { container } = render(
			<Addresses
				list={[
					{ name: "Ana", email: "ana@example.org" },
					{ name: null, email: "b@example.org" },
				]}
			/>,
		);

		expect(container.textContent).toBe(
			"Ana <ana@example.org>, b@example.org",
		);
	});

	it("isolates each address, which is text from the message", () => {
		const { container } = render(
			<Addresses
				list={[
					{ name: "‮evil", email: "a@example.org" },
					{ name: null, email: "b@example.org" },
				]}
			/>,
		);

		expect(container.querySelectorAll("bdi")).toHaveLength(2);
		expect(container.querySelector("bdi")?.textContent).toBe(
			"‮evil <a@example.org>",
		);
	});

	it("lists the same address twice when the message does", () => {
		const { container } = render(
			<Addresses
				list={[
					{ name: null, email: "a@example.org" },
					{ name: null, email: "a@example.org" },
				]}
			/>,
		);

		expect(container.textContent).toBe("a@example.org, a@example.org");
	});

	it("draws nothing for a header with no address", () => {
		const { container } = render(<Addresses list={[]} />);

		expect(container).toBeEmptyDOMElement();
	});
});
