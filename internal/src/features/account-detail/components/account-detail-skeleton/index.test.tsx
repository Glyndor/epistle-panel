import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { ACCOUNT_SECTIONS } from "@/features/account-detail/schemas/account-section";

import { AccountDetailSkeleton } from "./index";

afterEach(cleanup);

describe("AccountDetailSkeleton", () => {
	it("draws the skeleton of the section on screen", () => {
		for (const section of ACCOUNT_SECTIONS) {
			const { unmount } = render(
				<AccountDetailSkeleton section={section} />,
			);

			expect(
				screen.getByTestId(`account-skeleton-${section}`),
			).toBeInTheDocument();
			for (const other of ACCOUNT_SECTIONS) {
				if (other !== section) {
					expect(
						screen.queryByTestId(`account-skeleton-${other}`),
					).toBeNull();
				}
			}
			unmount();
		}
	});

	it("marks the shape as busy", () => {
		render(<AccountDetailSkeleton section="profile" />);

		expect(screen.getByTestId("account-skeleton-profile")).toHaveAttribute(
			"aria-busy",
			"true",
		);
	});
});
