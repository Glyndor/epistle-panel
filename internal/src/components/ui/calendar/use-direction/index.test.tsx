import { afterEach, describe, expect, it } from "bun:test";
import { act, cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";

import { useDirection } from ".";

afterEach(() => {
	cleanup();
	document.documentElement.removeAttribute("dir");
});

function Reads() {
	return <p>{useDirection()}</p>;
}

describe("useDirection", () => {
	it("draws left to right on the server, whatever the page will be", () => {
		expect(renderToString(<Reads />)).toContain("ltr");
	});

	it("reads the page's direction, and a page with none reads from the left", () => {
		render(<Reads />);

		expect(screen.getByText("ltr")).toBeInTheDocument();
	});

	it("follows the page when its direction is switched", async () => {
		render(<Reads />);

		await act(async () => {
			document.documentElement.dir = "rtl";
			await Promise.resolve();
		});
		expect(screen.getByText("rtl")).toBeInTheDocument();

		await act(async () => {
			document.documentElement.dir = "ltr";
			await Promise.resolve();
		});
		expect(screen.getByText("ltr")).toBeInTheDocument();
	});
});
