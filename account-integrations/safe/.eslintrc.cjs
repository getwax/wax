module.exports = {
  env: {
    node: true,
    es2021: true,
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    tsconfigRootDir: __dirname,
  },
  plugins: ["prettier", "@typescript-eslint", "import"],
  extends: "xo-typescript",
  overrides: [
    {
      env: {
        node: true,
      },
      files: [".eslintrc.{js,cjs}"],
      parserOptions: {
        sourceType: "script",
      },
    },
  ],
  rules: {
    indent: "off",
    "@typescript-eslint/indent": "off",
    "prettier/prettier": [
      "error",
      {
        bracketSpacing: true,
        bracketSameLine: false,
        printWidth: 80,
        semi: true,
        singleQuote: false,
        tabWidth: 2,
        trailingComma: "all",
        useTabs: false,
        proseWrap: "always",
      },
    ],
    quotes: ["error", "double"],
    "@typescript-eslint/quotes": "off",
    "@typescript-eslint/naming-convention": [
      "error",
      {
        selector: "variable",
        format: ["camelCase", "UPPER_CASE"],
        leadingUnderscore: "allow",
        trailingUnderscore: "allow",
      },
      {
        selector: "typeLike",
        format: ["PascalCase"],
      },
    ],
    "@typescript-eslint/object-curly-spacing": ["error", "always"],
    "@typescript-eslint/consistent-type-imports": "off",
    "@typescript-eslint/padding-line-between-statements": "off",
    "@typescript-eslint/prefer-regexp-exec": "off",
    "@typescript-eslint/ban-types": [
      "error",
      { types: { null: false, "[]": false } },
    ],
    "@typescript-eslint/member-ordering": "off",
    "@typescript-eslint/return-await": "off",
    "no-constant-condition": "off",
  },
};
