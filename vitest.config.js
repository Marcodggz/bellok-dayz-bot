const { defineConfig } = require("vitest/config");

module.exports = defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**/*.{js,ts}"],
      exclude: [],
      reporter: ["text", "html"],
    },
  },
});
