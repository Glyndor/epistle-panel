import { afterEach, beforeEach, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { mailKeys } from "@/features/mail/queries/mail-query-keys";
import { EMPTY_CONDITIONS } from "@/features/mail/schemas/list-conditions-model";
import { detail } from "@/features/mail/test-support/fixtures";
import { testQueryClient, withQuery } from "@/test/query-wrapper";
import { MessageReader } from ".";

const descriptor = Object.getOwnPropertyDescriptor(window, "matchMedia");
beforeEach(() =>
	Object.defineProperty(window, "matchMedia", {
		writable: true,
		configurable: true,
		value: (media: string) => ({ matches: false, media }),
	}),
);
afterEach(() => {
	cleanup();
	if (descriptor) Object.defineProperty(window, "matchMedia", descriptor);
	else Reflect.deleteProperty(window, "matchMedia");
});
for (const mode of ["ask", "always", "never"] as const)
	it(`passes ${mode} to the body view`, () => {
		const client = testQueryClient();
		client.setQueryData(mailKeys.mailboxes, []);
		client.setQueryData(
			mailKeys.message("m1"),
			detail({
				body: {
					kind: "html",
					blockedImages: 1,
					truncated: false,
					alternativeText: null,
				},
			}),
		);
		render(
			withQuery(
				<MessageReader
					id="m1"
					view={{
						box: "INBOX",
						role: "inbox",
						page: 1,
						conditions: EMPTY_CONDITIONS,
					}}
					remoteImagesMode={mode}
				/>,
				client,
			),
		);
		expect(screen.getByTitle("bodyFrame")).toHaveAttribute(
			"src",
			`/app/mail/body/m1${mode === "always" ? "?images=1" : ""}`,
		);
		expect(
			screen.queryByRole("button", { name: "loadImages" }) !== null,
		).toBe(mode === "ask");
		if (mode === "never")
			expect(screen.getByText("imagesBlockedNever")).toBeInTheDocument();
	});
