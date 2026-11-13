import { KeyboardIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

/** The keys the list answers to, as a disclosure under the list; the hook that handles them is `use-mail-shortcuts`. */
export async function ShortcutsHelp() {
	const t = await getTranslations("mail");
	const rows = [
		["j", t("shortcutNext")],
		["k", t("shortcutPrevious")],
		["/", t("shortcutSearch")],
		["u", t("shortcutBack")],
	] as const;

	return (
		<details className="m-2 rounded-xl bg-muted p-2 text-muted-foreground text-xs max-lg:hidden">
			<summary className="flex min-h-8 cursor-pointer items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
				<KeyboardIcon aria-hidden="true" className="size-4" />
				{t("shortcutsTitle")}
			</summary>
			<dl className="mt-2 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1">
				{rows.map(([key, label]) => (
					<div key={key} className="contents">
						<dt>
							<kbd className="rounded bg-background px-1.5 font-mono">
								{key}
							</kbd>
						</dt>
						<dd>{label}</dd>
					</div>
				))}
			</dl>
		</details>
	);
}
