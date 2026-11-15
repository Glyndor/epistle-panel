import { describe, expect, it } from "bun:test";

import { TEST_ADMIN_ID } from "@/lib/config/test-support/admin-id";
import { adminRoutes } from "@/lib/routes";

import {
	ACCOUNT_SECTIONS,
	accountSectionHref,
	DEFAULT_SECTION,
	parseSectionParam,
} from ".";

const BASE = adminRoutes(TEST_ADMIN_ID).accountDetail("alice");

describe("the account page's sections", () => {
	it("offers the overview, the profile, the security and the three lists", () => {
		expect(ACCOUNT_SECTIONS).toEqual([
			"overview",
			"profile",
			"security",
			"mailboxes",
			"masked",
			"archive",
		]);
		expect(DEFAULT_SECTION).toBe("overview");
	});

	it("reads the section of the address, and the first of a repeated one", () => {
		expect(parseSectionParam("security")).toBe("security");
		expect(parseSectionParam(["archive", "security"])).toBe("archive");
	});

	it("falls back to the overview for an address that names none, or one that is not offered", () => {
		expect(parseSectionParam(undefined)).toBe("overview");
		expect(parseSectionParam("")).toBe("overview");
		expect(parseSectionParam("nope")).toBe("overview");
		expect(parseSectionParam("../status")).toBe("overview");
		expect(parseSectionParam(["nope"])).toBe("overview");
	});

	it("puts the section in the address, and nothing for the default one", () => {
		expect(accountSectionHref(BASE, "overview")).toBe(BASE);
		expect(accountSectionHref(BASE, "profile")).toBe(
			`${BASE}?section=profile`,
		);
		expect(accountSectionHref(BASE, "archive")).toBe(
			`${BASE}?section=archive`,
		);
	});
});
