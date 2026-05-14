const { FlatCompat } = require("@eslint/eslintrc");

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const legacyConfig = require("./.eslintrc.json");

module.exports = [
  {
    ignores: [
      "lib/**",
      "dist/**",
      "node_modules/**",
      ".github/**",
      "MathjaxToSVG/**",
      "docs/**",
      "ea-scripts/**",
      "images/**",
      "test-data/**",
    ],
  },
  ...compat.config(legacyConfig),
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "after-used",
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
];