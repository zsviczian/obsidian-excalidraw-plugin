const { FlatCompat } = require("@eslint/eslintrc");

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const legacyConfig = require("./.eslintrc.json");

module.exports = (async () => {
  const { default: obsidianmd } = await import("eslint-plugin-obsidianmd");
  const tsRulesOffForJs = Object.fromEntries(
    [
      "@typescript-eslint/await-thenable",
      "@typescript-eslint/ban-ts-comment",
      "@typescript-eslint/no-array-constructor",
      "@typescript-eslint/no-array-delete",
      "@typescript-eslint/no-base-to-string",
      "@typescript-eslint/no-deprecated",
      "@typescript-eslint/no-duplicate-enum-values",
      "@typescript-eslint/no-duplicate-type-constituents",
      "@typescript-eslint/no-empty-object-type",
      "@typescript-eslint/no-explicit-any",
      "@typescript-eslint/no-extra-non-null-assertion",
      "@typescript-eslint/no-floating-promises",
      "@typescript-eslint/no-for-in-array",
      "@typescript-eslint/no-implied-eval",
      "@typescript-eslint/no-misused-new",
      "@typescript-eslint/no-misused-promises",
      "@typescript-eslint/no-namespace",
      "@typescript-eslint/no-non-null-asserted-optional-chain",
      "@typescript-eslint/no-redundant-type-constituents",
      "@typescript-eslint/no-require-imports",
      "@typescript-eslint/no-this-alias",
      "@typescript-eslint/no-unnecessary-type-assertion",
      "@typescript-eslint/no-unnecessary-type-constraint",
      "@typescript-eslint/no-unsafe-argument",
      "@typescript-eslint/no-unsafe-assignment",
      "@typescript-eslint/no-unsafe-call",
      "@typescript-eslint/no-unsafe-declaration-merging",
      "@typescript-eslint/no-unsafe-enum-comparison",
      "@typescript-eslint/no-unsafe-function-type",
      "@typescript-eslint/no-unsafe-member-access",
      "@typescript-eslint/no-unsafe-return",
      "@typescript-eslint/no-unsafe-unary-minus",
      "@typescript-eslint/no-unused-expressions",
      "@typescript-eslint/no-unused-vars",
      "@typescript-eslint/no-wrapper-object-types",
      "@typescript-eslint/only-throw-error",
      "@typescript-eslint/prefer-as-const",
      "@typescript-eslint/prefer-namespace-keyword",
      "@typescript-eslint/prefer-promise-reject-errors",
      "@typescript-eslint/require-await",
      "@typescript-eslint/restrict-plus-operands",
      "@typescript-eslint/restrict-template-expressions",
      "@typescript-eslint/triple-slash-reference",
      "@typescript-eslint/unbound-method",
    ].map((rule) => [rule, "off"]),
  );
  const obsidianTypedRulesOffForJs = {
    "obsidianmd/no-plugin-as-component": "off",
    "obsidianmd/no-view-references-in-plugin": "off",
    "obsidianmd/no-unsupported-api": "off",
    "obsidianmd/prefer-file-manager-trash-file": "off",
    "obsidianmd/prefer-instanceof": "off",
  };

  return [
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
    ...obsidianmd.configs.recommended,
    {
      files: ["**/*.{js,jsx}"],
      rules: {
        ...tsRulesOffForJs,
        ...obsidianTypedRulesOffForJs,
      },
    },
    {
      files: ["**/*.{ts,tsx}"],
      languageOptions: {
        parser: require("@typescript-eslint/parser"),
        parserOptions: {
          project: "./tsconfig.json",
          tsconfigRootDir: __dirname,
        },
      },
      rules: {
        "obsidianmd/prefer-instanceof": "off",
      },
    },
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
        "no-useless-escape": "error",
      },
    },
  ];
})();
