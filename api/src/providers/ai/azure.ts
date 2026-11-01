import type { Config } from "../../config/index";
import type {
  AiProvider,
  GenerateQuestionsInput,
  GeneratedQuestion,
  MarkAnswerInput,
  MarkAnswerResult,
} from "../types";

export class AzureAiProvider implements AiProvider {
  constructor(_config: Config) {
    // Configured in Phase 6
  }

  async generateQuestions(
    _input: GenerateQuestionsInput
  ): Promise<GeneratedQuestion[]> {
    throw new Error("AzureAiProvider not yet initialized - pending Phase 6");
  }

  async markAnswer(_input: MarkAnswerInput): Promise<MarkAnswerResult> {
    throw new Error("AzureAiProvider not yet initialized - pending Phase 6");
  }
}

