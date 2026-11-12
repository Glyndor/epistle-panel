"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

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
				/>
			</div>
			{state.error ? (
				<p role="alert" className="text-destructive text-sm">
					{t("error")}
				</p>
			) : null}
			<Button type="submit" disabled={pending}>
				{t("submit")}
			</Button>
		</form>
	);
}
