import { mock } from "bun:test";
import { createElement, Fragment, type ReactNode } from "react";

/**
 * Mutable state behind the `next-intl` stand-ins. A test sets the locale and
 * the catalog the server helpers return and reads what the root layout handed
 * to the client provider.
 */
export const intl: {
	locale: string;
	messages: Record<string, unknown>;
	providerMessages: Record<string, unknown> | undefined;
} = { locale: "en", messages: {}, providerMessages: undefined };

/** Put the stand-in state back to its defaults. */
export function resetIntl(): void {
	intl.locale = "en";
	intl.messages = {};
	intl.providerMessages = undefined;
}

/** Stand-in for the client provider: record the catalog it got, render the children. */
function ProviderStandIn(props: {
	messages?: Record<string, unknown>;
	children?: ReactNode;
}) {
	intl.providerMessages = props.messages;
	return createElement(Fragment, null, props.children);
}

/**
 * Replace `next-intl` and `next-intl/server` with stand-ins that echo every
 * translation key, so assertions do not depend on a locale.
 *
 * `mock.module` is process-global and Bun links a module against whichever
 * mock exists when it is first imported. Two files that mock the same module
 * with different export sets therefore pass in one order and fail in another
 * (`Export named 'getFormatter' not found`, seen under `bun test --randomize`).
 * Every stand-in carries every export the panel imports, and the preload calls
 * this once, so no test file needs its own `mock.module("next-intl...")`. A
 * test that must re-establish the shapes right before an import may call it
 * again: the call is idempotent.
 */
export function installNextIntlMocks(): void {
	mock.module("next-intl/server", serverStandIn);
	mock.module("next-intl", clientStandIn);
}

/** Exports of the `next-intl/server` stand-in. */
export function serverStandIn() {
	return {
		getTranslations: async () => (key: string) => key,
		getFormatter: async () => ({
			number: (value: number) => String(value),
		}),
		getLocale: async () => intl.locale,
		getMessages: async () => intl.messages,
		getRequestConfig: (config: unknown) => config,
	};
}

/** Exports of the `next-intl` stand-in. */
export function clientStandIn() {
	return {
		useTranslations: () => (key: string) => key,
		NextIntlClientProvider: ProviderStandIn,
	};
}
