"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type LoginState, login } from "@/lib/auth/actions/login";

const INITIAL: LoginState = { error: false };

/** The admin login form; the interactive leaf of the login page. */
export function LoginForm() {
	const t = useTranslations("auth");
	const [state, action, pending] = useActionState(login, INITIAL);

	return (
		<form action={action} className="flex flex-col gap-4">
			<div className="flex flex-col gap-2">
				<Label htmlFor="login-name">{t("name")}</Label>
				<Input
					id="login-name"
					name="name"
					type="text"
					autoComplete="username"
					required
					aria-invalid={state.error || undefined}
					aria-describedby={state.error ? "login-error" : undefined}
				/>
			</div>
			<div className="flex flex-col gap-2">
				<Label htmlFor="login-password">{t("password")}</Label>
				<Input
					id="login-password"
					name="password"
					type="password"
					autoComplete="current-password"
					required
					aria-invalid={state.error || undefined}
					aria-describedby={state.error ? "login-error" : undefined}
				/>
			</div>
			{state.error ? (
				<Alert id="login-error" variant="destructive">
					<AlertDescription>{t("error")}</AlertDescription>
				</Alert>
			) : null}
			<Button type="submit" disabled={pending} aria-busy={pending}>
				{pending ? t("pending") : t("submit")}
			</Button>
		</form>
	);
}
