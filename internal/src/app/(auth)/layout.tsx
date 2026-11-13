import { PublicFrame } from "@/components/layout/public-frame";

/**
 * Frame of the sign-in page, the one page reachable without a session: the
 * brand above it, the `main` landmark the skip target needs, and the copyright
 * notice.
 */
export default function AuthLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return <PublicFrame>{children}</PublicFrame>;
}
