import "server-only";

import { getFormatter, getTranslations } from "next-intl/server";

import { Meter } from "@/components/ui/meter";
import { Skeleton } from "@/components/ui/skeleton";
import { quotaShare } from "@/features/mail/format/quota-share";
import { storageSize } from "@/features/mail/format/storage-size";
import {
	requestMailSession,
	requestQuota,
} from "@/features/mail/queries/request-mail";
import { cn } from "@/lib/class-names";

/**
 * The box of the storage: as tall with a meter as without one, and as tall as
 * the placeholder that stands for it while the mail server is asked, so the
 * foot of the sidebar does not move when the answer comes.
 */
const QUOTA_BOX = "min-h-19 rounded-xl";

/** How the box is drawn, whatever it says; kept for a screen reader on the rail collapsed to icons. */
const QUOTA_LOOK =
	"flex flex-col justify-center gap-1.5 bg-sidebar-accent p-3 text-sidebar-accent-foreground text-xs group-data-[collapsible=icon]:sr-only";

/** What holds the storage's place until the mail server answers; not drawn on the rail collapsed to icons. */
export function QuotaPlaceholder() {
	return (
		<Skeleton
			data-slot="quota-placeholder"
			className={cn(
				QUOTA_BOX,
				"bg-sidebar-accent group-data-[collapsible=icon]:hidden",
			)}
		/>
	);
}

/**
 * The account's storage, at the foot of the mail area's sidebar: a meter with
 * its figures. Close to the limit and at it the meter changes tone and the
 * state is written out too, since a colour alone would not say it.
 *
 * It waits for the mail server, so the layout renders it inside `Suspense`,
 * behind a placeholder of its own height. Whatever the server answers, the
 * box that comes is as tall as that placeholder, so the foot of the sidebar
 * never moves:
 *
 * - a limit: the meter and the two figures;
 * - no limit (`limit` of `null` or zero): what is used and that there is no
 *   limit, in words, with no meter, since there is no share to draw;
 * - no quota in bytes at all (an empty list), or a server that could not be
 *   asked: the box says the usage is not available. Drawing nothing there
 *   would take the placeholder away and leave a hole where it was. Knowing
 *   it before the frame is sent would mean holding the whole frame until the
 *   mail server answers, which the frame never does.
 *
 * A session with no mail of its own is given neither the box nor the
 * placeholder: the layout knows that without asking anyone.
 *
 * It holds no icon: an `svg` with children in a streamed part can be cut and
 * sent in a holder the panel's policy refuses.
 */
export async function QuotaMeter() {
	if ((await requestMailSession()) === null) {
		return null;
	}
	const quota = await requestQuota();
	const t = await getTranslations("mail");
	if (quota === undefined || quota === null) {
		return (
			<section
				aria-label={t("storage")}
				data-slot="quota"
				data-level="unknown"
				className={cn(QUOTA_BOX, QUOTA_LOOK)}
			>
				<span className="font-medium">{t("storage")}</span>
				<p>{t("storageUnknown")}</p>
			</section>
		);
	}
	const format = await getFormatter();
	const write = (bytes: number) => {
		const size = storageSize(bytes);
		return `${format.number(size.value)} ${size.unit}`;
	};
	const { level, share } = quotaShare(quota);
	const figures =
		level === "unlimited" || quota.limit === null
			? t("storageUnlimited", { used: write(quota.used) })
			: t("storageUsed", {
					used: write(quota.used),
					limit: write(quota.limit),
				});

	return (
		<section
			aria-label={t("storage")}
			data-slot="quota"
			data-level={level}
			className={cn(QUOTA_BOX, QUOTA_LOOK)}
		>
			<div className="flex items-baseline justify-between gap-2">
				<span className="font-medium">{t("storage")}</span>
				{level === "near" || level === "full" ? (
					<span className="font-semibold">
						{t(level === "full" ? "storageFull" : "storageNear")}
					</span>
				) : null}
			</div>
			{share === null || level === "unlimited" ? null : (
				<Meter
					share={share}
					label={t("storage")}
					valueText={figures}
					tone={level}
				/>
			)}
			<p>{figures}</p>
		</section>
	);
}
