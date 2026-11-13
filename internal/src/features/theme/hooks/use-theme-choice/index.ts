import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";

import { toast } from "@/components/ui/toaster";
import { setTheme } from "@/features/theme/actions/set-theme";
import { useServerThemeChoice } from "@/features/theme/components/theme-choice-provider";
import type { ThemeChoice } from "@/features/theme/config/choices";
import {
	applyThemeChoice,
	documentThemeChoice,
	subscribeDocumentTheme,
} from "@/features/theme/document-theme";
import { themeChoiceSchema } from "@/features/theme/schemas/theme-choice";

/**
 * The theme the document shows, kept in step with the attribute on `<html>`.
 * The first render is the choice the server read from the cookie and painted
 * there (`ThemeChoiceProvider`), so the server's markup and the hydrated one
 * agree; from then on the attribute is the source, whoever changed it.
 *
 * Keep it state fed by an effect, not `useSyncExternalStore`. With the store
 * hook, the refresh that follows the Server Action left the page without its
 * `<title>` for about 300 ms in 6 of 190 theme changes, measured in Chromium
 * against the built server; with state, in none of 130. The cause was not
 * established, only the difference.
 */
export function useDocumentTheme(): ThemeChoice {
	const fromServer = useServerThemeChoice();
	const [choice, setChoice] = useState(fromServer);
	useEffect(() => {
		const read = () => setChoice(documentThemeChoice());
		read();
		return subscribeDocumentTheme(read);
	}, []);
	return choice;
}

/**
 * The current theme and the way to change it. A change shows at once, by
 * setting the attribute, and is then stored by the Server Action, which
 * validates it again and is the real gate. If the action refuses (the session
 * ended, say) the previous theme comes back and a toast says so. Call it from
 * a component that stays mounted while the menu closes.
 */
export function useThemeChoice(): {
	choice: ThemeChoice;
	pending: boolean;
	choose: (value: string) => void;
} {
	const t = useTranslations("nav");
	const choice = useDocumentTheme();
	const [pending, startTransition] = useTransition();

	const choose = (value: string) => {
		const next = themeChoiceSchema.safeParse(value);
		if (!next.success || next.data === choice) {
			return;
		}
		const previous = choice;
		applyThemeChoice(next.data);
		startTransition(async () => {
			const stored = await setTheme(next.data).catch(() => false);
			if (!stored) {
				applyThemeChoice(previous);
				toast.error(t("themeFailed"));
			}
		});
	};

	return { choice, pending, choose };
}
