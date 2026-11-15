import { afterEach, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { RefreshProvider, useRefreshInterval } from ".";

afterEach(cleanup);

function Reads({ base }: { base: number }) {
	return <output>{useRefreshInterval(base)}</output>;
}

it("is the normal interval without a provider, so a list is never left without a refresh", () => {
	render(<Reads base={30_000} />);

	expect(screen.getByRole("status")).toHaveTextContent("30000");
});
it("scales the interval by the pace the layout gave", () => {
	for (const [pace, base, expected] of [
		["normal", 30_000, "30000"],
		["slow", 30_000, "60000"],
		["fast", 30_000, "15000"],
		["fast", 15_000, "15000"],
		["slow", 15_000, "30000"],
	] as const) {
		const { unmount } = render(
			<RefreshProvider pace={pace}>
				<Reads base={base} />
			</RefreshProvider>,
		);
		expect([pace, base, screen.getByRole("status").textContent]).toEqual([
			pace,
			base,
			expected,
		]);
		unmount();
	}
});
it("answers the nearest provider", () => {
	render(
		<RefreshProvider pace="slow">
			<RefreshProvider pace="fast">
				<Reads base={60_000} />
			</RefreshProvider>
		</RefreshProvider>,
	);

	expect(screen.getByRole("status")).toHaveTextContent("30000");
});
