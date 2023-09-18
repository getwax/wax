/* eslint-env node */

module.exports = {
  root: true,
  env: { node: true, es2020: true, mocha: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'airbnb',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: true,
    tsconfigRootDir: __dirname,
  },
  plugins: ['prettier', '@typescript-eslint', 'import'],
  settings: {
    react: {
      version: "detect",
    },
  },
  rules: {
    'prettier/prettier': [
      'error',
      {
        bracketSpacing: true,
        bracketSameLine: false,
        printWidth: 80,
        semi: true,
        singleQuote: false,
        tabWidth: 2,
        trailingComma: 'all',
        useTabs: false,
        proseWrap: 'always',
      },
    ],
    'quotes': ['error', 'double'],
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        varsIgnorePattern: '^_',
        argsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
    'import/extensions': 'off',
    'import/no-unresolved': 'off',
    'import/no-extraneous-dependencies': 'off',
    'import/no-absolute-path': 'off',
    'no-useless-constructor': 'off',
    '@typescript-eslint/no-useless-constructor': 'error',
    'no-empty-function': 'off',
    'object-curly-newline': 'off',
    'no-return-await': 'off',
    'max-classes-per-file': 'off',
    'lines-between-class-members': [
      'error',
      'always',
      {
        exceptAfterSingleLine: true,
      },
    ],
    'no-use-before-define': 'off',
    'no-redeclare': 'off',
    'brace-style': 'off',
    'no-restricted-syntax': 'off',
    'operator-linebreak': 'off',

    // Found false positive with these. Maybe the typescript used for linting is
    // out of date.
    '@typescript-eslint/no-unsafe-call': 'off',
    '@typescript-eslint/no-unsafe-member-access': 'off',

    'no-shadow': 'off',
    '@typescript-eslint/no-shadow': 'error',

    camelcase: [
      'error',
      {
        allow: ['^[a-zA-Z]+__factory$', '^eth_[a-zA-Z]+$'],
      },
    ],

    'implicit-arrow-linebreak': 'off',
    'function-paren-newline': 'off',
    'react/jsx-wrap-multilines': 'off',
    'no-void': 'off',
    'react/jsx-curly-newline': 'off',
    'no-await-in-loop': 'off',
    'no-continue': 'off',
    'no-constant-condition': 'off',
    'no-underscore-dangle': 'off',
  },
};
