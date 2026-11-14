"use client";

import { SearchIcon, SlidersHorizontalIcon } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
	Disclosure,
	DisclosureContent,
	DisclosureTrigger,
} from "@/components/ui/disclosure";
import { Tooltip } from "@/components/ui/tooltip";
import {
	FieldError,
	SearchFields,
} from "@/features/mail/components/mail-search/form/fields";
import {
	SEARCH_FIELD_ID,
	SearchField,
} from "@/features/mail/components/mail-search/search-field";
import {
	conditionsToQuery,
	type ListConditions,
	MAX_CONDITION_TEXT,
} from "@/features/mail/schemas/list-conditions-model";
import {
	isSearchFormMessage,
	searchFormConditions,
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
	const router = useRouter();
	const [errors, setErrors] = useState<Record<string, string>>({});
	const wordsError = errors["q"];
	const wordsMessage =
		wordsError !== undefined && isSearchFormMessage(wordsError)
			? t(wordsError)
			: null;

	const check = (event: React.FormEvent<HTMLFormElement>) => {
		const data = new FormData(event.currentTarget);
		const parsed = searchFormSchema.safeParse(searchFormValues(data));
		if (parsed.success) {
			setErrors({});
			// The search is a change of the address, and the address is what
			// the list reads: the page is drawn again with what it says, and
			// the field keeps the focus and what was written in it. The
			// address says what narrows the list and nothing else: a field
			// that narrows nothing is not in it.
			event.preventDefault();
			const query = new URLSearchParams();
			for (const [name, value] of conditionsToQuery(
				searchFormConditions(data),
			)) {
				query.set(name, value);
			}
			const suffix = query.size > 0 ? `?${query}` : "";
			router.push(`${path}${suffix}` as Route);
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
			className="relative flex min-w-0 flex-1 items-center gap-2"
		>
			{carried(conditions)}
			<div className="min-w-0 flex-1">
				<div className="relative">
					<SearchIcon
						aria-hidden="true"
						className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
					/>
					<SearchField
						id={SEARCH_FIELD_ID}
						name="q"
						defaultValue={conditions.q}
						maxLength={fieldLength(MAX_CONDITION_TEXT)}
						placeholder={t("searchPlaceholder")}
						aria-label={t("searchLabel")}
						aria-keyshortcuts="/"
						aria-invalid={
							wordsError === undefined ? undefined : true
						}
						aria-describedby={
							wordsMessage === null
								? undefined
								: `${SEARCH_FIELD_ID}-message`
						}
						className="min-w-0 w-full ps-9 pe-10"
					/>
				</div>
				{/* The fields are behind the browser's own disclosure, so they
					    are there before any script has loaded: the summary is the
					    button that opens them, and the browser opens and closes
					    them with it. */}
				<Disclosure>
					<DisclosureTrigger className="absolute end-11 top-0 pointer-coarse:end-14">
						<Tooltip label={t("searchFields")} align="end">
							<span>
								<SlidersHorizontalIcon aria-hidden="true" />
								<span className="sr-only">
									{t("searchFields")}
								</span>
							</span>
						</Tooltip>
					</DisclosureTrigger>
					<DisclosureContent className="absolute inset-x-0 top-full z-30 mx-auto mt-2 w-[min(40rem,100%)] rounded-xl bg-surface-raised p-3 shadow-raised">
						<SearchFields conditions={conditions} errors={errors} />
					</DisclosureContent>
				</Disclosure>
				<FieldError id={SEARCH_FIELD_ID} error={wordsMessage} />
			</div>
			<Tooltip label={t("searchSubmit")} align="end">
				<Button type="submit" variant="outline" size="icon">
					<SearchIcon aria-hidden="true" />
					<span className="sr-only">{t("searchSubmit")}</span>
				</Button>
			</Tooltip>
		</form>
	);
}
