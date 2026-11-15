import { expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ErrorNotice } from ".";

// Audit 13: the home link is fixed, never the failing request's address.
it("renders only supplied public labels and the fixed home target", () => {
	const html = renderToStaticMarkup(
		<ErrorNotice
			labels={{
				heading: "Public heading",
				body: "Public explanation",
				retry: "Retry",
				home: "Home",
			}}
			onRetry={() => {}}
		/>,
	);
	expect(html).toContain('href="/"');
	expect(html).toContain("Public explanation");
	expect(html).not.toMatch(/digest|stack|Error:|\/app\//);
});
