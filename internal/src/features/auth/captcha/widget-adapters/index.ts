import type { PublicCaptcha } from "../providers";

/** What the form keeps to ask the widget for its token and to draw a new challenge. */
export interface WidgetHandle {
	/** The current token, or an empty string while there is none. */
	readToken(): string;
	/** Draw a fresh challenge. A token is single use, so call it after every answer. */
	reset(): void;
	/** Take the widget out of the page. */
	destroy(): void;
}

export interface WidgetOptions {
	/** The action the widget is asked for and the server checks again. */
	action: string;
	theme: "light" | "dark";
	/** Called with the token when the challenge is solved, and with `""` when it expires. */
	onToken(token: string): void;
	/** Called when the widget reports it cannot work (blocked, offline). */
	onError(): void;
}

/** The part of each provider's global that the panel calls. */
interface ExplicitApi {
	render(
		container: HTMLElement,
		parameters: Record<string, unknown>,
	): string | number;
	reset(id?: string | number): void;
	remove?(id: string | number): void;
	ready?(callback: () => void): void;
}

const GLOBALS = {
	turnstile: "turnstile",
	recaptcha: "grecaptcha",
	hcaptcha: "hcaptcha",
} as const;

const loading = new Map<string, Promise<void>>();

/**
 * Load a widget script once per page. The element is inserted by script, which
 * the sign-in page's `strict-dynamic` policy trusts because the panel's own
 * nonced script inserted it. A failed load is forgotten so a retry can try
 * again.
 */
export function loadScript(url: string, fresh = false): Promise<void> {
	const known = loading.get(url);
	if (known && !fresh) {
		return known;
	}
	const script = document.createElement("script");
	script.src = url;
	// No async or defer attribute: a script added from script is already
	// asynchronous, and Turnstile refuses to run its API when it finds either
	// attribute on its own tag.
	const promise = new Promise<void>((resolve, reject) => {
		script.onload = () => resolve();
		script.onerror = () => {
			loading.delete(url);
			script.remove();
			reject(new Error("captcha script failed to load"));
		};
	});
	// Remember it before the element is added, so a load that answers at once
	// cannot leave a failed promise behind.
	loading.set(url, promise);
	document.head.append(script);
	return promise;
}

/** Forget which scripts were loaded. Tests call it between cases. */
export function resetScriptCache(): void {
	loading.clear();
}

function explicitApi(provider: keyof typeof GLOBALS): ExplicitApi | undefined {
	return (window as unknown as Record<string, ExplicitApi | undefined>)[
		GLOBALS[provider]
	];
}

/**
 * Wait for reCAPTCHA's own readiness hook, which its script defines after it
 * loads. Turnstile has one too, but it is meant for a tag loaded with async or
 * defer and throws otherwise; its API is usable once the script has loaded.
 */
function whenReady(
	provider: keyof typeof GLOBALS,
	api: ExplicitApi,
): Promise<void> {
	return new Promise((resolve) =>
		provider === "recaptcha" && api.ready ? api.ready(resolve) : resolve(),
	);
}

async function mountExplicit(
	provider: keyof typeof GLOBALS,
	config: PublicCaptcha,
	container: HTMLElement,
	options: WidgetOptions,
): Promise<WidgetHandle> {
	await loadScript(config.scriptUrl);
	const api = explicitApi(provider);
	if (!api) {
		throw new Error("captcha script did not define its API");
	}
	await whenReady(provider, api);
	let token = "";
	const id = api.render(container, {
		sitekey: config.siteKey,
		theme: options.theme,
		// Only Turnstile has actions; the others ignore the parameter.
		...(provider === "turnstile" ? { action: options.action } : {}),
		callback: (value: string) => {
			token = value;
			options.onToken(value);
		},
		"expired-callback": () => {
			token = "";
			options.onToken("");
		},
		"error-callback": () => {
			token = "";
			options.onError();
		},
	});
	return {
		readToken: () => token,
		reset: () => {
			token = "";
			api.reset(id);
		},
		destroy: () => {
			if (api.remove) {
				api.remove(id);
			} else {
				container.replaceChildren();
			}
		},
	};
}

/**
 * A custom widget draws itself: the script finds the container (it carries
 * `data-sitekey` and `data-action`) and writes its token into an input named
 * `responseField` inside the same form. The panel reads that input when the form
 * is submitted. Drawing a new challenge reloads the script into an emptied
 * container.
 */
async function mountCustom(
	config: PublicCaptcha,
	container: HTMLElement,
	options: WidgetOptions,
): Promise<WidgetHandle> {
	container.dataset["sitekey"] = config.siteKey;
	container.dataset["action"] = options.action;
	await loadScript(config.scriptUrl);
	const field = () => {
		const input = container
			.closest("form")
			?.elements.namedItem(config.responseField);
		return input instanceof HTMLInputElement ? input : null;
	};
	return {
		readToken: () => field()?.value ?? "",
		reset: () => {
			const input = field();
			if (input) {
				input.value = "";
			}
			container.replaceChildren();
			loadScript(config.scriptUrl, true).catch(options.onError);
		},
		destroy: () => container.replaceChildren(),
	};
}

/**
 * Draw the enabled provider's widget into `container`. Rejects when the script
 * cannot be loaded or does not define the API the panel calls.
 */
export function mountWidget(
	config: PublicCaptcha,
	container: HTMLElement,
	options: WidgetOptions,
): Promise<WidgetHandle> {
	return config.provider === "custom"
		? mountCustom(config, container, options)
		: mountExplicit(config.provider, config, container, options);
}
