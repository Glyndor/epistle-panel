import { afterEach, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { detail } from "@/features/mail/test-support/fixtures";
import { BodyView } from ".";

afterEach(cleanup);
const message = detail({
	body: {
		kind: "html",
		blockedImages: 2,
		truncated: false,
		alternativeText: null,
	},
});
it("ask blocks initially, then loads only after the button is pressed", () => {
	render(<BodyView message={message} remoteImagesMode="ask" />);
	expect(screen.getByTitle("bodyFrame")).toHaveAttribute(
		"src",
		"/app/mail/body/m1",
	);
	expect(screen.getByText("imagesBlocked")).toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: "loadImages" }));
	expect(screen.getByTitle("bodyFrame")).toHaveAttribute(
		"src",
		"/app/mail/body/m1?images=1",
	);
	expect(screen.queryByText("imagesBlocked")).toBeNull();
	expect(screen.queryByRole("button")).toBeNull();
});
it("always loads immediately without a warning or button", () => {
	render(<BodyView message={message} remoteImagesMode="always" />);
	expect(screen.getByTitle("bodyFrame")).toHaveAttribute(
		"src",
		"/app/mail/body/m1?images=1",
	);
	expect(screen.queryByRole("button")).toBeNull();
	expect(screen.queryByText("imagesBlocked")).toBeNull();
	expect(screen.queryByText("imagesBlockedNever")).toBeNull();
});
it("never blocks images and offers no override button", () => {
	render(<BodyView message={message} remoteImagesMode="never" />);
	expect(screen.getByTitle("bodyFrame")).toHaveAttribute(
		"src",
		"/app/mail/body/m1",
	);
	expect(screen.getByText("imagesBlockedNever")).toBeInTheDocument();
	expect(screen.queryByText("imagesBlocked")).toBeNull();
	expect(screen.queryByRole("button")).toBeNull();
});
it("never also revokes a prior per-message override when the policy changes", () => {
	const shown = render(<BodyView message={message} remoteImagesMode="ask" />);
	fireEvent.click(screen.getByRole("button", { name: "loadImages" }));
	shown.rerender(<BodyView message={message} remoteImagesMode="never" />);
	expect(screen.getByTitle("bodyFrame")).toHaveAttribute(
		"src",
		"/app/mail/body/m1",
	);
	expect(screen.queryByRole("button")).toBeNull();
});
