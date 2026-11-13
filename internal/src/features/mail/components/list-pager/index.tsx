import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { mailHref } from "@/features/mail/links/mail-href";
import type { ListFilter } from "@/features/mail/schemas/mail-input";

/**
 * Newer and older links, with the count and the page number between them. The
 * links keep the folder, the filter and the search; the first page has no
 * "newer" and the last has no "older", so neither is a dead link.
 */
export function ListPager({
	view,
	page,
	hasNext,
	total,
}: {
	view: {
		readonly box: string;
		readonly filter: ListFilter;
		readonly q: string;
	};
	page: number;
	hasNext: boolean;
	total: number;
}) {
	const t = useTranslations("mail");

	return (
		<nav
			aria-label={t("pagination")}
			className="flex items-center justify-between gap-2 p-2 text-muted-foreground text-xs"
		>
			{page > 1 ? (
				<Button asChild variant="ghost" size="sm">
					<Link
						href={mailHref({ ...view, page: page - 1 })}
						scroll={false}
					>
						<ChevronLeftIcon aria-hidden="true" />
						{t("newer")}
					</Link>
				</Button>
			) : (
				<span className="w-16" />
			)}
			<span>
				{t("pageNumber", { page })} ·{" "}
				{t("messageCount", { count: total })}
			</span>
			{hasNext ? (
				<Button asChild variant="ghost" size="sm">
					<Link
						href={mailHref({ ...view, page: page + 1 })}
						scroll={false}
					>
						{t("older")}
						<ChevronRightIcon aria-hidden="true" />
					</Link>
				</Button>
			) : (
				<span className="w-16" />
			)}
		</nav>
	);
}
