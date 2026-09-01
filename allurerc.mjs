import { defineConfig } from "allure";

export default defineConfig({
  name: "PlaywrightScripting Report",
  output: "./allure-report",
  plugins: {
    awesome: {
      options: {
        singleFile: true,
        reportLanguage: "en",
        // Don't auto-open a browser tab in CI. Run `npx allure open allure-report`
        // locally when you want to view it.
        open: false,
      },
    },
  },
});
