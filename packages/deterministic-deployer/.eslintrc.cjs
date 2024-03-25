/* eslint-env node */

module.exports = {
  root: true,
  env: { browser: true, es2020: true, mocha: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:react-hooks/recommended',
    'airbnb',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: true,
    tsconfigRootDir: __dirname,
  },
  plugins: ['react-refresh', 'prettier', '@typescript-eslint', 'import'],
  rules: {
    'react-refresh/only-export-components': [
      'error',
      { allowConstantExport: true },
    ],
    '@typescript-eslint/no-non-null-assertion': 'off',
    'prettier/prettier': [
      'error',
      {
        bracketSpacing: true,
        bracketSameLine: false,
        printWidth: 80,
        semi: true,
        singleQuote: true,
        tabWidth: 2,
        trailingComma: 'all',
        useTabs: false,
        proseWrap: 'always',
      },
    ],
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
    'import/no-extraneous-dependencies': [
      'error',
      {
        devDependencies: [
          'demo/**/*.ts',
          'demo/**/*.tsx',
          'scripts/**/*.ts',
          'vite.config.ts',
          'hardhat/**/*.ts',
          'tests/**/*.*',
        ],
      },
    ],
    'react/react-in-jsx-scope': 'off',
    'react/jsx-filename-extension': 'off',
    'react/jsx-indent': 'off',
    'react/jsx-one-expression-per-line': 'off',
    'import/no-absolute-path': 'off',
    'no-useless-constructor': 'off',
    '@typescript-eslint/no-useless-constructor': 'error',
    'no-empty-function': 'off',
    'react/function-component-definition': [
      'error',
      {
        namedComponents: 'arrow-function',
        unnamedComponents: 'arrow-function',
      },
    ],
    'react/require-default-props': 'off',
    'react/jsx-props-no-spreading': 'off',
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
        allow: ['^[a-zA-Z0-9]+__factory$', '^eth_[a-zA-Z]+$'],
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
    'consistent-return': 'off',
    'no-plusplus': 'off',
    'no-bitwise': 'off',
  },
};
