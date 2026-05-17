import { ESLint } from "eslint";

(async function main() {
  const eslint = new ESLint({ 
    // This predicate instructs ESLint to only apply 
    // automated fixes if the rule's severity matches a warning (1).
    // Errors (2) will be scanned but left untouched.
    fix: (message) => message.severity === 1 
  });

  console.log("Analyzing project files...");
  
  // ESLint v9 automatically targets the correct extensions 
  // configured in your eslint.config.js file
  const results = await eslint.lintFiles(["./src"]);

  console.log("Applying fixes to warning-level rules...");
  await ESLint.outputFixes(results);

  console.log("Done! Only warning-level fixes were applied.");
})();
