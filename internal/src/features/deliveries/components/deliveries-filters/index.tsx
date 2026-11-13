import type { Route } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { FIELD_CLASS, Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	type DeliveryFilters,
	SINCE_VALUES,
} from "@/features/deliveries/schemas/deliveries-input";
import { DELIVERY_OUTCOMES } from "@/lib/api/schemas";
import { MAX_ADDRESS_LENGTH } from "@/lib/mail-address";

/**
 * The filter form of the delivery log: outcome, window and recipient. A plain
 * GET form, so it works without script and the filters live in the URL (a view
 * can be bookmarked, and the back button works). The server reads the
 * parameters again with the same schema the action enforces. The selects are the
 * browser's own: measured in the built server, a Radix Select renders a style
 * attribute in the server HTML (refused by `style-src`), injects a style
 * element without a nonce, and a form with no script could not use it.
 */
export function DeliveriesFilters({
	filters,
	path,
}: {
	filters: DeliveryFilters;
	/** The delivery log's own path, which the form submits to and the clear link returns to. */
	path: Route;
}) {
	const t = useTranslations("deliveries");
	return (
		<div className="@container">
			<form
				method="get"
				action={path}
				className="grid gap-4 @2xl:grid-cols-[12rem_12rem_minmax(16rem,1fr)_auto] @2xl:items-end"
			>
				<div className="flex flex-col gap-2">
					<Label htmlFor="deliveries-outcome">{t("outcome")}</Label>
					<select
						id="deliveries-outcome"
						name="outcome"
						defaultValue={filters.outcome ?? ""}
						className={FIELD_CLASS}
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
						className={FIELD_CLASS}
					>
						<option value="">{t("anyTime")}</option>
						{SINCE_VALUES.map((since) => (
							<option key={since} value={since}>
								{t(`windows.${since}`)}
							</option>
						))}
					</select>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="deliveries-recipient">
						{t("recipient")}
					</Label>
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
						<Link href={path}>{t("clear")}</Link>
					</Button>
				</div>
			</form>
		</div>
	);
}
