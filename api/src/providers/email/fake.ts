/**
 * Fake Email Provider for local development and testing.
 *
 * Stores sent messages in memory so tests can inspect them.
 */
import type {
  EmailProvider,
  SendInviteInput,
  SendInviteResult,
} from "../types.js";
import { newId } from "../../lib/id.js";

export interface OutboxMessage extends SendInviteInput {
  messageId: string;
  sentAt: Date;
}

export class FakeEmailProvider implements EmailProvider {
  private _outbox: OutboxMessage[] = [];
  failCount = 0;
  callCount = 0;

  reset(): void {
    this._outbox = [];
    this.failCount = 0;
    this.callCount = 0;
  }

  get outbox(): ReadonlyArray<OutboxMessage> {
    return this._outbox;
  }

  async sendInvite(input: SendInviteInput): Promise<SendInviteResult> {
    this.callCount++;

    if (this.failCount > 0) {
      this.failCount--;
      throw new Error("Fake email provider transient failure");
    }

    const messageId = newId();
    this._outbox.push({ ...input, messageId, sentAt: new Date() });
    return { messageId };
  }

  /**
   * Drain outbox for test assertions.
   */
  drainOutbox(): OutboxMessage[] {
    const messages = [...this._outbox];
    this._outbox = [];
    return messages;
  }
}

