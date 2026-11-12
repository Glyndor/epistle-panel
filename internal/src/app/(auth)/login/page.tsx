import { getTranslations } from "next-intl/server";

import { getPublicCaptcha } from "@/features/auth/captcha/config";
import { LoginForm } from "@/features/auth/components/login-form";

/** The admin login page, the only route reachable without a session. */
export default async function LoginPage() {
	const t = await getTranslations("auth");
	return (
		<>
			<h1 className="font-semibold text-lg">{t("heading")}</h1>
			<LoginForm captcha={getPublicCaptcha()} />
		</>
	);
}
