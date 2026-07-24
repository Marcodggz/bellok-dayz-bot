import type { KillEvent } from "../../types/domainEvents";
import type { PersistedPlayerStats } from "../../types/domainPersistence";
import { buildKillEmbed } from "./embedBuilders";
import { markSentBucket } from "./killEventDeduplicator";

export const KILLFEED_FLUSH_INTERVAL_MS = 10 * 60 * 1000;

interface QueuedKillfeedPayload {
  kill: KillEvent;
  line?: string;
  killerStats?: PersistedPlayerStats | null;
  victimStats?: PersistedPlayerStats | null;
}

interface QueuedKillfeedEvent {
  event: QueuedKillfeedPayload;
  timestamp: number;
  key: string;
}

interface SendableChannel {
  send(payload: unknown): Promise<unknown>;
}

interface KillfeedClient {
  channels: {
    fetch(channelId: string): Promise<unknown>;
  };
}

const killfeedQueue: QueuedKillfeedEvent[] = [];

export function queueKillfeedEvent(event: QueuedKillfeedPayload, key: string): void {
  killfeedQueue.push({
    event,
    timestamp: Date.now(),
    key,
  });
}

function resolveEventTimestamp(rawTime: string | null, queuedAt: number): number {
  if (!rawTime) {
    return queuedAt;
  }

  const match = rawTime.match(/^(\d{2}):(\d{2}):(\d{2})$/);

  if (!match) {
    return queuedAt;
  }

  const [, hours, minutes, seconds] = match;
  const eventDate = new Date(queuedAt);

  eventDate.setHours(Number(hours), Number(minutes), Number(seconds), 0);

  const offsetMinutes = Number(process.env.ADM_TIME_OFFSET_MINUTES || 0);

  eventDate.setMinutes(eventDate.getMinutes() + offsetMinutes);

  if (eventDate.getTime() - queuedAt > 5 * 60 * 1000) {
    eventDate.setDate(eventDate.getDate() - 1);
  }

  return eventDate.getTime();
}

function isSendableChannel(channel: unknown): channel is SendableChannel {
  return (
    typeof channel === "object" &&
    channel !== null &&
    "send" in channel &&
    typeof channel.send === "function"
  );
}

function getErrorValue(error: unknown): unknown {
  if (typeof error === "object" && error !== null) {
    if ("code" in error && error.code) {
      return error.code;
    }

    if ("message" in error && error.message) {
      return error.message;
    }
  }

  return error;
}

export async function flushKillfeedQueue(
  client: KillfeedClient,
  channelId: string,
  debug: boolean,
  rawToDiscord: boolean
): Promise<void> {
  if (killfeedQueue.length === 0) {
    if (debug) {
      console.log("[killfeed] Queue empty, nothing to flush");
    }

    return;
  }

  console.log(`[killfeed] Flushing ${killfeedQueue.length} queued events...`);

  try {
    const channel = await client.channels.fetch(channelId).catch(() => null);

    if (!isSendableChannel(channel)) {
      console.warn("[killfeed] Invalid channel or missing permissions");

      return;
    }

    let sentCount = 0;

    while (killfeedQueue.length > 0) {
      const queuedEvent = killfeedQueue[0];
      const { event, timestamp } = queuedEvent;

      const eventTimestamp = resolveEventTimestamp(event.kill.t, timestamp);

      const payload = buildKillEmbed(
        event.kill,
        eventTimestamp,
        event.killerStats ?? null,
        event.victimStats ?? null
      );

      if (!payload) {
        killfeedQueue.shift();
        continue;
      }

      try {
        await channel.send(payload);

        killfeedQueue.shift();
        sentCount++;

        try {
          markSentBucket(queuedEvent.key);
        } catch (error) {
          console.error("[killfeed] failed to persist sent bucket:", getErrorValue(error));
        }

        if (rawToDiscord && event.line) {
          try {
            await channel.send(`\`\`\`${event.line}\`\`\``);
          } catch (error) {
            console.error("[killfeed] raw line send error:", getErrorValue(error));
          }
        }

        await new Promise<void>((resolve) => {
          setTimeout(resolve, 100);
        });
      } catch (error) {
        console.error(
          "[killfeed] send error, stopping flush. Remaining events will retry next time:",
          getErrorValue(error)
        );

        break;
      }
    }

    console.log(`[killfeed] Successfully flushed ${sentCount} events`);
  } catch (error) {
    console.error("[killfeed] flush error:", getErrorValue(error));
  }
}
