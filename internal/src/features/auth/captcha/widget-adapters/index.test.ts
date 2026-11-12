import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { scriptsFinishWith } from "@/test/script-loading";

import type { PublicCaptcha } from "../providers";
import {
	loadScript,
	mountWidget,
	resetScriptCache,
	type WidgetOptions,
} from ".";

const win = window as unknown as Record<string, unknown>;
const scripts = () => [...document.head.querySelectorAll("script")];
const finish = (index = -1) => scripts().at(index)?.onload?.(new Event("load"));

function options(): WidgetOptions & { tokens: string[]; errors: number } {
	const seen = { tokens: [] as string[], errors: 0 };
	return Object.assign(seen, {
		action: "login",
		theme: "light" as const,
		onToken: (token: string) => seen.tokens.push(token),
		onError: () => {
			seen.errors += 1;
		},
	});
}

const config = (
	provider: PublicCaptcha["provider"],
	scriptUrl = "https://widgets.example/api.js",
): PublicCaptcha => ({
	provider,
	siteKey: "site-key",
	scriptUrl,
	responseField: "captcha-response",
});

beforeEach(() => {
	resetScriptCache();
	// Test files share one document in a single process, so scripts that another
	// file left in the head would count here and make the first test depend on order.
	for (const script of scripts()) {
		script.remove();
	}
});
afterEach(() => {
	scriptsFinishWith("load");
	for (const script of scripts()) {
		script.remove();
	}
	for (const name of ["turnstile", "grecaptcha", "hcaptcha"]) {
		delete win[name];
	}
	document.body.replaceChildren();
});

describe("loadScript", () => {
	it("adds one script per URL, without async or defer attributes, and shares the promise", async () => {
		const first = loadScript("https://a.example/x.js");
		const second = loadScript("https://a.example/x.js");

		expect(second).toBe(first);
		expect(scripts()).toHaveLength(1);
		expect(scripts()[0]?.src).toBe("https://a.example/x.js");
		expect(scripts()[0]?.hasAttribute("async")).toBe(false);
		expect(scripts()[0]?.hasAttribute("defer")).toBe(false);
		finish();
		await first;
	});

	it("forgets a failed load, removes the element, and lets a retry add a new one", async () => {
		scriptsFinishWith("error");
		const failed = loadScript("https://a.example/x.js");
		await expect(failed).rejects.toThrow("failed to load");
		const failedElement = scripts().find((script) =>
			script.src.endsWith("x.js"),
		);
		expect(failedElement).toBeUndefined();
		scriptsFinishWith("load");
		const retry = loadScript("https://a.example/x.js");
		expect(scripts()).toHaveLength(1);
		finish();
		await retry;
	});

	it("loads again on request, as a new element", async () => {
		const first = loadScript("https://a.example/x.js");
		finish();
		await first;

		const again = loadScript("https://a.example/x.js", true);
		finish();
		await again;

		expect(scripts()).toHaveLength(2);
	});
});

describe("mountWidget (Turnstile)", () => {
	function api() {
		const calls = {
			render: [] as Record<string, unknown>[],
			reset: [] as unknown[],
			remove: [] as unknown[],
		};
		win["turnstile"] = {
			render: (_el: HTMLElement, parameters: Record<string, unknown>) => {
				calls.render.push(parameters);
				return "w1";
			},
			reset: (id: unknown) => calls.reset.push(id),
			remove: (id: unknown) => calls.remove.push(id),
		};
		return calls;
	}

	it("renders explicitly with the site key, the login action and the theme, and passes tokens on", async () => {
		const calls = api();
		const seen = options();
		const container = document.createElement("div");

		const pending = mountWidget(config("turnstile"), container, seen);
		finish();
		const handle = await pending;

		const [parameters] = calls.render;
		expect(parameters).toMatchObject({
			sitekey: "site-key",
			action: "login",
			theme: "light",
		});
		expect(handle.readToken()).toBe("");
		(parameters?.["callback"] as ((t: string) => void) | undefined)?.(
			"tok-1",
		);
		expect(handle.readToken()).toBe("tok-1");
		expect(seen.tokens).toEqual(["tok-1"]);
	});

	it("never calls Turnstile's ready hook, which throws for a script loaded this way", async () => {
		const calls = api();
		const ready = mock(() => {
			throw new Error("ready must not be called");
		});
		(win["turnstile"] as Record<string, unknown>)["ready"] = ready;

		const pending = mountWidget(
			config("turnstile"),
			document.createElement("div"),
			options(),
		);
		finish();
		await pending;

		expect(ready).not.toHaveBeenCalled();
		expect(calls.render).toHaveLength(1);
	});

	it("clears the token when it expires or errors, and reports the error", async () => {
		const calls = api();
		const seen = options();
		const pending = mountWidget(
			config("turnstile"),
			document.createElement("div"),
			seen,
		);
		finish();
		const handle = await pending;
		const parameters = calls.render[0] ?? {};
		(parameters["callback"] as (t: string) => void)("tok");

		(parameters["expired-callback"] as () => void)();
		expect(handle.readToken()).toBe("");
		(parameters["callback"] as (t: string) => void)("tok");
		(parameters["error-callback"] as () => void)();

		expect(handle.readToken()).toBe("");
		expect(seen.tokens).toEqual(["tok", "", "tok"]);
		expect(seen.errors).toBe(1);
	});

	it("resets to a new challenge, forgetting the old token, and removes itself", async () => {
		const calls = api();
		const pending = mountWidget(
			config("turnstile"),
			document.createElement("div"),
			options(),
		);
		finish();
		const handle = await pending;
		(calls.render[0]?.["callback"] as ((t: string) => void) | undefined)?.(
			"tok",
		);

		handle.reset();
		expect(handle.readToken()).toBe("");
		expect(calls.reset).toEqual(["w1"]);
		handle.destroy();
		expect(calls.remove).toEqual(["w1"]);
	});

	it("rejects when the script loads but does not define its API", async () => {
		const pending = mountWidget(
			config("turnstile"),
			document.createElement("div"),
			options(),
		);
		finish();

		await expect(pending).rejects.toThrow("did not define");
	});

	it("rejects when the script cannot be loaded", async () => {
		scriptsFinishWith("error");
		const pending = mountWidget(
			config("turnstile"),
			document.createElement("div"),
			options(),
		);

		await expect(pending).rejects.toThrow("failed to load");
	});
});

describe("mountWidget (reCAPTCHA and hCaptcha)", () => {
	it("waits for reCAPTCHA to be ready, sends no action, and clears its own container to remove", async () => {
		const order: string[] = [];
		const render = mock(() => 3);
		win["grecaptcha"] = {
			ready: (callback: () => void) => {
				order.push("ready");
				callback();
			},
			render: (...args: unknown[]) => {
				order.push("render");
				return (render as unknown as (...a: unknown[]) => number)(
					...args,
				);
			},
			reset: mock(() => {}),
		};
		const container = document.createElement("div");
		container.append(document.createElement("iframe"));

		const pending = mountWidget(config("recaptcha"), container, {
			...options(),
			theme: "dark",
		});
		finish();
		const handle = await pending;

		expect(order).toEqual(["ready", "render"]);
		const parameters = (
			render.mock.calls[0] as unknown as [
				HTMLElement,
				Record<string, unknown>,
			]
		)[1];
		expect(parameters).toMatchObject({
			sitekey: "site-key",
			theme: "dark",
		});
		expect(parameters).not.toHaveProperty("action");
		handle.destroy();
		expect(container.children).toHaveLength(0);
	});

	it("draws an hCaptcha widget with its own remove", async () => {
		const remove = mock(() => {});
		win["hcaptcha"] = { render: () => 7, reset: () => {}, remove };
		const pending = mountWidget(
			config("hcaptcha"),
			document.createElement("div"),
			options(),
		);
		finish();

		(await pending).destroy();

		expect(remove).toHaveBeenCalledWith(7);
	});
});

describe("mountWidget (custom)", () => {
	function formWith(field: string) {
		const form = document.createElement("form");
		const container = document.createElement("div");
		const input = document.createElement("input");
		input.name = field;
		form.append(container, input);
		document.body.append(form);
		return { container, input };
	}

	it("describes the challenge to the script and reads the token from the named input", async () => {
		const { container, input } = formWith("captcha-response");
		const pending = mountWidget(config("custom"), container, options());
		finish();
		const handle = await pending;

		expect(container.dataset["sitekey"]).toBe("site-key");
		expect(container.dataset["action"]).toBe("login");
		expect(handle.readToken()).toBe("");
		input.value = "custom-token";
		expect(handle.readToken()).toBe("custom-token");
	});

	it("reads an empty token when the input is not there", async () => {
		const container = document.createElement("div");
		const pending = mountWidget(config("custom"), container, options());
		finish();

		expect((await pending).readToken()).toBe("");
	});

	it("resets by clearing the input and the container and loading the script again", async () => {
		const { container, input } = formWith("captcha-response");
		const pending = mountWidget(config("custom"), container, options());
		finish();
		const handle = await pending;
		input.value = "old";
		container.append(document.createElement("span"));

		handle.reset();

		expect(input.value).toBe("");
		expect(container.children).toHaveLength(0);
		expect(scripts()).toHaveLength(2);
	});

	it("reports an error when the script cannot be reloaded for a reset", async () => {
		const { container } = formWith("captcha-response");
		const seen = options();
		const pending = mountWidget(config("custom"), container, seen);
		finish();
		const handle = await pending;

		scriptsFinishWith("error");
		handle.reset();
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(seen.errors).toBe(1);
	});

	it("empties its container on destroy", async () => {
		const { container } = formWith("captcha-response");
		const pending = mountWidget(config("custom"), container, options());
		finish();
		const handle = await pending;
		container.append(document.createElement("span"));

		handle.destroy();

		expect(container.children).toHaveLength(0);
	});
});
