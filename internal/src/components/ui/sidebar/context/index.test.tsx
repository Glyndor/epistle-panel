import { describe, expect, it } from "bun:test";
import { render } from "@testing-library/react";

import { useSidebar } from ".";

function Probe() {
	useSidebar();
	return null;
}

describe("useSidebar", () => {
	it("throws outside a provider, naming the provider to add", () => {
		const original = console.error;
		console.error = () => {};
		try {
			expect(() => render(<Probe />)).toThrow(
				"useSidebar must be used within a SidebarProvider.",
			);
		} finally {
			console.error = original;
		}
	});
});
