import { useLocale } from "next-intl";
import { useTransition } from "react";

import { setLocale } from "@/features/locale/actions/set-locale";
import { localeSchema } from "@/features/locale/schemas/locale";

/**
 * The interface language and the way to change it. The value is checked with
 * the shared schema here and again by the Server Action, which is the real
 * gate; the page re-renders in the new language once it answers. Call it from
 * a component that stays mounted while the menu closes.
 */
export function useLocaleChoice(): {
	locale: string;
	pending: boolean;
	choose: (value: string) => void;
} {
	const locale = useLocale();
	const [pending, startTransition] = useTransition();

	const choose = (value: string) => {
		const next = localeSchema.safeParse(value);
		// One at a time: a pick made while another is being stored is dropped.
		if (pending || !next.success || next.data === locale) {
			return;
		}
		startTransition(async () => {
			await setLocale(next.data);
		});
	};

	return { locale, pending, choose };
}
