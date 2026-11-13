import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { setPasswordAction } from "@/features/account-detail/actions/set-password";
import { SectionCard } from "@/features/account-detail/components/section-card";
import { reportFailure } from "@/features/account-detail/queries/action-feedback";
import {
	PASSWORD_ERROR_KEYS,
	PASSWORD_MAX,
	type PasswordFormInput,
	passwordFormSchema,
} from "@/features/account-detail/schemas/password-form";
import { isOneOf } from "@/lib/is-one-of";
import { ActionError } from "@/lib/query/action-result";

/**
 * Change the password of an account the API manages. The password is handled
 * with as little ceremony around it as possible: it is not a query or a
 * mutation (Query would keep the variables in its cache for minutes), it goes
 * straight from the field to the Server Action, the field is emptied as soon as
 * the answer is in, and the answer is a category and never the password. Text
 * fields keep the browser from offering to remember it as the current one
 * (`autoComplete="new-password"`).
 */
export function PasswordSection({ name }: { name: string }) {
	const t = useTranslations("accountDetail");
	const form = useForm<PasswordFormInput>({
		resolver: zodResolver(passwordFormSchema),
		defaultValues: { password: "" },
		mode: "onSubmit",
		reValidateMode: "onChange",
	});
	const message = (key: string) =>
		isOneOf(PASSWORD_ERROR_KEYS, key) ? t(key) : key;

	const submit = form.handleSubmit(async ({ password }) => {
		try {
			const result = await setPasswordAction({ name, password });
			form.resetField("password");
			if (!result.ok) {
				reportFailure(new ActionError(result.reason), t("unavailable"));
				return;
			}
			switch (result.data.kind) {
				case "done":
					toast.success(t("passwordChanged"));
					break;
				case "notFound":
					toast.error(t("refusedGone"));
					break;
				default:
					form.setError("password", { message: "passwordRefused" });
					form.setFocus("password");
			}
		} catch (error) {
			form.resetField("password");
			reportFailure(error, t("unavailable"));
		}
	});
	const pending = form.formState.isSubmitting;

	return (
		<SectionCard
			id="password"
			title={t("passwordTitle")}
			description={t("passwordHelp")}
		>
			<Form {...form}>
				<form onSubmit={submit} className="flex flex-col gap-4">
					<FormField
						control={form.control}
						name="password"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("passwordLabel")}</FormLabel>
								<FormControl>
									<Input
										{...field}
										type="password"
										autoComplete="new-password"
										maxLength={PASSWORD_MAX}
									/>
								</FormControl>
								<FormMessage render={message} />
							</FormItem>
						)}
					/>
					<Button
						type="submit"
						className="self-start"
						disabled={pending}
						aria-busy={pending}
					>
						{pending
							? t("passwordSubmitting")
							: t("passwordSubmit")}
					</Button>
				</form>
			</Form>
		</SectionCard>
	);
}
