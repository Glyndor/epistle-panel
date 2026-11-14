import { describe, expect, it } from "bun:test";

import { CONDITION_LABELS } from "@/features/mail/schemas/list-conditions-model";
import { SEARCH_FORM_MESSAGES } from "@/features/mail/schemas/search-form";
import { SUPPORTED_LOCALES } from "@/i18n/locales";

import { loadMessages } from ".";
import { icuArguments } from "./test-support/icu";

/**
 * The keys the search and the filters of the mail area brought with them.
 * Every one of them is read by the page, so every one of them must be in
 * every catalog: a key that is missing falls back to English or to the raw
 * key in the browser.
 */
const NEW_KEYS = [
	"searchPlaceholder",
	"searchClose",
	"searchWords",
	"searchFields",
	"conditionAfter",
	"conditionBefore",
	"conditionLabel",
	"conditionFolder",
	"conditionFolderHere",
	"conditionRejected",
	"conditionTooLong",
	"conditionInvalidText",
	"conditionInvalidDay",
	"conditionInvalidFolder",
	"conditionInvalidLabel",
	"conditionInvalidRange",
	"filterImportant",
	"filters",
	"filtersActive",
	"order",
	"orderNewest",
	"orderOldest",
	"orderLargest",
	"showAll",
	"conditionsLabel",
	"conditionRemove",
	"clearAll",
	"conditionOrder",
] as const;

/**
 * The keys the code names itself: the name of every condition and the
 * message of every way a field can be wrong. They are strings in the code,
 * not literals in a component, so nothing but this test holds them to the
 * catalogs.
 */
const NAMED_KEYS = [
	...Object.values(CONDITION_LABELS),
	...SEARCH_FORM_MESSAGES,
] as readonly string[];

/** The catalog of the mail area, in one locale. */
async function mail(locale: string): Promise<Record<string, string>> {
	return (await loadMessages(locale as "en")).mail as Record<string, string>;
}

describe("the messages of the search and the filters", () => {
	it("are in every catalog", async () => {
		for (const locale of SUPPORTED_LOCALES) {
			const catalog = await mail(locale);
			for (const key of NEW_KEYS) {
				expect([locale, key, typeof catalog[key]]).toEqual([
					locale,
					key,
					"string",
				]);
			}
		}
	});

	it("say something in every catalog, and not the key again", async () => {
		for (const locale of SUPPORTED_LOCALES) {
			const catalog = await mail(locale);
			for (const key of NEW_KEYS) {
				const text = catalog[key] ?? "";
				expect([locale, key, text.trim() === ""]).toEqual([
					locale,
					key,
					false,
				]);
				// A catalog that repeats the key says nothing to a person.
				expect([locale, key, text === key]).toEqual([
					locale,
					key,
					false,
				]);
			}
		}
	});

	it("use the same placeholders as the English source", async () => {
		const english = await mail("en");
		for (const locale of SUPPORTED_LOCALES.filter((one) => one !== "en")) {
			const catalog = await mail(locale);
			for (const key of NEW_KEYS) {
				expect({
					locale,
					key,
					args: icuArguments(catalog[key] ?? "").sort(),
				}).toEqual({
					locale,
					key,
					args: icuArguments(english[key] ?? "").sort(),
				});
			}
		}
	});

	it("are named by the code in every catalog", async () => {
		for (const locale of SUPPORTED_LOCALES) {
			const catalog = await mail(locale);
			for (const key of NAMED_KEYS) {
				expect([locale, key, typeof catalog[key]]).toEqual([
					locale,
					key,
					"string",
				]);
			}
		}
	});

	it("name the label of the field and its placeholder in every catalog", async () => {
		for (const locale of SUPPORTED_LOCALES) {
			const catalog = await mail(locale);
			for (const key of ["searchLabel", "searchPlaceholder"]) {
				expect([locale, key, (catalog[key] ?? "").trim()]).not.toEqual([
					locale,
					key,
					"",
				]);
			}
		}
	});
});
