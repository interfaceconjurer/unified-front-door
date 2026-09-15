import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: [
      "src/components/chat/**/*.{ts,tsx}",
      "src/components/front-door/**/*.{ts,tsx}",
      "src/components/onboarding/**/*.{ts,tsx}",
      "src/components/app-shell/WorkspacePanel.tsx",
      "src/lib/chat/planning.ts",
    ],
    rules: {
      // Limit typography checks to UI copy; parsers still accept ASCII input.
      "no-restricted-syntax": [
        "error",
        ...[
          "Literal[value=/[A-Za-z]'[A-Za-z]/]",
          "TemplateElement[value.raw=/[A-Za-z]'[A-Za-z]/]",
          "JSXText[value=/[A-Za-z]'[A-Za-z]/]",
        ].map((selector) => ({ selector, message: "Use a curly apostrophe (’) in user-facing copy." })),
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
