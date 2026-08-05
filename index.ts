import * as config from "./src/config/config.js";
import { tMadrid } from "./src/utils/helpers.js";
import { loadMockStats, saveMockStats } from "./src/storage/mockStatsStore.js";
import { parseKill } from "./src/parsers/killParser.js";
import { formatKillfeedNotification } from "./src/features/killfeed/formatKillfeedNotification.js";
import {
  getPlayerStats,
  handlePlayerConnect,
  handlePlayerDisconnect,
  updateStatsFromEvent,
} from "./src/features/stats/playerStats.js";
import {
  runDiagnose,
  runDiscordHeatmapTest,
  runDiscordTest,
  runDiscordWeekendHeatmapTest,
  runMockParse,
} from "./src/cli/index.js";
import { listAdmNames, nitDownload, tsFromName } from "./src/api/nitradoClient.js";
import { checkEnv, runBot } from "./src/runtime/botRuntime.js";

const MODE = process.argv[2] || "run";
const checkCurrentModeEnv = (): void => checkEnv(MODE);

if (MODE === "discord-test") {
  runDiscordTest(config, checkCurrentModeEnv);
} else if (MODE === "discord-heatmap-test") {
  runDiscordHeatmapTest(config, checkCurrentModeEnv);
} else if (MODE === "discord-weekend-heatmap-test") {
  runDiscordWeekendHeatmapTest(config, checkCurrentModeEnv);
} else if (MODE === "diagnose") {
  runDiagnose(
    config,
    checkCurrentModeEnv,
    listAdmNames,
    tsFromName,
    tMadrid,
    nitDownload,
    parseKill
  );
} else if (MODE === "mock-parse") {
  runMockParse(
    parseKill,
    loadMockStats,
    saveMockStats,
    handlePlayerConnect,
    handlePlayerDisconnect,
    updateStatsFromEvent,
    getPlayerStats,
    formatKillfeedNotification
  );
} else {
  runBot();
}
