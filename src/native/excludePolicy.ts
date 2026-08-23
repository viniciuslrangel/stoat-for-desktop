import { app } from "electron";

import { config } from "./config";
import { findProcessesByImageName } from "./processLoopback";

export type ExcludePolicy = { excludePids: number[]; labels: string[] };
export type ExcludePolicyOptions = { excludeDiscord?: boolean };

export function buildExcludePolicy(
  options: ExcludePolicyOptions = {},
): ExcludePolicy {
  const excludePids = new Set<number>();
  const labels: string[] = [];

  for (const metric of app.getAppMetrics()) {
    if (Number.isInteger(metric.pid) && metric.pid > 0) {
      excludePids.add(metric.pid);
    }
  }
  if (excludePids.size > 0) {
    labels.push("stoat");
  }

  const excludeDiscord =
    options.excludeDiscord ?? config.excludeDiscordFromScreenShareAudio;
  if (excludeDiscord) {
    let foundDiscord = false;
    for (const imageName of ["Discord.exe", "discord.exe"]) {
      try {
        for (const pid of findProcessesByImageName(imageName)) {
          if (Number.isInteger(pid) && pid > 0) {
            excludePids.add(pid);
            foundDiscord = true;
          }
        }
      } catch (error) {
        console.warn("[screenshare:audio] Discord process lookup failed", {
          imageName,
          error,
        });
      }
    }
    if (foundDiscord) {
      labels.push("discord");
    }
  }

  const policy = { excludePids: [...excludePids], labels };
  console.info("[screenshare:audio] exclude policy", policy);
  return policy;
}
