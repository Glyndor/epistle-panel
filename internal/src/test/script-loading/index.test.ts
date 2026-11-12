import { describe, expect, it } from "bun:test";

import { scriptLoadingStubbed, scriptsFinishWith } from ".";

describe("script loading stub", () => {
	it("reports an added script as loaded instead of fetching it", async () => {
		expect(scriptLoadingStubbed).toBe(true);
		const script = document.createElement("script");
		script.src = "https://widgets.example/api.js";
		const outcome = new Promise<string>((resolve) => {
			script.onload = () => resolve("load");
			script.onerror = () => resolve("error");
		});

		document.head.append(script);

		expect(await outcome).toBe("load");
		script.remove();
	});

	it("can be told to fail instead, and back", async () => {
		const outcome = async () => {
			const script = document.createElement("script");
			script.src = "https://widgets.example/api.js";
			const result = new Promise<string>((resolve) => {
				script.onload = () => resolve("load");
				script.onerror = () => resolve("error");
			});
			document.head.append(script);
			const value = await result;
			script.remove();
			return value;
		};

		scriptsFinishWith("error");
		expect(await outcome()).toBe("error");
		scriptsFinishWith("load");
		expect(await outcome()).toBe("load");
	});
});
