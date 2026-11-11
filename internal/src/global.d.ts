import type enMessages from "../messages/en.json";

// Type every `useTranslations`/`getTranslations` key against the English source
// catalog, so a missing or mistyped message key is a compile-time error.
declare module "next-intl" {
	interface AppConfig {
		Messages: typeof enMessages;
	}
}
