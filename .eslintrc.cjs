require('dotenv').config()

/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
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
    // React
    {
      files: ["**/*.{js,ts,jsx,tsx}"],
      plugins: ["react", "jsx-a11y"],
      extends: [
        "plugin:react/recommended",
        "plugin:react/jsx-runtime",
        "plugin:react-hooks/recommended",
        "plugin:jsx-a11y/recommended",
      ],
      settings: {
        react: {
          version: "detect",
        },
        formComponents: ["Form"],
        linkComponents: [
          { name: "Link", linkAttribute: "to" },
          { name: "NavLink", linkAttribute: "to" },
        ],
        // "import/resolver": {
        //   typescript: {},
        // },
      },
    },

    // Typescript
    {
      files: ["**/*.{ts,tsx}"],
      plugins: ["@typescript-eslint"],
      parser: "@typescript-eslint/parser",
      // settings: {
      //   "import/internal-regex": "^~/",
      //   "import/resolver": {
      //     node: {
      //       extensions: [".ts", ".tsx"],
      //     },
      //     typescript: {
      //       alwaysTryTypes: true,
      //     },
      //   },
      // },
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
      plugins: ["@typescript-eslint", "@ts-safeql/eslint-plugin"],
    },
  ],
  rules: {
    "no-undef": "off",
    "no-unexpected-multiline": "error",
    "no-nested-ternary": "off",
    "no-unused-vars": "off",
    "arrow-parens": ["warn", "as-needed"],
    "object-curly-newline": "off",
    "valid-jsdoc": "warn",
    "react/jsx-filename-extension": ["error", { extensions: [".tsx"] }],
    "react/prop-types": "off",
    "react/react-in-jsx-scope": "off",
    "@typescript-eslint/no-unused-vars": "off", // typescript does this anyway
    "@typescript-eslint/no-explicit-any": "warn",
    "@ts-safeql/check-sql": [
      "error",
      {
        connections: [
          {
            databaseUrl: process.env.DATABASE_URL,
            targets: [
              {
                tag: "sql",
                transform: "{type}[]",
              },
            ],
          },
        ],
      },
    ],
  },
};
