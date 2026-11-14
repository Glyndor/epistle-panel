import { useFormatter, useTranslations } from "next-intl";

import { Tooltip } from "@/components/ui/tooltip";
import { CHIP_PILL, LabelChip } from "@/features/mail/components/label-chip";
import type { LabelView } from "@/features/mail/schemas/mail-view";
import { cn } from "@/lib/class-names";

/** The most chips a row draws, where it is widest. */
const SHOWN_MOST = 3;

/**
 * Where each chip shows. The row is the container (`@container/row`) and the
 * pane says the density (`group/list`). A chip is only drawn where the row's
 * narrowest line still holds it with four characters of its name beside the
 * subject's own least width; anywhere else it is counted, never squeezed.
 *
 * - comfortable: none under 24rem, one from 24rem, three from 32rem;
 * - compact: none under 32rem, one from there.
 */
const FIRST =
	"hidden @sm/row:inline-flex group-data-[density=compact]/list:hidden group-data-[density=compact]/list:@lg/row:inline-flex";
const OTHERS =
	"hidden @lg/row:inline-flex group-data-[density=compact]/list:hidden";

/** Where each count shows: the one for no chip, for one chip and for three. */
const COUNT_ALL =
	"@sm/row:hidden group-data-[density=compact]/list:inline-flex group-data-[density=compact]/list:@lg/row:hidden";
const COUNT_AFTER_ONE =
	"hidden @sm/row:inline-flex @lg/row:hidden group-data-[density=compact]/list:hidden group-data-[density=compact]/list:@lg/row:inline-flex";
const COUNT_AFTER_THREE =
	"hidden @lg/row:inline-flex group-data-[density=compact]/list:hidden";

/** A chip is as tall as the line it sits on, so a row with labels is as tall as one without. */
const LINE = "h-5 group-data-[density=compact]/list:h-4";

/**
 * The count of the labels a row draws no chip for, with their names under the
 * pointer. Each name is text from a message, so each stands in its own
 * `<bdi>` there too.
 */
function More({
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
				className={cn(CHIP_PILL, LINE, "shrink-0", className)}
				data-slot="label-more"
				data-count={labels.length}
			>
				{t("moreLabels", { count: labels.length })}
			</span>
		</Tooltip>
	);
}

/**
 * The labels of a message after its subject. A row never draws a chip without
 * a readable name: where the line has no room for one, the labels are a count
 * (`+N`, of all of them), and they are never left out. Where there is room, a
 * chip or three come first and the count is of the rest. There is one count
 * for each case, since one number would be wrong in the others. The names
 * behind a count show under the pointer; the reader of the open message
 * lists every label for whoever has no pointer.
 *
 * The chips give way before the subject does: they shrink down to four
 * characters of name each while the subject keeps its least width.
 *
 * All of it is hidden from assistive technology: the row says every label in
 * words once, in its state sentence, and would otherwise say the shown ones
 * twice and the rest never.
 */
export function LabelChips({ labels }: { labels: readonly LabelView[] }) {
	if (labels.length === 0) {
		return null;
	}

	return (
		<span
			aria-hidden="true"
			data-slot="label-chips"
			className="flex min-w-0 shrink items-center gap-1"
		>
			{labels.slice(0, SHOWN_MOST).map((label, index) => (
				<LabelChip
					key={label.keyword}
					label={label}
					className={cn(
						LINE,
						"max-w-28 shrink",
						index === 0 ? FIRST : OTHERS,
					)}
				/>
			))}
			<More labels={labels} className={COUNT_ALL} />
			<More labels={labels.slice(1)} className={COUNT_AFTER_ONE} />
			<More
				labels={labels.slice(SHOWN_MOST)}
				className={COUNT_AFTER_THREE}
			/>
		</span>
	);
}
