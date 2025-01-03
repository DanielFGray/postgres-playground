require("dotenv").config();

/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  env: {
    node: true,
    browser: true,
    commonjs: true,
    es6: true,
  },

  // Base config
  extends: ["eslint:recommended"],

  overrides: [
    // Typescript
    {
      files: ["**/*.{ts,tsx}"],
      plugins: ["@typescript-eslint"],
      parser: "@typescript-eslint/parser",
      extends: [
        "plugin:@typescript-eslint/recommended",
        // "plugin:import/recommended",
        // "plugin:import/typescript",
      ],
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    {
      files: ["./server/**/*.ts"],
      parser: "@typescript-eslint/parser",
      plugins: ["@typescript-eslint"],
    },
  ],
  rules: {
    "no-undef": "off",
    "no-unexpected-multiline": "error",
    "no-nested-ternary": "off",
    "no-unused-vars": "off",
    "no-else-return": "error",
    "arrow-parens": ["warn", "as-needed"],
    "object-curly-newline": "off",
    "valid-jsdoc": "warn",
    "@typescript-eslint/no-unused-vars": "off", // typescript does this anyway
    "@typescript-eslint/no-explicit-any": "warn",
  },
};
