"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";

import { FIELD_CLASS } from "@/components/ui/input";
import { setLocale } from "@/features/locale/actions/set-locale";
import { localeSchema } from "@/features/locale/schemas/locale";
import { LOCALE_NAMES, SUPPORTED_LOCALES } from "@/i18n/locales";
import { cn } from "@/lib/class-names";

/**
 * The language of the interface as a native `<select>`: the browser draws the
 * list, so no overlay code is loaded and no style attribute is needed. The
 * value is checked with the shared schema here and again by the Server Action,
 * which is the real gate; the page re-renders in the new language once it
 * answers.
 */
export function LanguageSelect() {
	const t = useTranslations("mail");
	const current = useLocale();
	const [pending, startTransition] = useTransition();

	return (
		<label className="flex items-center gap-2 text-sm">
			<span className="sr-only sm:not-sr-only">{t("language")}</span>
			<select
				value={current}
				aria-busy={pending}
				onChange={(event) => {
					const locale = localeSchema.safeParse(event.target.value);
					if (locale.success && locale.data !== current) {
						startTransition(async () => {
							await setLocale(locale.data);
						});
					}
				}}
				className={cn(FIELD_CLASS, "w-auto px-2")}
			>
				{SUPPORTED_LOCALES.map((code) => (
					<option key={code} value={code} lang={code}>
						{LOCALE_NAMES[code]}
					</option>
				))}
			</select>
		</label>
	);
}
