import Link from "next/link";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	type DeliveryFilters,
	SINCE_VALUES,
} from "@/features/deliveries/schemas/deliveries-input";
import { DELIVERY_OUTCOMES } from "@/lib/api/schemas";
import { MAX_ADDRESS_LENGTH } from "@/lib/mail-address";

const selectClass =
	"min-h-8 w-full pointer-coarse:min-h-11 rounded-md border border-input bg-background px-3 py-1 text-sm hover:border-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/**
 * The filter form of the delivery log: outcome, window and recipient. A plain
 * GET form, so it works without script and the filters live in the URL (a view
 * can be bookmarked, and the back button works). The server reads the
 * parameters again with the same schema the action enforces. The selects are the
 * browser's own: a Radix Select positions itself with a style attribute the CSP
 * refuses.
 */
export function DeliveriesFilters({ filters }: { filters: DeliveryFilters }) {
	const t = useTranslations("deliveries");
	return (
		<form
			method="get"
			action="/deliveries"
			className="flex flex-wrap items-end gap-4"
		>
			<div className="flex flex-col gap-2">
				<Label htmlFor="deliveries-outcome">{t("outcome")}</Label>
				<select
					id="deliveries-outcome"
					name="outcome"
					defaultValue={filters.outcome ?? ""}
					className={selectClass}
				>
					<option value="">{t("any")}</option>
					{DELIVERY_OUTCOMES.map((outcome) => (
						<option key={outcome} value={outcome}>
							{t(`outcomes.${outcome}`)}
						</option>
					))}
				</select>
			</div>
			<div className="flex flex-col gap-2">
				<Label htmlFor="deliveries-since">{t("since")}</Label>
				<select
					id="deliveries-since"
					name="since"
					defaultValue={filters.since ?? ""}
					className={selectClass}
				>
					<option value="">{t("anyTime")}</option>
					{SINCE_VALUES.map((since) => (
						<option key={since} value={since}>
							{t(`windows.${since}`)}
						</option>
					))}
				</select>
			</div>
			<div className="flex min-w-64 flex-col gap-2">
				<Label htmlFor="deliveries-recipient">{t("recipient")}</Label>
				<Input
					id="deliveries-recipient"
					name="recipient"
					type="text"
					maxLength={MAX_ADDRESS_LENGTH}
					defaultValue={filters.recipient ?? ""}
					autoComplete="off"
					spellCheck={false}
				/>
			</div>
			<div className="flex items-center gap-2">
				<Button type="submit">{t("apply")}</Button>
				<Button asChild variant="link">
					<Link href="/deliveries">{t("clear")}</Link>
				</Button>
			</div>
		</form>
	);
}
