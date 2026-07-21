// Process ADM connection/disconnection lines and normalize times across midnight

function parseRawTimeMs(timeStr) {
  if (!timeStr) return null;

  const match = timeStr.match(/^(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);

  if (hours > 23 || minutes > 59 || seconds > 59) return null;

  return (hours * 3600 + minutes * 60 + seconds) * 1000;
}

function createEventTimeNormalizer() {
  let previousRawTimeMs = null;
  let dayOffsetMs = 0;

  return function normalizeEventTime(timeStr) {
    const rawTimeMs = parseRawTimeMs(timeStr);
    if (rawTimeMs === null) return null;

    if (previousRawTimeMs !== null && rawTimeMs < previousRawTimeMs) {
      dayOffsetMs += 24 * 60 * 60 * 1000;
    }

    previousRawTimeMs = rawTimeMs;
    return dayOffsetMs + rawTimeMs;
  };
}

function extractAdmTime(line) {
  const match = line.match(/^\s*(\d{2}:\d{2}:\d{2})\s*\|/);
  return match ? match[1] : null;
}

function processPlayerSessionLine(
  line,
  stats,
  normalizeEventTime,
  handlePlayerConnect,
  handlePlayerDisconnect
) {
  const timeStr = extractAdmTime(line);
  const normalizedTimeMs = normalizeEventTime(timeStr);

  const connectMatch = line.match(/Player\s+["'“”](.+?)["'“”].*?\(id=[^)]+\)\s+is connected/i);

  if (connectMatch) {
    const playerName = connectMatch[1].trim();
    handlePlayerConnect(stats, playerName, normalizedTimeMs);

    return {
      type: "connect",
      playerName,
      normalizedTimeMs,
    };
  }

  const disconnectMatch = line.match(
    /Player\s+["'“”](.+?)["'“”].*?\(id=[^)]+\)\s+has been disconnected/i
  );

  if (disconnectMatch) {
    const playerName = disconnectMatch[1].trim();
    handlePlayerDisconnect(stats, playerName, normalizedTimeMs);

    return {
      type: "disconnect",
      playerName,
      normalizedTimeMs,
    };
  }

  return {
    type: null,
    playerName: null,
    normalizedTimeMs,
  };
}

module.exports = {
  parseRawTimeMs,
  createEventTimeNormalizer,
  extractAdmTime,
  processPlayerSessionLine,
};
