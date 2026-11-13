import { ChevronDownIcon, KeyboardIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Kbd } from "@/components/ui/kbd";

/** The keys the list answers to, behind a button under the list, closed to start with; the hook that handles them is `use-mail-shortcuts`. */
export async function ShortcutsHelp() {
	const t = await getTranslations("mail");
	const rows = [
		["j", t("shortcutNext")],
		["k", t("shortcutPrevious")],
		["/", t("shortcutSearch")],
		["u", t("shortcutBack")],
	] as const;

	return (
		<Collapsible className="group m-2 rounded-xl bg-muted p-2 text-muted-foreground text-xs max-lg:hidden">
			<CollapsibleTrigger className="flex min-h-8 w-full items-center gap-2 rounded-lg hover:cursor-pointer focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2">
				<KeyboardIcon aria-hidden="true" className="size-4" />
				{t("shortcutsTitle")}
				<ChevronDownIcon
					aria-hidden="true"
					className="ms-auto size-4 group-data-[state=open]:rotate-180"
				/>
			</CollapsibleTrigger>
			<CollapsibleContent>
				<dl className="mt-2 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1">
					{rows.map(([key, label]) => (
						<div key={key} className="contents">
							<dt>
								<Kbd>{key}</Kbd>
							</dt>
							<dd>{label}</dd>
						</div>
					))}
				</dl>
			</CollapsibleContent>
		</Collapsible>
	);
}
