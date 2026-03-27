import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const reactFiles = ["src/**/*.{tsx,jsx}"];
const typeScriptFiles = ["src/**/*.{ts,tsx}"];

function withoutReactPluginRules(config) {
  if (!config.rules) {
    return config;
  }

  const rules = Object.fromEntries(
    Object.entries(config.rules).filter(([ruleName]) => !ruleName.startsWith("react/")),
  );

  return {
    ...config,
    rules,
  };
}

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "tests/**",
      "eslint.config.mjs",
      "prisma/**",
      "postcss.config.mjs",
      "next.config.ts",
    ],
  },
  ...nextCoreWebVitals.map((config) => ({
    ...withoutReactPluginRules(config),
    files: reactFiles,
  })),
  ...nextTypescript.map((config) => ({
    ...config,
    files: typeScriptFiles,
  })),
];

export default eslintConfig;
