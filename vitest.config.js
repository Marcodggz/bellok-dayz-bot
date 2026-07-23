const { defineConfig } = require("vitest/config");

module.exports = defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**/*.js"],
      exclude: [],
      reporter: ["text", "html"],
    },
  },
});
