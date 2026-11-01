import type { Config } from "../../config/index";
import type {
  EmailProvider,
  SendInviteInput,
  SendInviteResult,
} from "../types";

export class AzureEmailProvider implements EmailProvider {
  constructor(_config: Config) {
    // Configured in Phase 7
  }

  async sendInvite(_input: SendInviteInput): Promise<SendInviteResult> {
    throw new Error("AzureEmailProvider not yet initialized - pending Phase 7");
  }
}

