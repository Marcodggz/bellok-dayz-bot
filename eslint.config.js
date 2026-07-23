const js = require("@eslint/js");
const globals = require("globals");
const tseslint = require("typescript-eslint");
const prettierConfig = require("eslint-config-prettier");

const typescriptRecommended = tseslint.configs.recommended.map((config) => ({
  ...config,
  files: ["**/*.ts"],
}));

module.exports = [
  {
    ignores: ["node_modules/**", "dist/**", "coverage/**", "data/**", "images/**"],
  },

  js.configs.recommended,

  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        ...globals.node,
      },
    },
  },

  ...typescriptRecommended,

  {
    files: ["**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },

  {
    files: ["test/**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.vitest,
      },
    },
  },

  prettierConfig,
];
