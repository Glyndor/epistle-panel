import { describe, expect, it } from "bun:test";

import { COMPOSE_TITLE, composeRequest } from ".";

const ID = "00000000-0000-4000-8000-0000000000d1";

describe("composeRequest", () => {
	it("is an empty composer with no parameters", () => {
		expect(composeRequest({})).toEqual({ mode: "new", message: undefined });
	});

	it("reads each way of opening from a message", () => {
		for (const mode of ["reply", "replyAll", "forward", "draft"] as const) {
			expect(composeRequest({ mode, msg: ID })).toEqual({
				mode,
				message: ID,
			});
		}
	});

	it("takes the first value of a parameter given twice", () => {
		expect(
			composeRequest({ mode: ["reply", "forward"], msg: [ID, "x"] }),
		).toEqual({ mode: "reply", message: ID });
	});

	it("is an empty composer for a mode without a message that is an id, and for anything else", () => {
		for (const params of [
			{ mode: "reply" },
			{ mode: "reply", msg: "nope" },
			{ mode: "reply", msg: "../../etc/passwd" },
			{ mode: "Reply", msg: ID },
			{ mode: "new", msg: ID },
			{ mode: "delete", msg: ID },
			{ msg: ID },
			{ mode: "", msg: "" },
		]) {
			expect([params, composeRequest(params)]).toEqual([
				params,
				{ mode: "new", message: undefined },
			]);
		}
	});
});

describe("COMPOSE_TITLE", () => {
	it("titles a reply to all like a reply, and every other mode by its own key", () => {
		expect(COMPOSE_TITLE).toEqual({
			new: "composeTitle",
			reply: "replyTitle",
			replyAll: "replyTitle",
			forward: "forwardTitle",
			draft: "editDraftTitle",
		});
	});
});
