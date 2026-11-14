import type { Route } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@/components/ui/native-select";
import {
	type DeliveryFilters,
	SINCE_VALUES,
} from "@/features/deliveries/schemas/deliveries-input";
import { DELIVERY_OUTCOMES } from "@/lib/api/schemas";
import {
	MAIL_ADDRESS_HTML_PATTERN,
	MAX_ADDRESS_LENGTH,
} from "@/lib/mail-address-pattern";

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
					<NativeSelect
						id="deliveries-outcome"
						name="outcome"
						defaultValue={filters.outcome ?? ""}
					>
						<NativeSelectOption value="">
							{t("any")}
						</NativeSelectOption>
						{DELIVERY_OUTCOMES.map((outcome) => (
							<NativeSelectOption key={outcome} value={outcome}>
								{t(`outcomes.${outcome}`)}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="deliveries-since">{t("since")}</Label>
					<NativeSelect
						id="deliveries-since"
						name="since"
						defaultValue={filters.since ?? ""}
					>
						<NativeSelectOption value="">
							{t("anyTime")}
						</NativeSelectOption>
						{SINCE_VALUES.map((since) => (
							<NativeSelectOption key={since} value={since}>
								{t(`windows.${since}`)}
							</NativeSelectOption>
						))}
					</NativeSelect>
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
						pattern={MAIL_ADDRESS_HTML_PATTERN}
						title={t("recipientFormat")}
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
