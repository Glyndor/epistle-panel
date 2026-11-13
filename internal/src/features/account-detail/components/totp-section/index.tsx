import { useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmAction } from "@/components/confirm-action";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { disableTotpAction } from "@/features/account-detail/actions/disable-totp";
import { enrollTotpAction } from "@/features/account-detail/actions/enroll-totp";
import { SectionCard } from "@/features/account-detail/components/section-card";
import { reportFailure } from "@/features/account-detail/queries/action-feedback";
import type { TotpSecretView } from "@/features/account-detail/schemas/account-views";
import { ActionError } from "@/lib/query/action-result";

type Busy = "enroll" | "disable" | null;

/**
 * Two-factor authentication of an account the API manages. The API cannot say
 * whether it is on, and enrolling replaces the secret at once with no
 * confirmation step, so both buttons ask first with an alert dialog.
 *
 * The new secret is the one sensitive value on the page. It lives in this
 * component's state only: not in the query cache (so it is never dehydrated or
 * kept after the page is left), not in a toast, not in the URL, not in a log. It
 * is on screen until the person hides it, enrols again or leaves the page.
 */
export function TotpSection({ name }: { name: string }) {
	const t = useTranslations("accountDetail");
	const [secret, setSecret] = useState<TotpSecretView | null>(null);
	const [busy, setBusy] = useState<Busy>(null);

	async function enroll() {
		setBusy("enroll");
		setSecret(null);
		try {
			const result = await enrollTotpAction({ name });
			if (!result.ok) {
				reportFailure(new ActionError(result.reason), t("unavailable"));
			} else if (result.data.kind === "done") {
				setSecret(result.data.value);
			} else {
				toast.error(t("refusedGone"));
			}
		} catch (error) {
			reportFailure(error, t("unavailable"));
		} finally {
			setBusy(null);
		}
	}

	async function disable() {
		setBusy("disable");
		setSecret(null);
		try {
			const result = await disableTotpAction({ name });
			if (!result.ok) {
				reportFailure(new ActionError(result.reason), t("unavailable"));
			} else if (result.data.kind === "done") {
				toast.success(t("totpDisabled"));
			} else {
				toast.error(t("refusedGone"));
			}
		} catch (error) {
			reportFailure(error, t("unavailable"));
		} finally {
			setBusy(null);
		}
	}

	return (
		<SectionCard
			id="totp"
			title={t("totpTitle")}
			description={t("totpHelp")}
		>
			<div className="flex flex-wrap gap-2">
				<ConfirmAction
					description={t("totpEnrollConfirm", { name })}
					destructive={false}
					onConfirm={enroll}
				>
					<Button
						type="button"
						variant="outline"
						disabled={busy !== null}
					>
						{busy === "enroll"
							? t("totpEnrolling")
							: t("totpEnroll")}
					</Button>
				</ConfirmAction>
				<ConfirmAction
					description={t("totpDisableConfirm", { name })}
					onConfirm={disable}
				>
					<Button
						type="button"
						variant="destructive"
						disabled={busy !== null}
					>
						{busy === "disable"
							? t("totpDisabling")
							: t("totpDisable")}
					</Button>
				</ConfirmAction>
			</div>
			{secret ? (
				<Alert variant="warning" role="status">
					<AlertDescription className="flex flex-col gap-2">
						<span className="font-semibold">
							{t("totpSecretTitle")}
						</span>
						<span>{t("totpSecretWarning")}</span>
						<span>{t("totpSecretLabel")}</span>
						<code className="select-all break-all font-mono">
							{secret.secret}
						</code>
						<span>{t("totpUriLabel")}</span>
						<code className="select-all break-all font-mono">
							{secret.otpauthUri}
						</code>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="self-start"
							onClick={() => setSecret(null)}
						>
							{t("totpHide")}
						</Button>
					</AlertDescription>
				</Alert>
			) : null}
		</SectionCard>
	);
}
