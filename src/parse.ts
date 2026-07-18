import csv from "csv-parser";
import fs from "fs";
import { AssigneeMap, Project, Task } from "./types";

export async function parseTsv(
  inputPath: string,
  assigneeMap: AssigneeMap = {},
): Promise<Project> {
  const repoMap: Record<string, Task[]> = {};

  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(inputPath)
      .pipe(csv({ separator: "\t" }))
      .on("data", (row: Record<string, string>) => {
        const match = row.URL?.match(/github\.com\/([^/]+\/[^/]+)/);
        const repo = match ? match[1] : "Unknown";

        const task: Task = {
          title: row.Title || "",
          url: row.URL || "",
          assignee: mapAssignees(row.Assignees || "", assigneeMap),
          status: row.Status || "Todo",
          startDate: parseDate(row["Start Date"]),
          endDate: parseDate(row["Target Date"]),
        };

        if (!repoMap[repo]) {
          repoMap[repo] = [];
        }
        repoMap[repo].push(task);
      })
      .on("end", resolve)
      .on("error", reject);
  });

  const repos = Object.entries(repoMap)
    .map(([name, tasks]) => ({
      name,
      tasks: tasks.sort(
        (a, b) => getDateSortValue(a.startDate) - getDateSortValue(b.startDate),
      ),
    }))
    .sort((a, b) => {
      const aStart = a.tasks[0]?.startDate
        ? getDateSortValue(a.tasks[0].startDate)
        : Number.POSITIVE_INFINITY;
      const bStart = b.tasks[0]?.startDate
        ? getDateSortValue(b.tasks[0].startDate)
        : Number.POSITIVE_INFINITY;
      return aStart - bStart;
    });
  const allTasks = Object.values(repoMap).flat();

  const allStartDates = allTasks
    .map((t) => t.startDate)
    .filter((d) => !isNaN(d.getTime()));
  const allEndDates = allTasks
    .map((t) => t.endDate)
    .filter((d) => !isNaN(d.getTime()));

  const startDate =
    allStartDates.length > 0
      ? new Date(Math.min(...allStartDates.map((d) => d.getTime())))
      : new Date();
  const endDate =
    allEndDates.length > 0
      ? new Date(Math.max(...allEndDates.map((d) => d.getTime())))
      : new Date();

  // Calculate totalDays as the inclusive difference in days between projectEnd and projectStart.
  let totalDays =
    Math.ceil((+endDate - +startDate) / (1000 * 60 * 60 * 24)) + 1;
  // Extend totalDays so that it becomes a multiple of 7.
  if (totalDays % 7 !== 0) {
    totalDays += 7 - (totalDays % 7);
  }

  return { startDate, endDate, totalDays, repos };
}

function parseDate(dateString: string): Date {
  const trimmedDateString = dateString.trim();
  if (!trimmedDateString) {
    return new Date(NaN);
  }

  const isoMatch = trimmedDateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, yearStr, monthStr, dayStr] = isoMatch;
    return new Date(
      Date.UTC(
        parseInt(yearStr, 10),
        parseInt(monthStr, 10) - 1,
        parseInt(dayStr, 10),
      ),
    );
  }

  const [month, dayStr, yearStr] = trimmedDateString
    .replace(",", "")
    .split(" ");
  if (!month || !dayStr || !yearStr) {
    return new Date(NaN);
  }
  const day = parseInt(dayStr, 10);
  const year = parseInt(yearStr, 10);

  const monthMap: Record<string, number> = {
    Jan: 0,
    Feb: 1,
    Mar: 2,
    Apr: 3,
    May: 4,
    Jun: 5,
    Jul: 6,
    Aug: 7,
    Sep: 8,
    Oct: 9,
    Nov: 10,
    Dec: 11,
  };

  const monthIndex = monthMap[month];
  if (monthIndex === undefined) {
    return new Date(NaN);
  }

  return new Date(Date.UTC(year, monthIndex, day));
}

function getDateSortValue(date: Date): number {
  const time = date.getTime();
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

function mapAssignees(assignees: string, assigneeMap: AssigneeMap): string {
  return assignees
    .split(",")
    .map((assignee) => assignee.trim())
    .filter(Boolean)
    .map((assignee) => assigneeMap[assignee] ?? assignee)
    .join(", ");
}
