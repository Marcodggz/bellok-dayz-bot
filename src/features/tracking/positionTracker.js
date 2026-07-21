// Player position tracking from ADM log lines
// ADM pos=<X, Y, Z>: X/Y are map coordinates; Z is elevation.

const { escapeRegExp } = require("../../utils/helpers");
const { addWeekendHeatPoint } = require("../../utils/weekendHeatmapHelpers");

const lastPosByName = new Map();

function updatePositionsFromLine(line) {
  const re =
    /Player\s+["'“”]([^"'“”]+)["'“”]\s*\([^)]*?pos=<\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.-]+)\s*>\)/gi;
  let m;
  while ((m = re.exec(line)) !== null) {
    const name = m[1];
    const x = +m[2];
    const y = +m[3];
    if (!Number.isNaN(x) && !Number.isNaN(y)) {
      lastPosByName.set(name, { x, y, ts: Date.now() });
      addWeekendHeatPoint(name, x, y);
    }
  }
}

function posForVictimFromLine(victim, line) {
  const rex = new RegExp(
    `Player\\s+["'“”]${escapeRegExp(victim)}["'“”][^\\n]*?pos=<\\s*([0-9.]+)\\s*,\\s*([0-9.]+)\\s*,\\s*([0-9.\\-]+)\\s*>`,
    "i",
  );
  const m = line.match(rex);
  if (m) {
    return { x: +m[1], y: +m[2] };
  }
  const last = lastPosByName.get(victim);
  return last ? { x: last.x, y: last.y } : null;
}

module.exports = {
  updatePositionsFromLine,
  posForVictimFromLine,
};
