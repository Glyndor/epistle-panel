import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, render } from "@testing-library/react";

import type { AccountSection } from "@/features/account-detail/schemas/account-section";

import { LinkPendingState, PendingSectionState } from "./index";

afterEach(cleanup);

describe("pending section state", () => {
	it("reports the pending section and draws a visible mark", () => {
		const onPending = mock((_section: AccountSection | null) => {});
		const { container } = render(
			<PendingSectionState
				section="security"
				pending
				onPending={onPending}
			/>,
		);

		expect(onPending).toHaveBeenCalledWith("security");
		expect(container.querySelector("[data-pending='true']")).not.toBeNull();
		expect(
			container.querySelector("[data-pending='true']"),
		).toHaveTextContent("…");
	});

	it("reports that the section is no longer pending", () => {
		const onPending = mock((_section: AccountSection | null) => {});
		const { rerender } = render(
			<PendingSectionState
				section="security"
				pending
				onPending={onPending}
			/>,
		);

		rerender(
			<PendingSectionState
				section="security"
				pending={false}
				onPending={onPending}
			/>,
		);

		expect(onPending).toHaveBeenLastCalledWith(null);
	});

	it("reads the link status when it is not inside a link", () => {
		const onPending = mock((_section: AccountSection | null) => {});
		const { container } = render(
			<LinkPendingState section="profile" onPending={onPending} />,
		);

		expect(onPending).toHaveBeenCalledWith(null);
		expect(container.querySelector("[data-pending='true']")).toBeNull();
	});
});
