/** Web-only ESLint config for Next 14 + ESLint 8 (Classic) */
module.exports = {
  root: true,
  extends: ["next/core-web-vitals"],
  env: { browser: true, es2022: true, node: false },
  ignorePatterns: ["node_modules/", ".next/", "dist/", "**/*.d.ts"],
  overrides: [
    {
      files: ["**/*.ts", "**/*.tsx"],
      parser: "@typescript-eslint/parser",
      plugins: ["@typescript-eslint"],
      extends: ["plugin:@typescript-eslint/recommended"]
    }
  ]
};
