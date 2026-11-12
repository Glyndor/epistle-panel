import { getTranslations } from "next-intl/server";

import { LoginForm } from "./_components/login-form";

/** The admin login page, the only route reachable without a session. */
export default async function LoginPage() {
	const t = await getTranslations("auth");
	return (
		<>
			<h1 className="font-semibold text-lg">{t("heading")}</h1>
			<LoginForm />
		</>
	);
}
