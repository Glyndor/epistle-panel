"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth/actions/logout";

/** Primary navigation across the admin views, marking the active route. */
export function SiteNav() {
	const t = useTranslations("nav");
	const pathname = usePathname();
	const links = [
		{ href: "/", label: t("status") },
		{ href: "/domains", label: t("domains") },
		{ href: "/accounts", label: t("accounts") },
		{ href: "/queue", label: t("queue") },
	];
	return (
		<header className="border-b">
			<nav
				aria-label={t("label")}
				className="mx-auto flex w-full max-w-3xl flex-wrap items-center px-2 py-1.5"
			>
				{links.map((link) => {
					const active =
						link.href === "/"
							? pathname === "/"
							: pathname.startsWith(link.href);
					return (
						<Button
							key={link.href}
							asChild
							variant="ghost"
							className="px-2 text-muted-foreground aria-[current=page]:font-semibold aria-[current=page]:text-foreground"
						>
							<Link
								href={link.href}
								aria-current={active ? "page" : undefined}
							>
								{link.label}
							</Link>
						</Button>
					);
				})}
				<form action={logout} className="ml-auto">
					<Button
						type="submit"
						variant="ghost"
						className="px-2 text-muted-foreground"
					>
						{t("logout")}
					</Button>
				</form>
			</nav>
		</header>
	);
}
