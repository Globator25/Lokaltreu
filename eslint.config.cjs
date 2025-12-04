const js = require("@eslint/js");
const tseslint = require("typescript-eslint");
const reactPlugin = require("eslint-plugin-react");
const reactHooksPlugin = require("eslint-plugin-react-hooks");
const jsxA11yPlugin = require("eslint-plugin-jsx-a11y");
const importPlugin = require("eslint-plugin-import");
const nextPlugin = require("@next/eslint-plugin-next");
const globals = require("globals");

const tsconfigRootDir = __dirname;
const nextCoreWebVitals = nextPlugin.configs["core-web-vitals"];

const typeAwareRules = {
  "@typescript-eslint/no-floating-promises": "error",
  "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: false }],
};

module.exports = [
  // Globale Ignore-Regeln
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/coverage/**",
      "**/test-results/**",
      "artifacts/**",
      "packages/**/dist/**",
    ],
  },

  // Basis-JS-Empfehlungen von @eslint/js (Flat Config kompatibel)
  js.configs.recommended,

  // Generische TS-Regeln (type-unaware)
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        project: false,
        tsconfigRootDir,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      import: importPlugin,
    },
    settings: {
      "import/resolver": {
        typescript: {
          project: [
            "./tsconfig.base.json",
            "./apps/api/tsconfig.json",
            "./apps/web/tsconfig.json",
            "./packages/types/tsconfig.json",
          ],
        },
      },
    },
       rules: {
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", disallowTypeAnnotations: false },
      ],
      "import/order": [
        "warn",
        {
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
          groups: [
            "builtin",
            "external",
            "internal",
            ["parent", "sibling", "index"],
            "object",
            "type",
          ],
        },
      ],
      "no-console": ["warn", { allow: ["warn", "error"] }],

      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/no-misused-promises": "off",
    },
    },
  // Type-aware Regeln für apps/api (Node-Umgebung)
  {
  files: ["apps/api/**/*.{ts,tsx}", "src/**/*.{ts,tsx}"],
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: {
      project: "./apps/api/tsconfig.json",
      tsconfigRootDir,
    },
    globals: {
      ...globals.node,
      // Node 18+ bietet globales fetch, hier explizit für ESLint hinterlegt
      fetch: "readonly",
    },
  },
  plugins: {
    "@typescript-eslint": tseslint.plugin,
  },
  rules: {
    ...typeAwareRules,
  },
},

  // Type-aware Regeln für packages/types (Node-Umgebung)
  {
    files: ["packages/types/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: "./packages/types/tsconfig.json",
        tsconfigRootDir,
      },
      globals: globals.node,
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      ...typeAwareRules,
    },
  },

  // Web-Frontend (Next.js, React, Browser-Globals)
  {
  files: ["apps/web/**/*.{ts,tsx,js,jsx}", "src/app/**/*.{ts,tsx,js,jsx}"],
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: {
      // Für das Web-Frontend vorerst kein type-aware Linting
      project: false,
      tsconfigRootDir,
      ecmaFeatures: { jsx: true },
    },
    globals: {
      ...globals.browser,
      JSX: "readonly",
    },
  },
  plugins: {
    "@typescript-eslint": tseslint.plugin,
    "@next/next": nextPlugin,
    react: reactPlugin,
    "react-hooks": reactHooksPlugin,
    "jsx-a11y": jsxA11yPlugin,
  },
  settings: {
    react: { version: "detect" },
  },
  rules: {
    // Keine typeAwareRules hier – die nutzen wir für API/Types
    ...nextCoreWebVitals.rules,
    ...reactPlugin.configs.recommended.rules,
    ...jsxA11yPlugin.configs.recommended.rules,
    ...reactHooksPlugin.configs.recommended.rules,
    "react/react-in-jsx-scope": "off",
    "react/jsx-uses-react": "off",
    "react/prop-types": "off",

    // zur Sicherheit explizit aus:
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/no-misused-promises": "off",
  },
},

  // Config- und Script-Dateien (Node-Umgebung)
  {
    files: ["**/*.config.{js,cjs,mjs,ts}", "scripts/**/*.{js,ts}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.base.json",
        tsconfigRootDir,
      },
      globals: globals.node,
    },
    rules: {
      "@typescript-eslint/no-var-requires": "off",
    },
  },
];
