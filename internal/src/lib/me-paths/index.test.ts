import { describe, expect, it } from "bun:test";

import { PUBLIC_ROUTES } from "@/lib/routes";

import { isMePath } from ".";

describe("isMePath", () => {
	it("is the route as the public routes spell it, with or without one slash at the end", () => {
		expect(isMePath(PUBLIC_ROUTES.me)).toBe(true);
		expect(isMePath(`${PUBLIC_ROUTES.me}/`)).toBe(true);
	});

	it("is no route for another case, an encoded letter, a parameter or anything below it", () => {
		for (const path of [
			"/app/Me",
			"/APP/ME",
			"/app/m%65",
			"/%61pp/me",
			"/app/me;x",
			"/app/me//",
			"/app/me/x",
			"/app/me/x/",
			"/app/mex",
			"/app/m",
			"/app/mail",
			"/app//me",
			"//app/me",
			"/app\\me",
			"/app/me%2f",
			"/",
			"",
		]) {
			expect([path, isMePath(path)]).toEqual([path, false]);
		}
	});
});
