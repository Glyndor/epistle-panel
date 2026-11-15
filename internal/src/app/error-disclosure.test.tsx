import { expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import ErrorPage from "./error";
import GlobalError from "./global-error";

// Audit 13: server rendering needs no browser, cookie mutation or error logging.
const secrets = [
	"database-password-SECRET",
	"digest-PRIVATE",
	"stack-PRIVATE",
	"/app/private-request-PRIVATE",
] as const;
const error = Object.assign(new Error(secrets[0]), {
	digest: secrets[1],
	stack: `${secrets[2]} at ${secrets[3]}`,
});
it.each([ErrorPage, GlobalError])(
	"keeps exception internals out of %p server markup",
	(Page) => {
		const html = renderToStaticMarkup(
			<Page error={error} reset={() => {}} />,
		);
		expect(html).toContain("<main");
		for (const secret of secrets) expect(html).not.toContain(secret);
	},
);
