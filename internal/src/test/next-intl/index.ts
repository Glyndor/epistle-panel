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
	/**
	 * Every message a server component asked for, in order, with the values it
	 * passed. The stand-in prints the key alone, so a test that cares what went
	 * into a sentence reads it here.
	 */
	said: { key: string; values: Record<string, unknown> | undefined }[];
} = { locale: "en", messages: {}, providerMessages: undefined, said: [] };

/** Put the stand-in state back to its defaults. */
export function resetIntl(): void {
	intl.locale = "en";
	intl.messages = {};
	intl.providerMessages = undefined;
	intl.said = [];
}

/** The values of every use of `key` by a server component since the last reset. */
export function saidWith(key: string): (Record<string, unknown> | undefined)[] {
	return intl.said
		.filter((message) => message.key === key)
		.map((message) => message.values);
}

/** Stand-in for the client provider: record the catalog it got, render the children. */
function ProviderStandIn(props: {
	messages?: Record<string, unknown>;
	children?: ReactNode;
}) {
	intl.providerMessages = props.messages;
	return createElement(Fragment, null, props.children);
}

/** Factories of the stand-ins, by module specifier. */
const STAND_INS: Record<string, () => object> = {
	"next-intl/server": () => serverStandIn(),
	"next-intl": () => clientStandIn(),
};

/**
 * Put another module under the same protection: from now on a file that mocks
 * `specifier` keeps its own exports and gets every other one from `standIn`.
 * The module is mocked with the stand-in at once.
 */
export function registerStandIn(
	specifier: string,
	standIn: () => object,
): void {
	STAND_INS[specifier] = standIn;
	mock.module(specifier, standIn);
}

/**
 * Wrap a per-file mock factory so what it leaves out comes from the shared
 * stand-in. The file's own exports win; nothing is ever removed.
 */
export function withStandInExports(
	specifier: string,
	factory: () => object,
): () => object {
	const standIn = STAND_INS[specifier];
	return standIn ? () => ({ ...standIn(), ...factory() }) : factory;
}

const WRAPPED = Symbol.for("epistle-panel.next-intl-mock-merge");

type MockRegistry = {
	module: (specifier: string, factory: () => object) => void;
	[WRAPPED]?: boolean;
};

/**
 * Replace `next-intl` and `next-intl/server` with stand-ins that echo every
 * translation key, so assertions do not depend on a locale.
 *
 * `mock.module` is process-global and Bun links a module against the exports
 * of whichever mock exists when it is first imported. Two files that mock the
 * same module with different export sets therefore pass in one order and fail
 * in another (`Export named 'getFormatter' not found`, seen under
 * `bun test --randomize`). The preload calls this once. It installs a stand-in
 * with every export the panel imports and wraps `mock.module` so that a file
 * which still mocks one of these two modules keeps its own exports and loses
 * none of the others. Calling it again puts the plain stand-ins back.
 */
export function installNextIntlMocks(): void {
	const registry = mock as unknown as MockRegistry;
	if (!registry[WRAPPED]) {
		const original = registry.module.bind(mock);
		registry.module = (specifier, factory) =>
			original(specifier, withStandInExports(specifier, factory));
		registry[WRAPPED] = true;
	}
	mock.module("next-intl/server", serverStandIn);
	mock.module("next-intl", clientStandIn);
}

/** Exports of the `next-intl/server` stand-in. */
export function serverStandIn() {
	return {
		getTranslations:
			async () => (key: string, values?: Record<string, unknown>) => {
				intl.said.push({ key, values });
				return key;
			},
		getFormatter: async () => ({
			number: (value: number) => String(value),
			dateTime: (value: Date) => value.toISOString(),
			list: (values: Iterable<string>) => [...values].join(", "),
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
		useLocale: () => intl.locale,
		useFormatter: () => ({
			number: (value: number) => String(value),
			dateTime: (value: Date) => value.toISOString(),
		}),
		NextIntlClientProvider: ProviderStandIn,
	};
}
