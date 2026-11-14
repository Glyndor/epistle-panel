import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";

import { toast } from "@/components/ui/toaster";

import { setLocale } from "@/features/locale/actions/set-locale";
import { localeSchema } from "@/features/locale/schemas/locale";

/**
 * The interface language and the way to change it. The value is checked with
 * the shared schema here and again by the Server Action, which is the real
 * gate; the page re-renders in the new language once it answers. When the
 * action refuses (the session ended) or cannot be reached, a toast says so and
 * the page stays as it was: left to reject inside the transition, it took the
 * page to the error screen and what was being written with it. Call it from a
 * component that stays mounted while the menu closes.
 */
export function useLocaleChoice(): {
	locale: string;
	pending: boolean;
	choose: (value: string) => void;
} {
	const t = useTranslations("nav");
	const locale = useLocale();
	const [pending, startTransition] = useTransition();

	const choose = (value: string) => {
		const next = localeSchema.safeParse(value);
		// One at a time: a pick made while another is being stored is dropped.
		if (pending || !next.success || next.data === locale) {
			return;
		}
		startTransition(async () => {
			const stored = await setLocale(next.data).catch(() => false);
			if (!stored) {
				toast.error(t("languageFailed"));
			}
		});
	};

	return { locale, pending, choose };
}
