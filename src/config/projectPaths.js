// Resolve project resources consistently from source and compiled code

const fs = require("node:fs");
const path = require("node:path");

function findProjectRoot(startDirectory = __dirname) {
  let currentDirectory = path.resolve(startDirectory);

  while (true) {
    if (fs.existsSync(path.join(currentDirectory, "package.json"))) {
      return currentDirectory;
    }

    const parentDirectory = path.dirname(currentDirectory);

    if (parentDirectory === currentDirectory) {
      throw new Error(`Could not find project root from: ${startDirectory}`);
    }

    currentDirectory = parentDirectory;
  }
}

const PROJECT_ROOT = findProjectRoot();

function resolveProjectPath(...segments) {
  return path.join(PROJECT_ROOT, ...segments);
}

module.exports = {
  PROJECT_ROOT,
  findProjectRoot,
  resolveProjectPath,
};
