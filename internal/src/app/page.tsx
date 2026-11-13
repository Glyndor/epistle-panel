import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/routes";

/**
 * The root answers nothing itself: it sends the visitor to the signed-in area,
 * where the proxy asks for a session and, without one, goes on to the login page.
 */
export default function RootPage(): never {
	redirect(ROUTES.home);
}
