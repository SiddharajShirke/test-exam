const js = require("@eslint/js");
const tseslint = require("@typescript-eslint/eslint-plugin");
const tsParser = require("@typescript-eslint/parser");

module.exports = [
  js.configs.recommended,
  {
    files: ["src/**/*.ts", "test/**/*.ts"],
    plugins: {
      "@typescript-eslint": tseslint,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
      },
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        exports: "writable",
        module: "readonly",
        require: "readonly",
      },
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/db/pool", "**/db/pool.*"],
              message: "Only files in src/repositories/** and src/migrations/** may import the SQL pool.",
            },
          ],
        },
      ],
    },
  },
  {
    // Allow repositories and migrations to import pool
    files: ["src/repositories/**/*.ts", "src/migrations/**/*.ts"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**", "test/fixtures/**"],
  },
];
