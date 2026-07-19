const { buildKillEmbed } = require("./embedBuilders");

const KILLFEED_FLUSH_INTERVAL_MS = 10 * 60 * 1000;
const killfeedQueue = [];

function queueKillfeedEvent(event, key) {
  killfeedQueue.push({
    event,
    timestamp: Date.now(),
    key,
  });
}

function resolveEventTimestamp(rawTime, queuedAt) {
  if (!rawTime) return queuedAt;

  const match = rawTime.match(/^(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return queuedAt;

  const [, hours, minutes, seconds] = match;
  const eventDate = new Date(queuedAt);

  eventDate.setHours(
    Number(hours),
    Number(minutes),
    Number(seconds),
    0,
  );

  const offsetMinutes = Number(process.env.ADM_TIME_OFFSET_MINUTES || 0);
  eventDate.setMinutes(eventDate.getMinutes() + offsetMinutes);

  // A future time usually means the ADM event belongs to the previous day.
  if (eventDate.getTime() - queuedAt > 5 * 60 * 1000) {
    eventDate.setDate(eventDate.getDate() - 1);
  }

  return eventDate.getTime();
}

async function flushKillfeedQueue(client, channelId, debug, rawToDiscord) {
  if (killfeedQueue.length === 0) {
    if (debug) console.log("[killfeed] Queue empty, nothing to flush");
    return;
  }

  console.log(`[killfeed] Flushing ${killfeedQueue.length} queued events...`);

  try {
    const ch = await client.channels.fetch(channelId).catch(() => null);
    if (!ch || typeof ch.send !== "function") {
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
        event.victimStats ?? null,
      );

      if (!payload) {
        killfeedQueue.shift();
        continue;
      }

      try {
        await ch.send(payload);

        if (rawToDiscord && event.line) {
          await ch.send("```" + event.line + "```");
        }

        killfeedQueue.shift();
        sentCount++;

        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(
          "[killfeed] send error, stopping flush. Remaining events will retry next time:",
          error?.code || error?.message || error,
        );
        break;
      }
    }

    console.log(`[killfeed] Successfully flushed ${sentCount} events`);
  } catch (error) {
    console.error(
      "[killfeed] flush error:",
      error?.code || error?.message || error,
    );
  }
}

module.exports = {
  KILLFEED_FLUSH_INTERVAL_MS,
  queueKillfeedEvent,
  flushKillfeedQueue,
};
