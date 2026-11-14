import { useFormatter, useTranslations } from "next-intl";

import { Tooltip } from "@/components/ui/tooltip";
import { CHIP_PILL } from "@/features/mail/components/label-chip";
import type { LabelView } from "@/features/mail/schemas/mail-view";
import { cn } from "@/lib/class-names";

/**
 * The count of the labels a row draws no chip for, with their names under the
 * pointer. Each name is text from a message, so each stands in its own
 * `<bdi>` there too. With no label to count it draws nothing. `className`
 * says where it shows and how tall its line is.
 */
export function More({
	labels,
	className,
}: {
	labels: readonly LabelView[];
	className: string;
}) {
	const t = useTranslations("mail");
	const format = useFormatter();
	if (labels.length === 0) {
		return null;
	}
	return (
		<Tooltip
			label={format.list(
				labels.map((label) => (
					<bdi key={label.keyword}>{label.name}</bdi>
				)),
				{ type: "conjunction" },
			)}
			side="bottom"
			align="end"
		>
			<span
				className={cn(CHIP_PILL, "shrink-0", className)}
				data-slot="label-more"
				data-count={labels.length}
			>
				{t("moreLabels", { count: labels.length })}
			</span>
		</Tooltip>
	);
}
