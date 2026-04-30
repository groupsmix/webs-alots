import { describe, expect, it } from "vitest";
import { escapeSlackMrkdwn } from "@/lib/escape-slack";

describe("escapeSlackMrkdwn (A15)", () => {
  it("returns empty string for nullish input", () => {
    expect(escapeSlackMrkdwn(null)).toBe("");
    expect(escapeSlackMrkdwn(undefined)).toBe("");
    expect(escapeSlackMrkdwn("")).toBe("");
  });

  it("neutralises mention syntax", () => {
    expect(escapeSlackMrkdwn("<!channel>")).toBe("&lt;!channel&gt;");
    expect(escapeSlackMrkdwn("<!here>")).toBe("&lt;!here&gt;");
    expect(escapeSlackMrkdwn("<@U12345>")).toBe("&lt;@U12345&gt;");
  });

  it("neutralises link injection", () => {
    expect(escapeSlackMrkdwn("<https://evil.example|click me>")).toBe(
      "&lt;https://evil.example|click me&gt;",
    );
  });

  it("escapes ampersands without double-encoding the angle-bracket entities", () => {
    expect(escapeSlackMrkdwn("Tom & <Jerry>")).toBe("Tom &amp; &lt;Jerry&gt;");
  });

  it("leaves benign formatting characters untouched", () => {
    // *, _, ~, ` are formatting only — leave them alone so legitimate
    // names and notes still read naturally.
    expect(escapeSlackMrkdwn("*bold* _italic_ ~strike~ `code`")).toBe(
      "*bold* _italic_ ~strike~ `code`",
    );
  });
});
