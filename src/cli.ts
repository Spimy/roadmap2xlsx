#!/usr/bin/env node

import { Command } from "commander";
import fs from "fs";
import { parseTsv } from "./parse";
import { generateRoadmap } from "./roadmap";
import { AssigneeMap } from "./types";

export async function main(): Promise<void> {
  const program = new Command();

  program
    .option("--input <path>", "Path to the input TSV file")
    .option("--output <path>", "Path to the output XLSX file")
    .option(
      "--assignee-map <json-or-path>",
      "Map usernames to display names using inline JSON or a JSON file",
    )
    .parse(process.argv);

  const options = program.opts();

  if (!options.input || !options.output) {
    console.error("Error: --input and --output options are required.");
    process.exit(1);
  }

  try {
    const assigneeMap = loadAssigneeMap(options.assigneeMap);
    const project = await parseTsv(options.input, assigneeMap);
    await generateRoadmap(project, options.output);
    console.log(`Roadmap successfully saved to ${options.output}`);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

function loadAssigneeMap(value: string | undefined): AssigneeMap {
  if (!value) {
    return {};
  }

  const trimmedValue = value.trim();
  const isFile =
    fs.existsSync(trimmedValue) && fs.statSync(trimmedValue).isFile();
  const jsonText = isFile
    ? fs.readFileSync(trimmedValue, "utf8")
    : trimmedValue;

  let parsedValue: unknown;
  try {
    parsedValue = JSON.parse(jsonText);
  } catch (error) {
    const sourceDescription = isFile ? `file ${trimmedValue}` : "inline JSON";
    throw new Error(`Invalid assignee map from ${sourceDescription}: ${error}`);
  }

  if (
    !parsedValue ||
    typeof parsedValue !== "object" ||
    Array.isArray(parsedValue)
  ) {
    throw new Error(
      "Assignee map must be a JSON object of username-to-name pairs.",
    );
  }

  return Object.fromEntries(
    Object.entries(parsedValue).map(([username, displayName]) => [
      username,
      String(displayName),
    ]),
  );
}
