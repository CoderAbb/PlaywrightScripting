import fs from "node:fs";
import path from "node:path";

const REPORT_DIR = "reports";

export function saveIntelligence(data) {
  fs.mkdirSync(REPORT_DIR, {
    recursive: true
  });

  const output = path.join(
    REPORT_DIR,
    "intelligence.json"
  );

  fs.writeFileSync(
    output,
    JSON.stringify(data, null, 2)
  );

  console.log(`Intelligence report: ${output}`);
}