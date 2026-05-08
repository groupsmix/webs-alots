/**
 * Bug 5 (R11-01): ReDoS Vulnerability Preservation Tests
 * 
 * **IMPORTANT**: Follow observation-first methodology
 * 
 * These tests capture the behavior on UNFIXED code for normal HTML content.
 * They ensure that after implementing the fix (timeout, size limits), normal HTML:
 * - Continues to be sanitized correctly
 * - Continues to allow safe tags (p, strong, em, ul, ol, li, a, etc.)
 * - Continues to strip dangerous elements (script, iframe, etc.)
 * - Continues to preserve formatting and readability
 * 
 * Preservation Requirements (from design 3.13, 3.14, 3.15):
 * - Legitimate HTML SHALL continue to allow safe tags
 * - Blog posts SHALL continue to display formatted content without XSS
 * - Sanitized HTML SHALL continue to preserve intended formatting
 * 
 * Property: Preservation Checking
 * ```
 * FOR ALL input WHERE NOT isBugCondition_ReDoS(input) DO
 *   // Normal HTML continues to be sanitized with same output
 *   ASSERT sanitizeHTML(input).allowedTags = sanitizeHTML'(input).allowedTags AND
 *          sanitizeHTML(input).output ≈ sanitizeHTML'(input).output
 * END FOR
 * ```
 */

import { describe, it, expect, beforeEach } from "vitest";
import { sanitizeHtml } from "@/lib/sanitize-html";

describe("Bug 5 (R11-01): ReDoS Vulnerability Preservation", () => {
  beforeEach(() => {
    // No setup needed
  });

  describe("Preservation 1: Safe Tags Continue to Work", () => {
    it("should allow paragraph tags", () => {
      const html = "<p>This is a paragraph.</p>";
      const result = sanitizeHtml(html);

      expect(result).toContain("<p>");
      expect(result).toContain("This is a paragraph.");
      expect(result).toContain("</p>");
    });

    it("should allow heading tags (h1-h6)", () => {
      const html = `
        <h1>Heading 1</h1>
        <h2>Heading 2</h2>
        <h3>Heading 3</h3>
        <h4>Heading 4</h4>
        <h5>Heading 5</h5>
        <h6>Heading 6</h6>
      `;
      const result = sanitizeHtml(html);

      expect(result).toContain("<h1>");
      expect(result).toContain("<h2>");
      expect(result).toContain("<h3>");
      expect(result).toContain("<h4>");
      expect(result).toContain("<h5>");
      expect(result).toContain("<h6>");
    });

    it("should allow text formatting tags (strong, em, b, i, u)", () => {
      const html = `
        <strong>Bold text</strong>
        <em>Italic text</em>
        <b>Bold</b>
        <i>Italic</i>
        <u>Underline</u>
      `;
      const result = sanitizeHtml(html);

      expect(result).toContain("<strong>");
      expect(result).toContain("<em>");
      expect(result).toContain("<b>");
      expect(result).toContain("<i>");
      expect(result).toContain("<u>");
    });

    it("should allow list tags (ul, ol, li)", () => {
      const html = `
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
        </ul>
        <ol>
          <li>First</li>
          <li>Second</li>
        </ol>
      `;
      const result = sanitizeHtml(html);

      expect(result).toContain("<ul>");
      expect(result).toContain("<ol>");
      expect(result).toContain("<li>");
      expect(result).toContain("Item 1");
      expect(result).toContain("First");
    });

    it("should allow link tags with href attribute", () => {
      const html = '<a href="https://example.com">Link</a>';
      const result = sanitizeHtml(html);

      expect(result).toContain("<a");
      expect(result).toContain('href="https://example.com"');
      expect(result).toContain("Link");
      expect(result).toContain("</a>");
    });

    it("should allow image tags with src and alt attributes", () => {
      const html = '<img src="https://example.com/image.jpg" alt="Description" />';
      const result = sanitizeHtml(html);

      expect(result).toContain("<img");
      expect(result).toContain('src="https://example.com/image.jpg"');
      expect(result).toContain('alt="Description"');
    });

    it("should allow code and pre tags", () => {
      const html = `
        <pre><code>const x = 42;</code></pre>
      `;
      const result = sanitizeHtml(html);

      expect(result).toContain("<pre>");
      expect(result).toContain("<code>");
      expect(result).toContain("const x = 42;");
    });

    it("should allow blockquote tags", () => {
      const html = "<blockquote>This is a quote.</blockquote>";
      const result = sanitizeHtml(html);

      expect(result).toContain("<blockquote>");
      expect(result).toContain("This is a quote.");
      expect(result).toContain("</blockquote>");
    });

    it("should allow table tags", () => {
      const html = `
        <table>
          <thead>
            <tr><th>Header</th></tr>
          </thead>
          <tbody>
            <tr><td>Data</td></tr>
          </tbody>
        </table>
      `;
      const result = sanitizeHtml(html);

      expect(result).toContain("<table>");
      expect(result).toContain("<thead>");
      expect(result).toContain("<tbody>");
      expect(result).toContain("<tr>");
      expect(result).toContain("<th>");
      expect(result).toContain("<td>");
    });
  });

  describe("Preservation 2: Dangerous Tags Continue to be Stripped", () => {
    it("should strip script tags", () => {
      const html = '<p>Safe content</p><script>alert("XSS")</script>';
      const result = sanitizeHtml(html);

      expect(result).toContain("<p>");
      expect(result).toContain("Safe content");
      expect(result).not.toContain("<script>");
      expect(result).not.toContain("alert");
    });

    it("should strip iframe tags", () => {
      const html = '<p>Content</p><iframe src="https://evil.com"></iframe>';
      const result = sanitizeHtml(html);

      expect(result).toContain("<p>");
      expect(result).not.toContain("<iframe>");
    });

    it("should strip object and embed tags", () => {
      const html = `
        <p>Content</p>
        <object data="malicious.swf"></object>
        <embed src="malicious.swf" />
      `;
      const result = sanitizeHtml(html);

      expect(result).toContain("<p>");
      expect(result).not.toContain("<object>");
      expect(result).not.toContain("<embed>");
    });

    it("should strip form tags", () => {
      const html = `
        <p>Content</p>
        <form action="/submit"><input type="text" /></form>
      `;
      const result = sanitizeHtml(html);

      expect(result).toContain("<p>");
      expect(result).not.toContain("<form>");
      expect(result).not.toContain("<input>");
    });

    it("should strip style tags", () => {
      const html = '<p>Content</p><style>body { background: red; }</style>';
      const result = sanitizeHtml(html);

      expect(result).toContain("<p>");
      expect(result).not.toContain("<style>");
    });

    it("should strip link and meta tags", () => {
      const html = `
        <p>Content</p>
        <link rel="stylesheet" href="evil.css" />
        <meta http-equiv="refresh" content="0;url=evil.com" />
      `;
      const result = sanitizeHtml(html);

      expect(result).toContain("<p>");
      expect(result).not.toContain("<link>");
      expect(result).not.toContain("<meta>");
    });
  });

  describe("Preservation 3: Event Handlers Continue to be Stripped", () => {
    it("should strip onclick handlers", () => {
      const html = '<a href="#" onclick="alert(\'XSS\')">Link</a>';
      const result = sanitizeHtml(html);

      expect(result).toContain("<a");
      expect(result).not.toContain("onclick");
      expect(result).not.toContain("alert");
    });

    it("should strip onerror handlers", () => {
      const html = '<img src="x" onerror="alert(\'XSS\')" />';
      const result = sanitizeHtml(html);

      expect(result).toContain("<img");
      expect(result).not.toContain("onerror");
      expect(result).not.toContain("alert");
    });

    it("should strip onload handlers", () => {
      const html = '<body onload="alert(\'XSS\')">Content</body>';
      const result = sanitizeHtml(html);

      expect(result).not.toContain("onload");
      expect(result).not.toContain("alert");
    });

    it("should strip all event handler attributes", () => {
      const eventHandlers = [
        "onmouseover",
        "onfocus",
        "onblur",
        "onchange",
        "onsubmit",
        "onkeydown",
        "onkeyup",
      ];

      for (const handler of eventHandlers) {
        const html = `<div ${handler}="alert('XSS')">Content</div>`;
        const result = sanitizeHtml(html);

        expect(result).not.toContain(handler);
        expect(result).not.toContain("alert");
      }
    });
  });

  describe("Preservation 4: URL Schemes Continue to be Validated", () => {
    it("should allow http and https URLs", () => {
      const html = `
        <a href="http://example.com">HTTP Link</a>
        <a href="https://example.com">HTTPS Link</a>
      `;
      const result = sanitizeHtml(html);

      expect(result).toContain('href="http://example.com"');
      expect(result).toContain('href="https://example.com"');
    });

    it("should allow mailto URLs", () => {
      const html = '<a href="mailto:test@example.com">Email</a>';
      const result = sanitizeHtml(html);

      expect(result).toContain('href="mailto:test@example.com"');
    });

    it("should allow tel URLs", () => {
      const html = '<a href="tel:+1234567890">Phone</a>';
      const result = sanitizeHtml(html);

      expect(result).toContain('href="tel:+1234567890"');
    });

    it("should strip javascript: URLs", () => {
      const html = '<a href="javascript:alert(\'XSS\')">Link</a>';
      const result = sanitizeHtml(html);

      expect(result).not.toContain("javascript:");
      expect(result).not.toContain("alert");
    });

    it("should strip data: URLs except for images", () => {
      const html = `
        <a href="data:text/html,<script>alert('XSS')</script>">Link</a>
        <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" />
      `;
      const result = sanitizeHtml(html);

      // data: URL in href should be stripped
      expect(result).not.toContain('href="data:text/html');
      
      // data:image/* in img src should be allowed
      expect(result).toContain('src="data:image/png');
    });
  });

  describe("Preservation 5: Formatting and Readability", () => {
    it("should preserve text content", () => {
      const html = "<p>This is important text that must be preserved.</p>";
      const result = sanitizeHtml(html);

      expect(result).toContain("This is important text that must be preserved.");
    });

    it("should preserve nested formatting", () => {
      const html = "<p>This is <strong>bold</strong> and <em>italic</em> text.</p>";
      const result = sanitizeHtml(html);

      expect(result).toContain("<strong>");
      expect(result).toContain("<em>");
      expect(result).toContain("bold");
      expect(result).toContain("italic");
    });

    it("should preserve list structure", () => {
      const html = `
        <ul>
          <li>First item</li>
          <li>Second item with <strong>bold</strong></li>
          <li>Third item</li>
        </ul>
      `;
      const result = sanitizeHtml(html);

      expect(result).toContain("First item");
      expect(result).toContain("Second item");
      expect(result).toContain("<strong>");
      expect(result).toContain("Third item");
    });

    it("should preserve code blocks", () => {
      const html = `
        <pre><code>function hello() {
  console.log("Hello, world!");
}</code></pre>
      `;
      const result = sanitizeHtml(html);

      expect(result).toContain("function hello()");
      expect(result).toContain('console.log("Hello, world!");');
    });

    it("should preserve special characters", () => {
      const html = "<p>Special chars: &lt; &gt; &amp; &quot; &#39;</p>";
      const result = sanitizeHtml(html);

      expect(result).toContain("Special chars:");
      // HTML entities should be preserved or decoded correctly
    });
  });

  describe("Preservation 6: Blog Post Content", () => {
    it("should sanitize typical blog post HTML correctly", () => {
      const html = `
        <h1>Blog Post Title</h1>
        <p>This is the introduction paragraph with <strong>bold</strong> and <em>italic</em> text.</p>
        <h2>Section 1</h2>
        <p>Some content here.</p>
        <ul>
          <li>Point 1</li>
          <li>Point 2</li>
        </ul>
        <h2>Section 2</h2>
        <p>More content with a <a href="https://example.com">link</a>.</p>
        <blockquote>This is a quote from someone.</blockquote>
        <pre><code>const example = "code";</code></pre>
      `;
      const result = sanitizeHtml(html);

      // Check that all safe elements are preserved
      expect(result).toContain("<h1>");
      expect(result).toContain("<h2>");
      expect(result).toContain("<p>");
      expect(result).toContain("<strong>");
      expect(result).toContain("<em>");
      expect(result).toContain("<ul>");
      expect(result).toContain("<li>");
      expect(result).toContain("<a");
      expect(result).toContain("<blockquote>");
      expect(result).toContain("<pre>");
      expect(result).toContain("<code>");
      
      // Check that content is preserved
      expect(result).toContain("Blog Post Title");
      expect(result).toContain("introduction paragraph");
      expect(result).toContain("Point 1");
      expect(result).toContain("This is a quote");
    });

    it("should handle empty tags gracefully", () => {
      const html = "<p></p><div></div><span></span>";
      const result = sanitizeHtml(html);

      // Empty tags should be preserved or removed gracefully
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });

    it("should handle whitespace correctly", () => {
      const html = `
        <p>
          Text with
          line breaks
          and spaces
        </p>
      `;
      const result = sanitizeHtml(html);

      expect(result).toContain("Text with");
      expect(result).toContain("line breaks");
      expect(result).toContain("and spaces");
    });
  });

  describe("Preservation 7: Edge Cases", () => {
    it("should handle empty string", () => {
      const html = "";
      const result = sanitizeHtml(html);

      expect(result).toBe("");
    });

    it("should handle plain text without HTML", () => {
      const html = "This is plain text without any HTML tags.";
      const result = sanitizeHtml(html);

      expect(result).toContain("This is plain text without any HTML tags.");
    });

    it("should handle HTML with only whitespace", () => {
      const html = "   \n\t  ";
      const result = sanitizeHtml(html);

      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });

    it("should handle malformed HTML gracefully", () => {
      const html = "<p>Unclosed paragraph<div>Nested incorrectly</p></div>";
      const result = sanitizeHtml(html);

      // Should not throw error
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });

    it("should handle HTML with mixed case tags", () => {
      const html = "<P>Mixed <STRONG>case</STRONG> tags</P>";
      const result = sanitizeHtml(html);

      // Should normalize or preserve correctly
      expect(result).toContain("Mixed");
      expect(result).toContain("case");
      expect(result).toContain("tags");
    });
  });
});
