import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

export const SUPPORTED_LOCALES = ["en", "es"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

const DEFAULT_LOCALE: Locale = "en";

function isSupported(value: string | undefined): value is Locale {
	return SUPPORTED_LOCALES.includes(value as Locale);
}

export default getRequestConfig(async () => {
	const cookieLocale = (await cookies()).get("locale")?.value;
	const locale = isSupported(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;

	return {
		locale,
		messages: (await import(`../../messages/${locale}.json`)).default,
	};
});
