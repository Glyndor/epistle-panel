"use client";

import { SearchIcon, SlidersHorizontalIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tooltip } from "@/components/ui/tooltip";
import { SearchFields } from "@/features/mail/components/mail-search/form/fields";
import { SearchField } from "@/features/mail/components/mail-search/search-field";
import {
	type ListConditions,
	MAX_CONDITION_TEXT,
} from "@/features/mail/schemas/list-conditions-model";
import {
	searchFormSchema,
	searchFormValues,
} from "@/features/mail/schemas/search-form";
import { fieldLength } from "@/lib/field-length";

/**
 * The conditions of the list that the form does not carry in a field of its
 * own: the quick filters and the order, which the toolbar's menu writes.
 */
function carried(conditions: ListConditions) {
	return (
		<>
			{conditions.unread ? (
				<input type="hidden" name="unread" value="1" />
			) : null}
			{conditions.starred ? (
				<input type="hidden" name="starred" value="1" />
			) : null}
			{conditions.important ? (
				<input type="hidden" name="important" value="1" />
			) : null}
			{conditions.order === "newest" ? null : (
				<input type="hidden" name="order" value={conditions.order} />
			)}
		</>
	);
}

/**
 * The search of the mail area: the words in a field, the fields that narrow
 * them behind a button at the end of it, and the form that sends them.
 *
 * The form is a plain GET form to the folder's own page, so a search is
 * bookmarkable and works before any script has loaded. The check the browser
 * does is the first of the three: the fields carry their own limits, the
 * schema of the page is the second, and the server reads the address again
 * with the same rules, which is the third and the real one.
 */
export function SearchForm({
	path,
	conditions,
}: {
	/** The page the search is sent to. */
	path: string;
	/** What the address holds, as the server read it. */
	conditions: ListConditions;
}) {
	const t = useTranslations("mail");
	const [open, setOpen] = useState(false);
	const [errors, setErrors] = useState<Record<string, string>>({});

	const check = (event: React.FormEvent<HTMLFormElement>) => {
		const parsed = searchFormSchema.safeParse(
			searchFormValues(new FormData(event.currentTarget)),
		);
		if (parsed.success) {
			setErrors({});
			return;
		}
		// The browser's own check let it through: the field is named here,
		// and nothing is sent.
		event.preventDefault();
		const found: Record<string, string> = {};
		for (const issue of parsed.error.issues) {
			const field = String(issue.path[0] ?? "after");
			found[field] ??= issue.message;
		}
		setErrors(found);
	};

	return (
		// biome-ignore lint/a11y/useSemanticElements: a form cannot be a `search` element, and React does not know that tag yet.
		<form
			method="get"
			action={path}
			onSubmit={check}
			role="search"
			aria-label={t("searchLabel")}
			className="flex min-w-0 flex-1 items-center gap-2"
		>
			{carried(conditions)}
			<Collapsible
				open={open}
				onOpenChange={setOpen}
				className="min-w-0 flex-1"
			>
				<div className="relative">
					<SearchIcon
						aria-hidden="true"
						className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
					/>
					<SearchField
						name="q"
						defaultValue={conditions.q}
						maxLength={fieldLength(MAX_CONDITION_TEXT)}
						placeholder={t("searchPlaceholder")}
						aria-label={t("searchLabel")}
						aria-keyshortcuts="/"
						className="min-w-0 w-full ps-9 pe-10"
					/>
					<CollapsibleTrigger asChild>
						<Tooltip label={t("searchFields")} align="end">
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="absolute end-1 top-1/2 -translate-y-1/2"
							>
								<SlidersHorizontalIcon aria-hidden="true" />
								<span className="sr-only">
									{t("searchFields")}
								</span>
							</Button>
						</Tooltip>
					</CollapsibleTrigger>
				</div>
				{/* The fields stay in the page while the panel is closed: the
				    form carries them, and a search keeps what was typed in
				    them. */}
				<CollapsibleContent
					forceMount
					hidden={!open}
					className="absolute inset-x-0 top-full z-30 mt-2 rounded-xl bg-surface-raised p-3 shadow-raised"
				>
					<SearchFields conditions={conditions} errors={errors} />
				</CollapsibleContent>
			</Collapsible>
			<Tooltip label={t("searchSubmit")} align="end">
				<Button type="submit" variant="outline" size="icon">
					<SearchIcon aria-hidden="true" />
					<span className="sr-only">{t("searchSubmit")}</span>
				</Button>
			</Tooltip>
		</form>
	);
}
