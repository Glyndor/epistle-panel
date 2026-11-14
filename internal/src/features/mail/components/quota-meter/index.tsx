import "server-only";

import { getFormatter, getTranslations } from "next-intl/server";

import { Meter } from "@/components/ui/meter";
import { Skeleton } from "@/components/ui/skeleton";
import { quotaShare } from "@/features/mail/format/quota-share";
import { storageSize } from "@/features/mail/format/storage-size";
import { requestQuota } from "@/features/mail/queries/request-mail";
import { cn } from "@/lib/class-names";

/**
 * The box of the storage: as tall with a meter as without one, and as tall as
 * the placeholder that stands for it while the mail server is asked, so the
 * foot of the sidebar does not move when the answer comes.
 */
const QUOTA_BOX = "min-h-19 rounded-xl";

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
 * its figures. It draws nothing when the server could not be asked or lists no
 * quota in bytes. An account with no limit has no share to draw, so it is told
 * in words what it uses and that there is no limit. Close to the limit and at
 * it the meter changes tone and the state is written out too, since a colour
 * alone would not say it.
 *
 * It waits for the mail server, so the layout renders it inside `Suspense`.
 * It holds no icon: an `svg` with children in a streamed part can be cut and
 * sent in a holder the panel's policy refuses.
 */
export async function QuotaMeter() {
	const quota = await requestQuota();
	if (quota === undefined || quota === null) {
		return null;
	}
	const t = await getTranslations("mail");
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
			className={cn(
				QUOTA_BOX,
				"flex flex-col justify-center gap-1.5 bg-sidebar-accent p-3 text-sidebar-accent-foreground text-xs group-data-[collapsible=icon]:sr-only",
			)}
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
