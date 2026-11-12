import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";

import { pickClientMessages } from "@/i18n/messages";

import "./globals.css";

/**
 * The panel is never indexed. Next renders these as a `robots` meta tag; the
 * `X-Robots-Tag` header (see `lib/security-headers`) says the same on every
 * response, including the ones that carry no HTML. There is deliberately no
 * description, canonical link, Open Graph or Twitter metadata.
 */
export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("app");
	return {
		title: t("title"),
		robots: {
			index: false,
			follow: false,
			noarchive: true,
			nosnippet: true,
			noimageindex: true,
		},
	};
}

export default async function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	const locale = await getLocale();
	// Client components get only their namespaces; the server pages read the rest.
	const messages = await getMessages();
	return (
		<html lang={locale} className="h-full antialiased">
			<body className="min-h-full text-sm">
				<NextIntlClientProvider messages={pickClientMessages(messages)}>
					{children}
				</NextIntlClientProvider>
			</body>
		</html>
	);
}
