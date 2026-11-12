import type { Metadata } from "next";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";

import { SiteNav } from "@/components/site-nav";
import { pickClientMessages } from "@/i18n/messages";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("app");
	return {
		title: t("title"),
		description: t("description"),
	};
}

export default async function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	const locale = await getLocale();
	const t = await getTranslations("nav");
	// Client components get only their namespaces; the server pages read the rest.
	const messages = await getMessages();
	const session = await verifySession(
		(await cookies()).get(SESSION_COOKIE)?.value,
	);
	return (
		<html lang={locale} className="h-full antialiased">
			<body className="flex min-h-full flex-col">
				<NextIntlClientProvider messages={pickClientMessages(messages)}>
					{session ? (
						<>
							<a
								href="#main-content"
								className="sr-only rounded bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-10 focus:inline-flex focus:min-h-11 focus:items-center"
							>
								{t("skip")}
							</a>
							<SiteNav />
						</>
					) : null}
					{children}
				</NextIntlClientProvider>
			</body>
		</html>
	);
}
