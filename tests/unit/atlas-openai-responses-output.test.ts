import { describe, expect, it } from "vitest";
import { extractResponsesOutputText } from "../../supabase/functions/atlas-route-intelligence/responsesOutput";

describe("raw OpenAI Responses output extraction", () => {
  it("reads output_text from the REST output content array", () => {
    expect(extractResponsesOutputText({
      id: "resp_example",
      status: "completed",
      output: [{ type: "message", content: [{ type: "output_text", text: "{\"decision\":\"REVIEW\"}" }] }]
    })).toBe('{"decision":"REVIEW"}');
  });

  it("joins multiple text items and keeps SDK convenience payloads compatible", () => {
    expect(extractResponsesOutputText({ output: [
      { content: [{ type: "output_text", text: "part one" }, { type: "output_text", text: "part two" }] }
    ] })).toBe("part one\npart two");
    expect(extractResponsesOutputText({ output_text: " {\"ok\":true} " })).toBe('{"ok":true}');
  });

  it("rejects incomplete, refused, and malformed responses", () => {
    expect(extractResponsesOutputText({ status: "incomplete", output: [{ content: [{ type: "output_text", text: "{}" }] }] })).toBeNull();
    expect(extractResponsesOutputText({ status: "completed", output: [{ content: [{ type: "refusal", refusal: "refused" }] }] })).toBeNull();
    expect(extractResponsesOutputText(null)).toBeNull();
  });
});
