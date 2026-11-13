import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { useActionEnvironment } from "@/features/account-detail/test-support/action-checks";
import { stubRoutes } from "@/features/account-detail/test-support/stub-routes";
import { stubFetchReject } from "@/lib/api/test-support/fetch";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { withQuery } from "@/test/query-wrapper";

const ID = "01890a5d-ac96-774b-b9aa-9be4c3bd6b0e";
const cookies = mockRequestCookies();
const { ArchiveSection } = await import(".");

afterEach(cleanup);

describe("ArchiveSection", () => {
	useActionEnvironment(cookies);

	it("lists the archived messages with a restore control on each", async () => {
		stubRoutes([
			[
				"GET",
				/archive$/,
				{
					body: {
						entries: [
							{
								id: ID,
								mailbox: "INBOX",
								deleted_at: 1_700_000_000,
							},
						],
					},
				},
			],
		]);

		render(withQuery(<ArchiveSection name="alice" />));

		expect(await screen.findByText("archiveMeta")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "archiveRestoreLabel" }),
		).toBeInTheDocument();
	});

	it("says so, as a plain notice and not a warning, when the archive is off", async () => {
		stubRoutes([
			[
				"GET",
				/archive$/,
				{
					status: 404,
					body: {
						error: {
							code: "not_found",
							message: "archive not available: x",
						},
					},
				},
			],
		]);
		const errors = spyOn(console, "error").mockImplementation(() => {});

		render(withQuery(<ArchiveSection name="alice" />));

		const notice = await screen.findByRole("status");
		expect(notice).toHaveTextContent("archiveUnavailable");
		expect(notice).not.toHaveClass("bg-warning");
		expect(screen.queryByRole("alert")).toBeNull();
		expect(errors).not.toHaveBeenCalled();
		errors.mockRestore();
	});

	it("says there is nothing archived when the list is empty", async () => {
		stubRoutes([["GET", /archive$/, { body: { entries: [] } }]]);

		render(withQuery(<ArchiveSection name="alice" />));

		expect(await screen.findByText("archiveEmpty")).toBeInTheDocument();
		expect(screen.queryByRole("button")).toBeNull();
	});

	it("shows the unreachable notice as a warning when the API fails", async () => {
		const errors = spyOn(console, "error").mockImplementation(() => {});
		stubFetchReject();

		render(withQuery(<ArchiveSection name="alice" />));

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"unreachable",
		);
		errors.mockRestore();
	});
});
