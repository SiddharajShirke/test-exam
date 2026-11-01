/**
 * Fake AI Provider for local development and testing.
 *
 * Scriptable:
 *   - Set failCount to make it fail N times before succeeding
 *   - Set returnInvalidJson to always return invalid JSON
 *   - Set simulateTimeout to reject with a timeout error
 *   - Set simulate429 to return a 429 error
 *   - Set partialCount to return fewer questions than asked
 */
import type {
  AiProvider,
  GenerateQuestionsInput,
  GeneratedQuestion,
  MarkAnswerInput,
  MarkAnswerResult,
} from "../types";

export class FakeAiProvider implements AiProvider {
  /** Number of times to fail before succeeding */
  failCount = 0;
  /** Always return malformed JSON */
  returnInvalidJson = false;
  /** Simulate a network timeout */
  simulateTimeout = false;
  /** Simulate HTTP 429 from AI service */
  simulate429 = false;
  /** Return only this many questions (undefined = all requested) */
  partialCount?: number;
  /** Track total calls made */
  callCount = 0;
  /** Track individual call history */
  calls: GenerateQuestionsInput[] = [];

  reset(): void {
    this.failCount = 0;
    this.returnInvalidJson = false;
    this.simulateTimeout = false;
    this.simulate429 = false;
    this.partialCount = undefined;
    this.callCount = 0;
    this.calls = [];
  }

  async generateQuestions(
    input: GenerateQuestionsInput
  ): Promise<GeneratedQuestion[]> {
    this.callCount++;
    this.calls.push(input);

    if (this.simulateTimeout) {
      throw Object.assign(new Error("AI call timed out"), { code: "TIMEOUT" });
    }

    if (this.simulate429) {
      throw Object.assign(new Error("AI rate limited"), {
        code: "RATE_LIMITED",
        retryAfter: 2,
      });
    }

    if (this.returnInvalidJson) {
      throw new Error("Invalid JSON returned from AI");
    }

    if (this.failCount > 0) {
      this.failCount--;
      throw new Error("Fake AI transient failure");
    }

    const count = this.partialCount ?? input.count;
    const questions: GeneratedQuestion[] = [];

    for (let i = 0; i < count; i++) {
      if (input.type === "mcq" || input.type === "cognitive") {
        questions.push({
          type: input.type,
          question: `Sample ${input.type} question ${i + 1} about ${input.domain}`,
          options: ["Option A", "Option B", "Option C", "Option D"],
          correct: "A",
          explanation: `Explanation for question ${i + 1}`,
        });
      } else {
        questions.push({
          type: "descriptive",
          question: `Describe ${input.domain} in detail (question ${i + 1})`,
          rubric: "Award marks based on accuracy, depth and clarity.",
          maxScore: 10,
          wordLimit: 250,
        });
      }
    }

    return questions;
  }

  async markAnswer(input: MarkAnswerInput): Promise<MarkAnswerResult> {
    this.callCount++;

    if (this.simulateTimeout) {
      throw Object.assign(new Error("AI marking timed out"), { code: "TIMEOUT" });
    }

    if (this.simulate429) {
      throw Object.assign(new Error("AI rate limited"), {
        code: "RATE_LIMITED",
        retryAfter: 2,
      });
    }

    if (this.returnInvalidJson) {
      throw new Error("Invalid JSON returned from AI");
    }

    if (this.failCount > 0) {
      this.failCount--;
      throw new Error("Fake AI transient failure");
    }

    // Simple fake: give half marks for any non-empty answer
    const score =
      input.answer.trim().length > 0 ? Math.floor(input.maxScore / 2) : 0;
    return {
      score,
      justification: `Fake AI assessment: awarded ${score} of ${input.maxScore} marks.`,
    };
  }
}
