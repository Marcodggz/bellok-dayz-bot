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

    // Remove from queue only after successful send
    while (killfeedQueue.length > 0) {
      const queuedEvent = killfeedQueue[0];
      const { event, timestamp } = queuedEvent;

      let eventTimestamp = timestamp;
      if (event.kill.t) {
        const timeMatch = event.kill.t.match(/^(\d{2}):(\d{2}):(\d{2})$/);
        if (timeMatch) {
          const now = new Date(timestamp);
          const [, hours, minutes, seconds] = timeMatch;
          const eventDate = new Date(now);
          eventDate.setHours(parseInt(hours, 10));
          eventDate.setMinutes(parseInt(minutes, 10));
          eventDate.setSeconds(parseInt(seconds, 10));

          // Handle midnight rollover: if eventDate is more than 5 minutes in the future,
          // the event likely happened before midnight (yesterday)
          if (eventDate.getTime() - timestamp > 5 * 60 * 1000) {
            eventDate.setDate(eventDate.getDate() - 1);
          }

          eventTimestamp = eventDate.getTime();
        }
      }

      const payload = buildKillEmbed(event.kill, eventTimestamp);
      if (!payload) {
        killfeedQueue.shift();
        continue;
      }

      try {
        await ch.send(payload);
        if (rawToDiscord && event.line) {
          const raw = event.line;
          if (raw) await ch.send("```" + raw + "```");
        }

        killfeedQueue.shift();
        sentCount++;

        await new Promise((r) => setTimeout(r, 100));
      } catch (e) {
        console.error(
          "[killfeed] send error, stopping flush. Remaining events will retry next time:",
          e?.code || e?.message || e,
        );
        // Stop flushing, leave failed event and remaining events in queue
        break;
      }
    }

    console.log(`[killfeed] Successfully flushed ${sentCount} events`);
  } catch (e) {
    console.error("[killfeed] flush error:", e?.code || e?.message || e);
  }
}

module.exports = {
  KILLFEED_FLUSH_INTERVAL_MS,
  queueKillfeedEvent,
  flushKillfeedQueue,
};
