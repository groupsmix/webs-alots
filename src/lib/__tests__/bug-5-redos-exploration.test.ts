/**
 * Bug 5 (R11-01): ReDoS Vulnerability in HTML Sanitization
 * 
 * Bug Condition Exploration Test
 * 
 * **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists.
 * **DO NOT attempt to fix the test or the code when it fails.**
 * 
 * This test encodes the expected behavior after the fix is implemented.
 * When this test passes after implementing the fix, it confirms the bug is resolved.
 * 
 * Bug Condition Function:
 * ```
 * FUNCTION isBugCondition_ReDoS(input)
 *   INPUT: input of type HTMLString
 *   OUTPUT: boolean
 *   
 *   RETURN (input.containsNestedTags = TRUE OR
 *           input.containsRepetitivePatterns = TRUE) AND
 *          sanitizer.timeComplexity(input) > O(n)
 * END FUNCTION
 * ```
 * 
 * Expected Behavior Properties (from design 2.13, 2.14, 2.15):
 * - System SHALL use DOMPurify library with linear time complexity
 * - System SHALL sanitize content without CPU exhaustion or timeouts
 * - System SHALL complete sanitization in <100ms for all inputs
 * - System SHALL reject inputs larger than 1 MB
 * - System SHALL timeout after 5 seconds if sanitization takes too long
 * 
 * NOTE: The current implementation already uses DOMPurify, which has linear time complexity.
 * This test verifies that additional protections (timeout, size limits) are in place.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { sanitizeHtml } from "@/lib/sanitize-html";

describe("Bug 5 (R11-01): ReDoS Vulnerability Exploration", () => {
  beforeEach(() => {
    // No setup needed
  });

  describe("Bug Condition 1: Deeply Nested HTML", () => {
    it("should sanitize deeply nested HTML in <100ms (EXPECTED TO FAIL ON UNFIXED CODE)", () => {
      // Generate HTML with 1000 nested <div> tags
      const depth = 1000;
      let html = "";
      for (let i = 0; i < depth; i++) {
        html += "<div>";
      }
      html += "Content";
      for (let i = 0; i < depth; i++) {
        html += "</div>";
      }

      const startTime = Date.now();
      const result = sanitizeHtml(html);
      const duration = Date.now() - startTime;

      // EXPECTED BEHAVIOR AFTER FIX: Should complete in <100ms
      // CURRENT BEHAVIOR: May take longer or timeout
      expect(duration).toBeLessThan(100);
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });

    it("should sanitize extremely nested HTML (10,000 levels) without CPU exhaustion (EXPECTED TO FAIL ON UNFIXED CODE)", () => {
      // Generate HTML with 10,000 nested <div> tags
      const depth = 10000;
      let html = "";
      for (let i = 0; i < depth; i++) {
        html += "<div>";
      }
      html += "Deep content";
      for (let i = 0; i < depth; i++) {
        html += "</div>";
      }

      const startTime = Date.now();
      const result = sanitizeHtml(html);
      const duration = Date.now() - startTime;

      // EXPECTED BEHAVIOR AFTER FIX: Should complete in reasonable time (<1 second)
      expect(duration).toBeLessThan(1000);
      expect(result).toBeDefined();
    });
  });

  describe("Bug Condition 2: Repetitive Patterns", () => {
    it("should sanitize HTML with 10,000 repeated tags in <100ms (EXPECTED TO FAIL ON UNFIXED CODE)", () => {
      // Generate HTML with 10,000 repeated <span> tags
      const count = 10000;
      let html = "";
      for (let i = 0; i < count; i++) {
        html += `<span>Text ${i}</span>`;
      }

      const startTime = Date.now();
      const result = sanitizeHtml(html);
      const duration = Date.now() - startTime;

      // EXPECTED BEHAVIOR AFTER FIX: Should complete in <100ms
      expect(duration).toBeLessThan(100);
      expect(result).toBeDefined();
    });

    it("should sanitize HTML with repetitive attributes without catastrophic backtracking (EXPECTED TO FAIL ON UNFIXED CODE)", () => {
      // Generate HTML with many repeated attributes (potential ReDoS vector)
      let html = '<a ';
      for (let i = 0; i < 1000; i++) {
        html += `href="x" `;
      }
      html += '>Link</a>';

      const startTime = Date.now();
      const result = sanitizeHtml(html);
      const duration = Date.now() - startTime;

      // EXPECTED BEHAVIOR AFTER FIX: Should complete quickly
      expect(duration).toBeLessThan(100);
      expect(result).toBeDefined();
    });

    it("should sanitize HTML with 100,000 repeated script tags (EXPECTED TO FAIL ON UNFIXED CODE)", () => {
      // Generate HTML with many <script> tags (should be stripped)
      const count = 100000;
      let html = "";
      for (let i = 0; i < count; i++) {
        html += `<script>alert(${i})</script>`;
      }

      const startTime = Date.now();
      const result = sanitizeHtml(html);
      const duration = Date.now() - startTime;

      // EXPECTED BEHAVIOR AFTER FIX: Should complete in reasonable time
      expect(duration).toBeLessThan(1000);
      expect(result).toBeDefined();
      // All script tags should be stripped
      expect(result).not.toContain("<script>");
    });
  });

  describe("Bug Condition 3: Input Size Limits", () => {
    it("should REJECT HTML input larger than 1 MB (EXPECTED TO FAIL ON UNFIXED CODE)", () => {
      // Generate HTML larger than 1 MB (1,048,576 bytes)
      const size = 1048577; // 1 MB + 1 byte
      const html = "x".repeat(size);

      // EXPECTED BEHAVIOR AFTER FIX: Should reject oversized input
      // CURRENT BEHAVIOR (UNFIXED): Processes input without size check
      expect(() => {
        sanitizeHtml(html);
      }).toThrow(/size|limit|too large/i);
    });

    it("should ACCEPT HTML input at exactly 1 MB (EXPECTED TO FAIL ON UNFIXED CODE)", () => {
      // Generate HTML at exactly 1 MB
      const size = 1048576; // Exactly 1 MB
      const html = "x".repeat(size);

      // EXPECTED BEHAVIOR AFTER FIX: Should accept input at limit
      expect(() => {
        const result = sanitizeHtml(html);
        expect(result).toBeDefined();
      }).not.toThrow();
    });

    it("should ACCEPT HTML input smaller than 1 MB (EXPECTED TO FAIL ON UNFIXED CODE)", () => {
      // Generate HTML smaller than 1 MB
      const html = "<p>Normal content</p>".repeat(1000); // ~21 KB

      // EXPECTED BEHAVIOR: Should accept normal-sized input
      expect(() => {
        const result = sanitizeHtml(html);
        expect(result).toBeDefined();
      }).not.toThrow();
    });
  });

  describe("Bug Condition 4: Timeout Protection", () => {
    it("should timeout after 5 seconds if sanitization takes too long (EXPECTED TO FAIL ON UNFIXED CODE)", async () => {
      // This test is conceptual - in practice, DOMPurify should never take 5 seconds
      // But we need timeout protection as defense-in-depth
      
      // Generate extremely complex HTML that might stress the parser
      let html = "";
      for (let i = 0; i < 50000; i++) {
        html += `<div class="a${i}" id="b${i}" data-x="${i}"><span>Text ${i}</span></div>`;
      }

      const startTime = Date.now();
      
      // EXPECTED BEHAVIOR AFTER FIX: Should either complete or timeout within 5 seconds
      // CURRENT BEHAVIOR (UNFIXED): No timeout protection
      try {
        const result = sanitizeHtml(html);
        const duration = Date.now() - startTime;
        
        // If it completes, should be within 5 seconds
        expect(duration).toBeLessThan(5000);
        expect(result).toBeDefined();
      } catch (error) {
        // If it throws, should be a timeout error
        expect(error).toMatch(/timeout/i);
        const duration = Date.now() - startTime;
        expect(duration).toBeLessThanOrEqual(5100); // 5s + small buffer
      }
    }, 10000); // Test timeout: 10 seconds
  });

  describe("Bug Condition 5: Linear Time Complexity", () => {
    it("should demonstrate O(n) time complexity (EXPECTED TO FAIL ON UNFIXED CODE)", () => {
      // Test with increasing input sizes to verify linear time complexity
      const sizes = [100, 1000, 10000];
      const times: number[] = [];

      for (const size of sizes) {
        const html = "<p>Test</p>".repeat(size);
        
        const startTime = Date.now();
        sanitizeHtml(html);
        const duration = Date.now() - startTime;
        
        times.push(duration);
      }

      // EXPECTED BEHAVIOR AFTER FIX: Time should scale linearly with input size
      // If time complexity is O(n), then time[2] / time[1] ≈ size[2] / size[1]
      // Allow for some variance due to measurement noise
      
      // Ratio of input sizes: 10000 / 1000 = 10
      const sizeRatio = sizes[2] / sizes[1];
      
      // Ratio of execution times
      const timeRatio = times[2] / times[1];
      
      // For linear complexity, timeRatio should be close to sizeRatio
      // Allow 2x variance (could be 5x to 20x for O(n))
      expect(timeRatio).toBeLessThan(sizeRatio * 2);
      expect(timeRatio).toBeGreaterThan(sizeRatio * 0.5);
    });
  });

  describe("Bug Condition 6: Malicious Patterns", () => {
    it("should handle HTML with nested comments without ReDoS (EXPECTED TO FAIL ON UNFIXED CODE)", () => {
      // Nested comments can trigger ReDoS in some regex patterns
      let html = "";
      for (let i = 0; i < 1000; i++) {
        html += "<!-- Comment " + i + " -->";
      }

      const startTime = Date.now();
      const result = sanitizeHtml(html);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100);
      expect(result).toBeDefined();
    });

    it("should handle HTML with malformed tags without ReDoS (EXPECTED TO FAIL ON UNFIXED CODE)", () => {
      // Malformed tags can trigger ReDoS in regex-based sanitizers
      let html = "";
      for (let i = 0; i < 1000; i++) {
        html += "<div<div>Content</div>";
      }

      const startTime = Date.now();
      const result = sanitizeHtml(html);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100);
      expect(result).toBeDefined();
    });

    it("should handle HTML with excessive whitespace without ReDoS (EXPECTED TO FAIL ON UNFIXED CODE)", () => {
      // Excessive whitespace can trigger ReDoS in some patterns
      let html = "<div";
      for (let i = 0; i < 10000; i++) {
        html += " ";
      }
      html += ">Content</div>";

      const startTime = Date.now();
      const result = sanitizeHtml(html);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100);
      expect(result).toBeDefined();
    });
  });
});
