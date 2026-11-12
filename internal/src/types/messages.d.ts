import type accounts from "@/i18n/messages/en/accounts.json";
import type auth from "@/i18n/messages/en/auth.json";
import type dashboard from "@/i18n/messages/en/dashboard.json";
import type domains from "@/i18n/messages/en/domains.json";
import type error from "@/i18n/messages/en/error.json";
import type nav from "@/i18n/messages/en/nav.json";
import type notFound from "@/i18n/messages/en/notFound.json";
import type queue from "@/i18n/messages/en/queue.json";
import type table from "@/i18n/messages/en/table.json";

// Type every `useTranslations`/`getTranslations` key against the English source
// catalog, so a missing or mistyped message key is a compile-time error. The
// catalog is one file per namespace; `loadMessages` merges them at runtime.
declare module "next-intl" {
	interface AppConfig {
		Messages: {
			dashboard: typeof dashboard;
			nav: typeof nav;
			domains: typeof domains;
			accounts: typeof accounts;
			queue: typeof queue;
			notFound: typeof notFound;
			auth: typeof auth;
			error: typeof error;
			table: typeof table;
		};
	}
}
