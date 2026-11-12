import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { captureCookieWrites } from "@/test/cookie-capture";
import { SidebarProvider } from "../provider";
import { SidebarTrigger } from ".";

afterEach(cleanup);

describe("SidebarTrigger", () => {
	it("is a button named by the translated label, with the icon hidden from assistive tech", () => {
		const { container } = render(
			<SidebarProvider>
				<SidebarTrigger label="Toggle sidebar" />
			</SidebarProvider>,
		);

		expect(
			screen.getByRole("button", { name: "Toggle sidebar" }),
		).toBeInTheDocument();
		expect(container.querySelector("svg")).toHaveAttribute(
			"aria-hidden",
			"true",
		);
	});

	it("runs the caller's handler and then toggles the sidebar", () => {
		const capture = captureCookieWrites();
		const { writes } = capture;
		const onClick = mock(() => {});
		render(
			<SidebarProvider>
				<SidebarTrigger label="Toggle" onClick={onClick} />
			</SidebarProvider>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Toggle" }));

		expect(onClick).toHaveBeenCalledTimes(1);
		expect(writes.at(-1)).toStartWith("sidebar_state=false");
		capture.restore();
	});
});
