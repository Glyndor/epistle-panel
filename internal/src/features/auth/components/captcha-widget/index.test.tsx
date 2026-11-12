import "@/test/script-loading";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

import type { PublicCaptcha } from "@/features/auth/captcha/providers";
import { resetScriptCache } from "@/features/auth/captcha/widget-adapters";

import { CaptchaWidget } from ".";

const win = window as unknown as Record<string, unknown>;
const config: PublicCaptcha = {
	provider: "turnstile",
	siteKey: "site-key",
	scriptUrl: "https://widgets.example/api.js",
	responseField: "captcha-response",
};

beforeEach(() => {
	// Another file may have left scripts, or a cached load, behind.
	resetScriptCache();
	for (const script of document.head.querySelectorAll("script")) {
		script.remove();
	}
});
afterEach(() => {
	cleanup();
	resetScriptCache();
	for (const script of document.head.querySelectorAll("script")) {
		script.remove();
	}
	delete win["turnstile"];
});

function stubTurnstile() {
	const remove = mock(() => {});
	win["turnstile"] = {
		render: mock(() => "w"),
		reset: mock(() => {}),
		remove,
	};
	return remove;
}

const loaded = () =>
	document.head.querySelector("script")?.onload?.(new Event("load"));

describe("CaptchaWidget", () => {
	it("is a named group with a box that holds its height before the script arrives", () => {
		stubTurnstile();
		const { container } = render(
			<CaptchaWidget
				config={config}
				label="Verification"
				handle={() => {}}
				onToken={() => {}}
				onError={() => {}}
			/>,
		);

		expect(screen.getByRole("group", { name: "Verification" })).toHaveClass(
			"min-h-20",
		);
		expect(container.querySelector(".captcha-widget")).not.toBeNull();
		expect(container.querySelector("[style]")).toBeNull();
	});

	it("loads the provider's script and hands over the handle once it is drawn", async () => {
		stubTurnstile();
		const handles: unknown[] = [];

		render(
			<CaptchaWidget
				config={config}
				label="V"
				handle={(h) => handles.push(h)}
				onToken={() => {}}
				onError={() => {}}
			/>,
		);
		await waitFor(() =>
			expect(document.head.querySelector("script")).not.toBeNull(),
		);
		loaded();

		await waitFor(() => expect(handles.some((h) => h !== null)).toBe(true));
		expect(document.head.querySelector("script")?.src).toBe(
			config.scriptUrl,
		);
	});

	it("reports an error when the script cannot be loaded", async () => {
		const onError = mock(() => {});
		render(
			<CaptchaWidget
				config={config}
				label="V"
				handle={() => {}}
				onToken={() => {}}
				onError={onError}
			/>,
		);
		await waitFor(() =>
			expect(document.head.querySelector("script")).not.toBeNull(),
		);

		document.head.querySelector("script")?.onerror?.(new Event("error"));

		await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
	});

	it("takes the widget out and forgets the handle when it is removed", async () => {
		const remove = stubTurnstile();
		const handles: unknown[] = [];
		const view = render(
			<CaptchaWidget
				config={config}
				label="V"
				handle={(h) => handles.push(h)}
				onToken={() => {}}
				onError={() => {}}
			/>,
		);
		await waitFor(() =>
			expect(document.head.querySelector("script")).not.toBeNull(),
		);
		loaded();
		await waitFor(() => expect(handles.some((h) => h !== null)).toBe(true));

		view.unmount();

		expect(remove).toHaveBeenCalledTimes(1);
		expect(handles.at(-1)).toBeNull();
	});
});
