import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { setDisplayNameAction } from "@/features/account-detail/actions/set-display-name";
import { SectionCard } from "@/features/account-detail/components/section-card";
import { reportFailure } from "@/features/account-detail/queries/action-feedback";
import {
	DISPLAY_NAME_ERROR_KEYS,
	DISPLAY_NAME_HTML_MAX,
	DISPLAY_NAME_HTML_PATTERN,
	type DisplayNameFormInput,
	displayNameFormSchema,
} from "@/features/account-detail/schemas/display-name-form";
import { accountsKeys } from "@/features/accounts/queries/accounts-query";
import type { AccountRow } from "@/features/accounts/schemas/accounts-view";
import { isOneOf } from "@/lib/is-one-of";
import { unwrap } from "@/lib/query/action-result";

/**
 * The person's name of the account. It is a form for an account the API
 * manages, and read-only text for one declared in the configuration file, which
 * the API answers `404` for.
 */
export function ProfileSection({ account }: { account: AccountRow }) {
	const t = useTranslations("accountDetail");
	const client = useQueryClient();
	const form = useForm<DisplayNameFormInput>({
		resolver: zodResolver(displayNameFormSchema),
		defaultValues: { displayName: account.displayName ?? "" },
		mode: "onSubmit",
		reValidateMode: "onChange",
	});
	const { mutate, isPending } = useMutation({
		mutationFn: async (displayName: string) =>
			unwrap(
				await setDisplayNameAction({ name: account.name, displayName }),
			),
		onSuccess: (outcome) => {
			switch (outcome.kind) {
				case "done":
					form.reset({
						displayName: outcome.value.displayName ?? "",
					});
					toast.success(
						outcome.value.displayName === null
							? t("displayNameCleared")
							: t("displayNameSaved"),
					);
					break;
				case "notFound":
					toast.error(t("refusedGone"));
					break;
				default:
					form.setError("displayName", {
						message: "displayNameRefused",
					});
			}
		},
		onError: (error) => reportFailure(error, t("unavailable")),
		onSettled: () =>
			client.invalidateQueries({ queryKey: accountsKeys.all }),
	});
	const message = (key: string) =>
		isOneOf(DISPLAY_NAME_ERROR_KEYS, key) ? t(key) : key;

	return (
		<SectionCard id="profile" title={t("profileTitle")}>
			{account.dynamic ? (
				<Form {...form}>
					<form
						onSubmit={form.handleSubmit((values) =>
							mutate(values.displayName),
						)}
						className="flex flex-col gap-4"
					>
						<FormField
							control={form.control}
							name="displayName"
							render={({ field }) => (
								<FormItem described>
									<FormLabel>
										{t("displayNameLabel")}
									</FormLabel>
									<FormControl>
										<Input
											{...field}
											type="text"
											autoComplete="off"
											maxLength={DISPLAY_NAME_HTML_MAX}
											pattern={DISPLAY_NAME_HTML_PATTERN}
											title={t("displayNameFormat")}
										/>
									</FormControl>
									<FormDescription>
										{t("displayNameHelp")}
									</FormDescription>
									<FormMessage render={message} />
								</FormItem>
							)}
						/>
						<Button
							type="submit"
							className="self-start"
							disabled={isPending}
							aria-busy={isPending}
						>
							{isPending
								? t("displayNameSaving")
								: t("displayNameSave")}
						</Button>
					</form>
				</Form>
			) : (
				<p className="text-sm">
					{account.displayName ?? t("displayNameNone")}
				</p>
			)}
		</SectionCard>
	);
}
