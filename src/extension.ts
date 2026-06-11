import * as cp from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";

type DayPoint = {
  date: string;
  count: number;
};

type NamedMetric = {
  name: string;
  value: string;
  detail?: string;
};

type ShareCardPayload = {
  fileName: string;
  dataUrl: string;
  copiedToClipboard?: boolean;
  copiedTextFallback?: boolean;
};

type ProfileData = {
  displayName: string;
  username: string;
  accountLabel: string;
  accountDetail: string;
  planLabel: string;
  leaderboardUrl: string;
  leaderboardPublic: boolean;
  initials: string;
  kiroOpens30d: string;
  localSessions: string;
  localSessionsRaw: number;
  totalTokens: string;
  totalTokensRaw: number;
  peakTokens: string;
  totalCredits: string;
  totalCreditsRaw: number;
  currentStreak: string;
  currentStreakRaw: number;
  longestStreak: string;
  longestStreakRaw: number;
  activeDays: string;
  activeDaysRaw: number;
  heatmap: DayPoint[];
  availableYears: number[];
  insights: NamedMetric[];
  topItems: NamedMetric[];
  modelItems: NamedMetric[];
  // New sections
  sessionStats: NamedMetric[];
  tokenStats: NamedMetric[];
  activityPatterns: NamedMetric[];
  toolStats: NamedMetric[];
  systemStats: NamedMetric[];
  dataSources: NamedMetric[];
};

type KiroUsage = {
  days: string[];
  opensLast30Days: number;
  sessionCount: number;
  hookCount: number;
  powerCount: number;
  extensionCount: number;
  largestSessionBytes: number;
  totalTokens: number;
  peakDayTokens: number;
  totalCredits: number;
  averageTurnMinutes: number;
  modelCounts: Map<string, number>;
  tokenCountsByDay: Map<string, number>;
  // New stats
  totalTurns: number;
  failedTurns: number;
  toolUsageCounts: Map<string, number>;
  hourlyActivity: Map<number, number>;
  sessionDurations: number[];
  promptTokens: number;
  generatedTokens: number;
  contextWindowUsage: number[];
  subAgentInvocations: number;
  errorCount: number;
  warningCount: number;
  cliSessionCount: number;
  ideSessionCount: number;
  tokenLogRows: number;
  logDirCount: number;
};

type LocalKiroAccount = {
  accountLabel: string;
  accountDetail: string;
  displayName?: string;
  accountSource: string;
  planLabel?: string;
  planSource: string;
};

const IGNORE_DIRS = new Set([
  ".git",
  ".vscode",
  "node_modules",
  "out",
  "dist",
  "build",
  ".next",
  ".svelte-kit",
  "coverage"
]);

const LANGUAGE_BY_EXTENSION = new Map<string, string>([
  [".ts", "TypeScript"],
  [".tsx", "TypeScript"],
  [".js", "JavaScript"],
  [".jsx", "JavaScript"],
  [".mjs", "JavaScript"],
  [".cjs", "JavaScript"],
  [".py", "Python"],
  [".java", "Java"],
  [".go", "Go"],
  [".rs", "Rust"],
  [".cs", "C#"],
  [".cpp", "C++"],
  [".cc", "C++"],
  [".c", "C"],
  [".h", "C/C++"],
  [".php", "PHP"],
  [".rb", "Ruby"],
  [".swift", "Swift"],
  [".kt", "Kotlin"],
  [".kts", "Kotlin"],
  [".dart", "Dart"],
  [".html", "HTML"],
  [".css", "CSS"],
  [".scss", "CSS"],
  [".json", "JSON"],
  [".md", "Markdown"],
  [".yml", "YAML"],
  [".yaml", "YAML"]
]);

export function activate(context: vscode.ExtensionContext) {
  const provider = new ProfileViewProvider(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ProfileViewProvider.viewType, provider, {
      webviewOptions: {
        retainContextWhenHidden: true
      }
    }),
    vscode.commands.registerCommand("kiroStat.openProfile", async () => {
      await vscode.commands.executeCommand("workbench.view.extension.kiroStat");
    }),
    vscode.commands.registerCommand("kiroStat.refresh", async () => {
      await provider.refresh();
    })
  );
}

export function deactivate() {}

class ProfileViewProvider implements vscode.WebviewViewProvider {
  static readonly viewType = "kiroStat.profile";

  private view?: vscode.WebviewView;
  private didRender = false;

  constructor(private readonly context: vscode.ExtensionContext) {}

  async resolveWebviewView(webviewView: vscode.WebviewView) {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true
    };

    webviewView.webview.onDidReceiveMessage(async (message) => {
      if (message?.type === "refresh") {
        await this.refresh();
      }
      if (message?.type === "share-card") {
        await this.saveShareCard(message.payload as ShareCardPayload);
      }
      if (message?.type === "open-leaderboard") {
        await this.openLeaderboard(message.url);
      }
      if (message?.type === "set-leaderboard-public") {
        await this.setLeaderboardPublic(Boolean(message.enabled));
      }
    });

    await this.refresh();
  }

  async refresh() {
    if (!this.view) {
      return;
    }

    const data = await collectProfileData(this.context);
    if (data.leaderboardPublic) {
      await this.publishLeaderboardProfile(data, { force: false, silent: true });
    }
    if (!this.didRender) {
      this.view.webview.html = getProfileHtml(this.view.webview, this.context.extensionUri, data);
      this.didRender = true;
      return;
    }

    await this.view.webview.postMessage({ type: "profile-data", data });
  }

  private async saveShareCard(payload: ShareCardPayload) {
    if (!payload?.dataUrl?.startsWith("data:image/png;base64,")) {
      void vscode.window.showWarningMessage("Kiro Stat could not create the share card image.");
      return;
    }

    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const baseDir = workspacePath || os.homedir();
    const outputDir = path.join(baseDir, "kiro-profile-shares");
    await fs.mkdir(outputDir, { recursive: true });

    const safeName = payload.fileName.replace(/[^a-z0-9_.-]/gi, "-").toLowerCase();
    const outputPath = path.join(outputDir, safeName || "kiro-profile.png");
    const base64 = payload.dataUrl.replace(/^data:image\/png;base64,/, "");
    await fs.writeFile(outputPath, Buffer.from(base64, "base64"));

    const clipboardText = payload.copiedToClipboard
      ? "Copied profile card to clipboard"
      : payload.copiedTextFallback
        ? "Copied profile summary text to clipboard"
        : "Clipboard copy was not available";
    void vscode.window.showInformationMessage(`${clipboardText}. Saved PNG: ${outputPath}`);
  }

  private async openLeaderboard(rawUrl: unknown) {
    if (typeof rawUrl !== "string") {
      void vscode.window.showWarningMessage("Kiro Stat could not open the leaderboard URL.");
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      void vscode.window.showWarningMessage("Kiro Stat leaderboard URL is not valid.");
      return;
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      void vscode.window.showWarningMessage("Kiro Stat leaderboard URL must start with http or https.");
      return;
    }

    await vscode.env.openExternal(vscode.Uri.parse(parsed.toString()));
  }

  private async setLeaderboardPublic(enabled: boolean) {
    const wasPublic = this.context.globalState.get<boolean>("leaderboardPublic", false);
    await this.context.globalState.update("leaderboardPublic", enabled);
    const data = await collectProfileData(this.context);

    if (enabled) {
      await this.publishLeaderboardProfile(data, { force: true, silent: false });
    } else if (wasPublic) {
      await this.unpublishLeaderboardProfile(data, { silent: false });
    }

    await this.refresh();
  }

  private async publishLeaderboardProfile(data: ProfileData, options: { force: boolean; silent: boolean }) {
    const endpoint = getLeaderboardApiUrl(data.leaderboardUrl);
    const publicId = await getOrCreatePublicProfileId(this.context);
    const snapshotHash = getLeaderboardSnapshotHash(data);
    const lastHash = this.context.globalState.get<string>("leaderboardLastSnapshotHash");
    const lastSyncedAt = this.context.globalState.get<number>("leaderboardLastSyncedAt", 0);
    const syncIntervalMs = 24 * 60 * 60 * 1000;
    const shouldSync = options.force || snapshotHash !== lastHash || Date.now() - lastSyncedAt >= syncIntervalMs;

    if (!shouldSync) {
      return;
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicId,
          displayName: data.displayName,
          handle: data.accountLabel || data.username,
          tokensUsed: data.totalTokensRaw,
          creditsUsed: data.totalCreditsRaw,
          currentStreak: data.currentStreakRaw,
          longestStreak: data.longestStreakRaw,
          sessions: data.localSessionsRaw,
          activeDays: data.activeDaysRaw
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      await this.context.globalState.update("leaderboardLastSnapshotHash", snapshotHash);
      await this.context.globalState.update("leaderboardLastSyncedAt", Date.now());

      if (!options.silent) {
        void vscode.window.showInformationMessage("Kiro Stat is public and synced to the leaderboard.");
      }
    } catch (error) {
      if (!options.silent) {
        void vscode.window.showWarningMessage(`Kiro Stat could not sync to the leaderboard: ${String(error)}`);
      }
    }
  }

  private async unpublishLeaderboardProfile(data: ProfileData, options: { silent: boolean }) {
    const publicId = this.context.globalState.get<string>("leaderboardPublicId");
    if (!publicId) {
      return;
    }

    try {
      const response = await fetch(getLeaderboardApiUrl(data.leaderboardUrl), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicId })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      await this.context.globalState.update("leaderboardLastSnapshotHash", undefined);
      await this.context.globalState.update("leaderboardLastSyncedAt", undefined);

      if (!options.silent) {
        void vscode.window.showInformationMessage("Kiro Stat is private and removed from the leaderboard.");
      }
    } catch (error) {
      if (!options.silent) {
        void vscode.window.showWarningMessage(`Kiro Stat could not remove the public leaderboard entry: ${String(error)}`);
      }
    }
  }
}

function getLeaderboardApiUrl(rawUrl: string): string {
  const url = new URL(rawUrl || "http://localhost:3000");
  url.pathname = `${url.pathname.replace(/\/$/, "")}/api/leaderboard`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

function getLeaderboardSnapshotHash(data: ProfileData): string {
  return JSON.stringify({
    leaderboardUrl: data.leaderboardUrl,
    displayName: data.displayName,
    handle: data.accountLabel || data.username,
    tokensUsed: data.totalTokensRaw,
    creditsUsed: data.totalCreditsRaw,
    currentStreak: data.currentStreakRaw,
    longestStreak: data.longestStreakRaw,
    sessions: data.localSessionsRaw,
    activeDays: data.activeDaysRaw
  });
}

async function getOrCreatePublicProfileId(context: vscode.ExtensionContext): Promise<string> {
  const existing = context.globalState.get<string>("leaderboardPublicId");
  if (existing) {
    return existing;
  }

  const nextId = crypto.randomUUID();
  await context.globalState.update("leaderboardPublicId", nextId);
  return nextId;
}

async function collectProfileData(context: vscode.ExtensionContext): Promise<ProfileData> {
  const config = vscode.workspace.getConfiguration("kiroStat");
  const username = config.get<string>("username") || "kiro-builder";
  const configuredPlanLabel = config.get<string>("planLabel") || "Local";
  const leaderboardUrl = config.get<string>("leaderboardUrl") || "https://kiro-profile-leaderboard-brown.vercel.app";
  const leaderboardPublic = context.globalState.get<boolean>("leaderboardPublic", false);
  const appRoots = getKiroAppDataRoots(os.homedir());
  const localAccount = await readLocalKiroAccount(appRoots);
  const accountLabel = localAccount?.accountLabel || username;
  const displayName = localAccount?.displayName || accountLabel || config.get<string>("displayName") || "Kiro Developer";
  const accountDetail = localAccount?.accountDetail || `@${username}`;
  const planLabel = localAccount?.planLabel || configuredPlanLabel;
  const accountSource = localAccount?.accountSource || "Settings fallback";
  const planSource = localAccount?.planLabel ? localAccount.planSource : "Settings fallback";
  const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const [gitDays, kiroUsage] = await Promise.all([
    workspacePath ? getGitActivityDays(workspacePath) : Promise.resolve([]),
    getKiroUsage()
  ]);
  const fileStats = workspacePath ? await getWorkspaceFileStats(workspacePath) : new Map<string, number>();
  const tokenCountsByDay = new Map(kiroUsage.tokenCountsByDay);
  
  // Only add git commit tokens if we don't already have token data for that day
  for (const day of gitDays) {
    const existingTokens = tokenCountsByDay.get(day) || 0;
    if (existingTokens === 0) {
      // Only add estimated tokens for git days without actual session data
      tokenCountsByDay.set(day, 800); // Lower estimate for git-only days
    }
  }
  
  const heatmap = buildHeatmapFromCounts(tokenCountsByDay, [...gitDays, ...kiroUsage.days]);
  const availableYears = getAvailableYears(heatmap);
  const activeCounts = heatmap.filter((day) => day.count > 0);
  const currentStreak = getCurrentStreak(heatmap);
  const longestStreak = getLongestStreak(heatmap);
  const topLanguages = [...fileStats.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const topModels = [...kiroUsage.modelCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  const topItems = topLanguages.length > 0
    ? topLanguages.map(([name, count]) => ({ name, value: `${count} files` }))
    : [{ name: "No code files yet", value: "0 files" }];
  const modelItems = topModels.length > 0
    ? topModels.map(([name, count]) => ({ name: formatModelName(name), value: `${count} sessions` }))
    : [{ name: "Auto", value: "Detected from Kiro" }];

  const topTools = [...kiroUsage.toolUsageCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const mostActiveHour = [...kiroUsage.hourlyActivity.entries()]
    .sort((a, b) => b[1] - a[1])[0];
  const avgSessionDuration = kiroUsage.sessionDurations.length > 0
    ? kiroUsage.sessionDurations.reduce((sum, d) => sum + d, 0) / kiroUsage.sessionDurations.length
    : 0;
  const successRate = kiroUsage.totalTurns > 0
    ? ((kiroUsage.totalTurns - kiroUsage.failedTurns) / kiroUsage.totalTurns * 100)
    : 100;
  const currentStreakLabel = `${currentStreak} days`;
  const longestStreakLabel = `${longestStreak} days`;
  const totalLanguageFiles = sumValues(fileStats);
  const totalModelSessions = sumValues(kiroUsage.modelCounts);
  const topModel = topModels[0];
  const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const weekdayTotals = new Array<number>(7).fill(0);
  let weekendTokens = 0;
  let totalHeatmapTokens = 0;
  for (const point of activeCounts) {
    const dow = new Date(`${point.date}T00:00:00`).getDay();
    weekdayTotals[dow] += point.count;
    totalHeatmapTokens += point.count;
    if (dow === 0 || dow === 6) {
      weekendTokens += point.count;
    }
  }
  const busiestWeekdayIndex = weekdayTotals.indexOf(Math.max(...weekdayTotals));
  const busiestWeekday = totalHeatmapTokens > 0 ? weekdayNames[busiestWeekdayIndex] : "N/A";
  const weekendShare = totalHeatmapTokens > 0 ? Math.round((weekendTokens / totalHeatmapTokens) * 100) : 0;
  const avgTokensPerActiveDay = activeCounts.length > 0
    ? Math.round(kiroUsage.totalTokens / activeCounts.length)
    : 0;

  return {
    displayName,
    username,
    accountLabel,
    accountDetail,
    planLabel,
    leaderboardUrl,
    leaderboardPublic,
    initials: getInitials(displayName),
    kiroOpens30d: `${kiroUsage.opensLast30Days}`,
    localSessions: `${kiroUsage.sessionCount}`,
    localSessionsRaw: Math.max(0, kiroUsage.sessionCount),
    totalTokens: formatCompact(kiroUsage.totalTokens),
    totalTokensRaw: Math.max(0, Math.round(kiroUsage.totalTokens)),
    peakTokens: formatCompact(kiroUsage.peakDayTokens),
    totalCredits: formatCredits(kiroUsage.totalCredits),
    totalCreditsRaw: Math.max(0, Math.round(kiroUsage.totalCredits * 100) / 100),
    currentStreak: currentStreakLabel,
    currentStreakRaw: Math.max(0, currentStreak),
    longestStreak: longestStreakLabel,
    longestStreakRaw: Math.max(0, longestStreak),
    activeDays: `${activeCounts.length}`,
    activeDaysRaw: activeCounts.length,
    heatmap,
    availableYears,
    insights: [
      { name: "Kiro launches, last 30 days", value: `${kiroUsage.opensLast30Days}` },
      { name: "Local Kiro sessions", value: `${kiroUsage.sessionCount}` },
      { name: "Estimated token usage", value: formatCompact(kiroUsage.totalTokens) },
      { name: "Peak token day", value: formatCompact(kiroUsage.peakDayTokens) },
      { name: "Credits recorded", value: formatCredits(kiroUsage.totalCredits) },
      { name: "Average turn length", value: formatDuration(Math.round(kiroUsage.averageTurnMinutes)) },
      { name: "Most used language", value: topItems[0]?.name || "TypeScript" },
      { name: "Longest streak", value: longestStreakLabel },
      { name: "Active days tracked", value: `${Math.max(activeCounts.length, 0)}` },
      { name: "Kiro hooks installed", value: `${kiroUsage.hookCount}` },
      { name: "Kiro powers installed", value: `${kiroUsage.powerCount}` },
      { name: "Kiro extensions installed", value: `${kiroUsage.extensionCount}` },
      { name: "CLI sessions", value: `${kiroUsage.cliSessionCount}` },
      { name: "IDE workspace sessions", value: `${kiroUsage.ideSessionCount}` },
      { name: "Tracked language files", value: `${totalLanguageFiles}` },
      { name: "Model events tracked", value: `${totalModelSessions}` },
      { name: "Largest local session", value: formatBytes(kiroUsage.largestSessionBytes) }
    ],
    topItems,
    modelItems,
    sessionStats: [
      { name: "Total Turns", value: `${kiroUsage.totalTurns}` },
      { name: "Success Rate", value: `${successRate.toFixed(1)}%` },
      { name: "Failed Turns", value: `${kiroUsage.failedTurns}` },
      { name: "Avg Session Duration", value: formatDuration(Math.round(avgSessionDuration)) },
      { name: "Sub-agent Calls", value: `${kiroUsage.subAgentInvocations}` }
    ],
    tokenStats: [
      { name: "Total Tokens", value: formatCompact(kiroUsage.totalTokens) },
      { name: "Prompt Tokens", value: formatCompact(kiroUsage.promptTokens) },
      { name: "Generated Tokens", value: formatCompact(kiroUsage.generatedTokens) },
      { name: "Prompt/Generated Ratio", value: kiroUsage.generatedTokens > 0 ? `${(kiroUsage.promptTokens / kiroUsage.generatedTokens).toFixed(2)}` : "N/A" },
      { name: "Avg Context Window", value: kiroUsage.contextWindowUsage.length > 0 ? formatCompact(Math.round(kiroUsage.contextWindowUsage.reduce((a, b) => a + b, 0) / kiroUsage.contextWindowUsage.length)) : "N/A" }
    ],
    activityPatterns: [
      { name: "Most Active Hour", value: mostActiveHour ? `${mostActiveHour[0]}:00 (${mostActiveHour[1]} events)` : "N/A" },
      { name: "Busiest Day", value: busiestWeekday },
      { name: "Weekend Activity", value: `${weekendShare}%` },
      { name: "Total Active Days", value: `${activeCounts.length}` },
      { name: "Avg Tokens/Active Day", value: avgTokensPerActiveDay > 0 ? formatCompact(avgTokensPerActiveDay) : "N/A" },
      { name: "Avg Activity/Day", value: activeCounts.length > 0 ? `${(kiroUsage.totalTurns / activeCounts.length).toFixed(1)} turns` : "N/A" }
    ],
    toolStats: topTools.length > 0
      ? topTools.map(([name, count]) => ({ name, value: `${count} uses` }))
      : [{ name: "No tool data yet", value: "0 uses" }],
    systemStats: [
      { name: "Hooks Installed", value: `${kiroUsage.hookCount}` },
      { name: "Powers Installed", value: `${kiroUsage.powerCount}` },
      { name: "Extensions Installed", value: `${kiroUsage.extensionCount}` },
      { name: "Errors Logged", value: `${kiroUsage.errorCount}` },
      { name: "Warnings Logged", value: `${kiroUsage.warningCount}` }
    ],
    dataSources: [
      { name: "Account Source", value: accountSource },
      { name: "Plan Source", value: planSource },
      { name: "CLI Session Files", value: `${kiroUsage.cliSessionCount}` },
      { name: "IDE Session Files", value: `${kiroUsage.ideSessionCount}` },
      { name: "Kiro Launch Log Dirs", value: `${kiroUsage.logDirCount}` },
      { name: "Token Log Rows", value: `${kiroUsage.tokenLogRows}` },
      { name: "Workspace Languages", value: `${fileStats.size}` },
      { name: "Tracked Code Files", value: `${totalLanguageFiles}` },
      { name: "Top Model", value: topModel ? formatModelName(topModel[0]) : "N/A" },
      { name: "Top Model Events", value: topModel ? `${topModel[1]}` : "0" }
    ]
  };
}

async function getGitActivityDays(cwd: string): Promise<string[]> {
  return new Promise((resolve) => {
    cp.exec("git log --date=short --pretty=format:%ad --all --since=\"365 days ago\"", { cwd }, (error, stdout) => {
      if (error || !stdout.trim()) {
        resolve([]);
        return;
      }

      resolve(stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
    });
  });
}

async function getWorkspaceFileStats(root: string): Promise<Map<string, number>> {
  const stats = new Map<string, number>();

  async function walk(current: string, depth: number) {
    if (depth > 8) {
      return;
    }

    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.has(entry.name)) {
          await walk(path.join(current, entry.name), depth + 1);
        }
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const language = LANGUAGE_BY_EXTENSION.get(path.extname(entry.name).toLowerCase());
      if (language) {
        stats.set(language, (stats.get(language) || 0) + 1);
      }
    }
  }

  await walk(root, 0);
  return stats;
}

async function getKiroUsage(): Promise<KiroUsage> {
  const home = os.homedir();
  const kiroHome = path.join(home, ".kiro");
  const appRoots = getKiroAppDataRoots(home);
  const logsRoots = appRoots.map((root) => path.join(root, "logs"));
  const days: string[] = [];
  let opensLast30Days = 0;
  let sessionCount = 0;
  let hookCount = 0;
  let powerCount = 0;
  let extensionCount = 0;
  let largestSessionBytes = 0;
  let totalTokens = 0;
  let peakDayTokens = 0;
  let totalCredits = 0;
  let totalTurnSeconds = 0;
  let turnCount = 0;
  const modelCounts = new Map<string, number>();
  const tokenCountsByDay = new Map<string, number>();
  const cutoff = atStartOfDay(new Date());
  cutoff.setDate(cutoff.getDate() - 29);
  // New tracking
  let totalTurns = 0;
  let failedTurns = 0;
  const toolUsageCounts = new Map<string, number>();
  const hourlyActivity = new Map<number, number>();
  const sessionDurations: number[] = [];
  let promptTokens = 0;
  let generatedTokens = 0;
  const contextWindowUsage: number[] = [];
  let subAgentInvocations = 0;
  let errorCount = 0;
  let warningCount = 0;
  let cliSessionCount = 0;
  let ideSessionCount = 0;
  let tokenLogRows = 0;
  let logDirCount = 0;

  for (const logsRoot of logsRoots) {
    try {
      const logEntries = await fs.readdir(logsRoot, { withFileTypes: true });
      for (const entry of logEntries) {
        if (!entry.isDirectory()) {
          continue;
        }
        const match = /^(\d{4})(\d{2})(\d{2})T/.exec(entry.name);
        if (!match) {
          continue;
        }
        const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
        const day = toIsoDate(date);
        days.push(day);
        logDirCount += 1;
        if (date >= cutoff) {
          opensLast30Days += 1;
        }
      }
    } catch {
      // Kiro may not have written app logs yet.
    }
  }

  try {
    const sessionRoot = path.join(kiroHome, "sessions");
    const sessionFiles = await listFiles(sessionRoot);
    for (const file of sessionFiles) {
      if (!file.endsWith(".json") && !file.endsWith(".jsonl")) {
        continue;
      }
      const stat = await fs.stat(file);
      if (file.endsWith(".json")) {
        sessionCount += 1;
        cliSessionCount += 1;
      }
      largestSessionBytes = Math.max(largestSessionBytes, stat.size);
      const fallbackDay = toIsoDate(stat.mtime);
      days.push(fallbackDay);

      if (!file.endsWith(".json")) {
        continue;
      }

      const parsed = await readJsonFile(file);
      const metrics = collectSessionMetrics(parsed, stat.size, fallbackDay);
      totalTokens += metrics.tokens;
      totalCredits += metrics.credits;
      totalTurnSeconds += metrics.turnSeconds;
      turnCount += metrics.turnCount;
      for (const day of metrics.days) {
        days.push(day);
      }
      for (const [day, tokens] of metrics.tokenCountsByDay) {
        tokenCountsByDay.set(day, (tokenCountsByDay.get(day) || 0) + tokens);
      }
      for (const [model, count] of metrics.modelCounts) {
        modelCounts.set(model, (modelCounts.get(model) || 0) + count);
      }
      totalTurns += metrics.totalTurns;
      failedTurns += metrics.failedTurns;
      promptTokens += metrics.promptTokens;
      generatedTokens += metrics.generatedTokens;
      errorCount += metrics.errorCount;
      warningCount += metrics.warningCount;
      subAgentInvocations += metrics.subAgentInvocations;
      if (metrics.sessionDuration > 0) {
        sessionDurations.push(metrics.sessionDuration);
      }
      for (const [tool, count] of metrics.toolUsage) {
        toolUsageCounts.set(tool, (toolUsageCounts.get(tool) || 0) + count);
      }
      for (const [hour, count] of metrics.hourlyActivity) {
        hourlyActivity.set(hour, (hourlyActivity.get(hour) || 0) + count);
      }
      if (metrics.contextSize > 0) {
        contextWindowUsage.push(metrics.contextSize);
      }
    }
  } catch {
    // Sessions are optional for fresh installs.
  }

  for (const appRoot of appRoots) {
    const kiroUserRoot = path.join(appRoot, "User");
    const agentStorageRoot = path.join(kiroUserRoot, "globalStorage", "kiro.kiroagent");

    // --- workspace sessions ---
    // Build a map of sessionId → dateCreated from every sessions.json index file
    const sessionDateMap = new Map<string, string>();
    try {
      const wsRoot = path.join(agentStorageRoot, "workspace-sessions");
      const wsDirs = await fs.readdir(wsRoot, { withFileTypes: true });
      for (const entry of wsDirs) {
        if (!entry.isDirectory()) continue;
        const indexPath = path.join(wsRoot, entry.name, "sessions.json");
        try {
          const raw = await readJsonFile(indexPath);
          if (!raw) continue;

          // Structure is a plain array: [{ sessionId, dateCreated, ... }]
          // (older versions may have wrapped it as { value: [...] })
          const list: Record<string, unknown>[] = Array.isArray(raw)
            ? raw as Record<string, unknown>[]
            : Array.isArray((raw as Record<string, unknown>).value)
              ? (raw as Record<string, unknown>).value as Record<string, unknown>[]
              : [];

          for (const s of list) {
            const sid = typeof s.sessionId === "string" ? s.sessionId : "";
            const dc = typeof s.dateCreated === "string" ? s.dateCreated : "";
            if (sid && dc) {
              const ms = Number(dc);
              // dateCreated is unix-milliseconds (13 digits), not seconds
              if (!Number.isNaN(ms) && ms > 1_000_000_000_000) {
                sessionDateMap.set(sid, toIsoDate(new Date(ms)));
              }
            }
          }
        } catch { /* index missing or malformed */ }
      }
    } catch { /* workspace-sessions dir missing */ }

    try {
      const wsRoot = path.join(agentStorageRoot, "workspace-sessions");
      const allSessionFiles = await listFiles(wsRoot);
      for (const file of allSessionFiles) {
        if (!file.endsWith(".json") || path.basename(file).toLowerCase() === "sessions.json") continue;

        const stat = await fs.stat(file);
        const sessionId = path.basename(file, ".json");
        // Prefer the dateCreated from the index; fall back to file mod time
        const day = sessionDateMap.get(sessionId) ?? toIsoDate(stat.mtime);

        days.push(day);
        sessionCount += 1;
        ideSessionCount += 1;
        largestSessionBytes = Math.max(largestSessionBytes, stat.size);

        const parsed = await readJsonFile(file) as Record<string, unknown> | undefined;

        const metrics = collectSessionMetrics(parsed, stat.size, day);
        totalTokens += metrics.tokens;
        totalCredits += metrics.credits;
        totalTurnSeconds += metrics.turnSeconds;
        turnCount += metrics.turnCount;
        totalTurns += metrics.totalTurns;
        failedTurns += metrics.failedTurns;
        promptTokens += metrics.promptTokens;
        generatedTokens += metrics.generatedTokens;
        subAgentInvocations += metrics.subAgentInvocations;
        errorCount += metrics.errorCount;
        warningCount += metrics.warningCount;
        for (const metricDay of metrics.days) {
          days.push(metricDay);
        }
        for (const [metricDay, tokens] of metrics.tokenCountsByDay) {
          tokenCountsByDay.set(metricDay, (tokenCountsByDay.get(metricDay) || 0) + tokens);
        }
        for (const [model, count] of metrics.modelCounts) {
          modelCounts.set(model, (modelCounts.get(model) || 0) + count);
        }
        for (const [tool, count] of metrics.toolUsage) {
          toolUsageCounts.set(tool, (toolUsageCounts.get(tool) || 0) + count);
        }
        for (const [hour, count] of metrics.hourlyActivity) {
          hourlyActivity.set(hour, (hourlyActivity.get(hour) || 0) + count);
        }
        if (metrics.sessionDuration > 0) {
          sessionDurations.push(metrics.sessionDuration);
        }
        if (metrics.contextSize > 0) {
          contextWindowUsage.push(metrics.contextSize);
        }

        const history = parsed && Array.isArray(parsed.history) ? parsed.history as Record<string, unknown>[] : [];
        if (metrics.totalTurns === 0 && history.length > 0) {
          totalTurns += Math.floor(history.length / 2);
        }

        // Estimate tokens from contextUsagePercentage
        // Kiro's context window is ~200k tokens; contextUsagePercentage is % of that used
        const ctxPct = numberValue(parsed?.contextUsagePercentage as unknown);
        if (ctxPct > 0) {
          const estimatedTokens = Math.round((ctxPct / 100) * 200_000);
          totalTokens += estimatedTokens;
          tokenCountsByDay.set(day, (tokenCountsByDay.get(day) || 0) + estimatedTokens);
          contextWindowUsage.push(estimatedTokens);
        } else if (stat.size > 2048) {
          // fallback: rough estimate from file size (JSON overhead ~4 bytes per token)
          const sizeEstimate = Math.round(stat.size / 8);
          totalTokens += sizeEstimate;
          tokenCountsByDay.set(day, (tokenCountsByDay.get(day) || 0) + sizeEstimate);
        }
      }
    } catch {
      // IDE workspace sessions are not present on all Kiro installs.
    }

    try {
      const tokenLogPath = path.join(agentStorageRoot, "dev_data", "tokens_generated.jsonl");
      // Pass the known session dates so tokens can be spread across real days
      const knownDays = [...new Set(days)].filter(Boolean).sort();
      const tokenMetrics = await readTokenGenerationLog(tokenLogPath, knownDays);
      tokenLogRows += tokenMetrics.rows;
      promptTokens += tokenMetrics.promptTokens;
      generatedTokens += tokenMetrics.generatedTokens;
      // Only add JSONL tokens if we don't already have better estimates from sessions
      if (totalTokens === 0) {
        totalTokens += tokenMetrics.tokens;
        for (const [day, tokens] of tokenMetrics.tokenCountsByDay) {
          tokenCountsByDay.set(day, (tokenCountsByDay.get(day) || 0) + tokens);
          days.push(day);
        }
      }
      for (const [model, count] of tokenMetrics.modelCounts) {
        modelCounts.set(model, (modelCounts.get(model) || 0) + count);
      }
    } catch {
      // Dev token logs are optional and may be disabled.
    }

  }

  hookCount = await countFiles(path.join(kiroHome, "hooks"), ".hook");
  extensionCount = await countExtensionFolders(path.join(kiroHome, "extensions"));
  powerCount = await countInstalledPowers(path.join(kiroHome, "powers", "installed.json"));

  // Only fall back to size estimate if we genuinely have zero token data
  if (totalTokens <= 0 && days.length > 0) {
    // Spread a rough estimate evenly across all known active days
    const uniqueDays = [...new Set(days)].filter(Boolean).sort();
    const roughTotal = Math.max(largestSessionBytes > 0 ? Math.round(largestSessionBytes / 6) : 0, uniqueDays.length * 5000);
    totalTokens = roughTotal;
    const perDay = Math.round(roughTotal / uniqueDays.length);
    for (const d of uniqueDays) {
      tokenCountsByDay.set(d, perDay);
    }
  }

  for (const tokens of tokenCountsByDay.values()) {
    peakDayTokens = Math.max(peakDayTokens, tokens);
  }

  return {
    days,
    opensLast30Days,
    sessionCount,
    hookCount,
    powerCount,
    extensionCount,
    largestSessionBytes,
    totalTokens,
    peakDayTokens,
    totalCredits,
    averageTurnMinutes: turnCount > 0 ? totalTurnSeconds / turnCount / 60 : 0,
    modelCounts,
    tokenCountsByDay,
    totalTurns,
    failedTurns,
    toolUsageCounts,
    hourlyActivity,
    sessionDurations,
    promptTokens,
    generatedTokens,
    contextWindowUsage,
    subAgentInvocations,
    errorCount,
    warningCount,
    cliSessionCount,
    ideSessionCount,
    tokenLogRows,
    logDirCount
  };
}

type SessionMetrics = {
  tokens: number;
  credits: number;
  turnSeconds: number;
  turnCount: number;
  days: string[];
  tokenCountsByDay: Map<string, number>;
  modelCounts: Map<string, number>;
  totalTurns: number;
  failedTurns: number;
  toolUsage: Map<string, number>;
  hourlyActivity: Map<number, number>;
  sessionDuration: number;
  promptTokens: number;
  generatedTokens: number;
  contextSize: number;
  subAgentInvocations: number;
  errorCount: number;
  warningCount: number;
};

function getKiroAppDataRoots(home: string): string[] {
  const candidates = [
    process.env.APPDATA ? path.join(process.env.APPDATA, "Kiro") : "",
    process.platform === "darwin" ? path.join(home, "Library", "Application Support", "Kiro") : "",
    process.env.XDG_CONFIG_HOME ? path.join(process.env.XDG_CONFIG_HOME, "Kiro") : "",
    path.join(home, ".config", "Kiro")
  ].filter(Boolean);
  return [...new Set(candidates)];
}

async function readLocalKiroAccount(appRoots: string[]): Promise<LocalKiroAccount | undefined> {
  for (const appRoot of appRoots) {
    const agentStorageRoot = path.join(appRoot, "User", "globalStorage", "kiro.kiroagent");
    const profile = await readJsonFile(path.join(agentStorageRoot, "profile.json"));
    if (!profile || typeof profile !== "object") {
      continue;
    }

    const record = profile as Record<string, unknown>;
    const provider = stringValue(record.name);
    const displayName = await getLocalProfileDisplayName(record, appRoot);
    const hasArn = Boolean(stringValue(record.arn));
    const plan = await findLocalPlanLabel(agentStorageRoot);

    return {
      accountLabel: provider || "Kiro account",
      accountDetail: provider && hasArn ? `Signed in with ${provider}` : "Local profile",
      displayName,
      accountSource: "Kiro profile.json",
      planLabel: plan?.label,
      planSource: plan?.source || "Settings fallback"
    };
  }

  return undefined;
}

async function getLocalProfileDisplayName(record: Record<string, unknown>, appRoot: string): Promise<string | undefined> {
  for (const key of ["email", "accountEmail", "userEmail"]) {
    const value = stringValue(record[key]);
    if (isEmail(value)) {
      return value;
    }
  }

  const localEmail = await findLocalKiroEmail(appRoot);
  if (localEmail) {
    return localEmail;
  }

  for (const key of ["displayName", "fullName", "userName", "username", "login"]) {
    const value = stringValue(record[key]);
    if (value && value.length <= 80 && !value.includes(":")) {
      return value;
    }
  }

  return undefined;
}

async function findLocalKiroEmail(appRoot: string): Promise<string | undefined> {
  const userRoot = path.join(appRoot, "User");
  const files = await listSmallJsonFiles(userRoot, 6, 200_000);
  for (const file of files) {
    if (file.includes(`${path.sep}History${path.sep}`) || file.includes(`${path.sep}workspaceStorage${path.sep}`)) {
      continue;
    }
    const parsed = await readJsonFile(file);
    const email = extractEmailLabel(parsed);
    if (email) {
      return email;
    }
  }
  return undefined;
}

function extractEmailLabel(value: unknown, depth = 0): string | undefined {
  if (!value || typeof value !== "object" || depth > 6) {
    return undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const email = extractEmailLabel(item, depth + 1);
      if (email) {
        return email;
      }
    }
    return undefined;
  }

  const record = value as Record<string, unknown>;
  for (const [key, rawValue] of Object.entries(record)) {
    if (!/(^|_|-)(email|accountEmail|userEmail|login)(_|-|$)/i.test(key)) {
      continue;
    }
    const email = stringValue(rawValue);
    if (isEmail(email)) {
      return email;
    }
  }

  for (const child of Object.values(record)) {
    const email = extractEmailLabel(child, depth + 1);
    if (email) {
      return email;
    }
  }

  return undefined;
}

function isEmail(value: string | undefined): value is string {
  return Boolean(value && value.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

async function findLocalPlanLabel(agentStorageRoot: string): Promise<{ label: string; source: string } | undefined> {
  const candidateFiles = await listSmallJsonFiles(agentStorageRoot, 4, 100_000);
  for (const file of candidateFiles) {
    const parsed = await readJsonFile(file);
    const label = extractPlanLabel(parsed);
    if (label) {
      return { label, source: "Detected local plan" };
    }
  }
  return undefined;
}

async function listSmallJsonFiles(root: string, maxDepth: number, maxBytes: number): Promise<string[]> {
  const files: string[] = [];

  async function walk(current: string, depth: number) {
    if (depth > maxDepth) {
      return;
    }

    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!["workspace-sessions", "dev_data", "index"].includes(entry.name)) {
          await walk(fullPath, depth + 1);
        }
        continue;
      }

      if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".json")) {
        continue;
      }

      try {
        const stat = await fs.stat(fullPath);
        if (stat.size <= maxBytes) {
          files.push(fullPath);
        }
      } catch {
        // Skip files that disappear while Kiro is writing local state.
      }
    }
  }

  await walk(root, 0);
  return files;
}

function extractPlanLabel(value: unknown, depth = 0): string | undefined {
  if (!value || typeof value !== "object" || depth > 6) {
    return undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const label = extractPlanLabel(item, depth + 1);
      if (label) {
        return label;
      }
    }
    return undefined;
  }

  const record = value as Record<string, unknown>;
  for (const key of ["plan", "planName", "tier", "subscription"]) {
    const label = normalizePlanLabel(record[key]);
    if (label) {
      return label;
    }
  }

  const usage = numberValue(record.usage);
  const limit = numberValue(record.limit);
  if (limit > 0 && usage >= 0) {
    return `${formatCompact(usage)} / ${formatCompact(limit)}`;
  }

  const quota = record.quota;
  if (quota && typeof quota === "object") {
    const quotaRecord = quota as Record<string, unknown>;
    for (const key of ["plan", "planName", "tier", "subscription"]) {
      const label = normalizePlanLabel(quotaRecord[key]);
      if (label) {
        return label;
      }
    }
    const quotaUsage = numberValue(quotaRecord.usage);
    const quotaLimit = numberValue(quotaRecord.limit);
    if (quotaLimit > 0 && quotaUsage >= 0) {
      return `${formatCompact(quotaUsage)} / ${formatCompact(quotaLimit)}`;
    }
  }

  for (const child of Object.values(record)) {
    const label = extractPlanLabel(child, depth + 1);
    if (label) {
      return label;
    }
  }

  return undefined;
}

function normalizePlanLabel(value: unknown): string | undefined {
  const raw = stringValue(value);
  if (!raw || raw.length > 48) {
    return undefined;
  }
  const compact = raw.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!/\b(kiro|free|pro|plus|team|enterprise|trial|paid|subscription)\b/i.test(compact)) {
    return undefined;
  }
  return compact.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

async function readJsonFile(filePath: string): Promise<unknown> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as unknown;
  } catch {
    return undefined;
  }
}

async function readTokenGenerationLog(filePath: string, sessionDates: string[]): Promise<{
  tokens: number;
  promptTokens: number;
  generatedTokens: number;
  tokenCountsByDay: Map<string, number>;
  modelCounts: Map<string, number>;
  rows: number;
}> {
  const tokenCountsByDay = new Map<string, number>();
  const modelCounts = new Map<string, number>();
  let tokens = 0;
  let promptTokens = 0;
  let generatedTokens = 0;
  let parsedRows = 0;

  try {
    const content = await fs.readFile(filePath, "utf8");
    const lines = content.split(/\r?\n/).filter(l => l.trim());

    // Parse all rows first
    const rows: Array<{ promptTokens: number; generatedTokens: number; model: string }> = [];
    for (const line of lines) {
      try {
        const row = JSON.parse(line) as Record<string, unknown>;
        const rowTokens = numberValue(row.promptTokens) + numberValue(row.generatedTokens);
        const model = typeof row.model === "string" ? row.model.trim() : "";
        const rowPromptTokens = numberValue(row.promptTokens);
        const rowGeneratedTokens = numberValue(row.generatedTokens);
        rows.push({ promptTokens: rowPromptTokens, generatedTokens: rowGeneratedTokens, model });
        if (rowTokens > 0) tokens += rowTokens;
        promptTokens += rowPromptTokens;
        generatedTokens += rowGeneratedTokens;
        parsedRows += 1;
        if (model && model !== "agent") {
          modelCounts.set(model, (modelCounts.get(model) || 0) + 1);
        }
      } catch {
        // skip malformed rows
      }
    }

    if (rows.length === 0) return { tokens, promptTokens, generatedTokens, tokenCountsByDay, modelCounts, rows: parsedRows };

    // The JSONL has no timestamps. Distribute tokens across known session dates.
    // Each session day gets a proportional slice of the total rows.
    const dates = sessionDates.length > 0 ? [...new Set(sessionDates)].sort() : [toIsoDate(new Date())];
    const rowsPerDay = Math.ceil(rows.length / dates.length);

    rows.forEach((row, i) => {
      const rowTokens = row.promptTokens + row.generatedTokens;
      if (rowTokens <= 0) return;
      const dayIndex = Math.min(Math.floor(i / rowsPerDay), dates.length - 1);
      const day = dates[dayIndex];
      tokenCountsByDay.set(day, (tokenCountsByDay.get(day) || 0) + rowTokens);
    });

  } catch {
    return { tokens, promptTokens, generatedTokens, tokenCountsByDay, modelCounts, rows: parsedRows };
  }

  return { tokens, promptTokens, generatedTokens, tokenCountsByDay, modelCounts, rows: parsedRows };
}

async function readSelectedKiroModel(settingsPath: string): Promise<string | undefined> {
  const parsed = await readJsonFile(settingsPath);
  if (!parsed || typeof parsed !== "object") {
    return undefined;
  }
  const settings = parsed as Record<string, unknown>;
  const selected = settings["kiroAgent.modelSelection"] || settings["kiroAgent.agentModelSelection"];
  return typeof selected === "string" && selected.trim() ? selected.trim() : undefined;
}

function collectSessionMetrics(root: unknown, fileSize: number, fallbackDay: string): SessionMetrics {
  const metrics: SessionMetrics = {
    tokens: 0,
    credits: 0,
    turnSeconds: 0,
    turnCount: 0,
    days: [],
    tokenCountsByDay: new Map(),
    modelCounts: new Map(),
    totalTurns: 0,
    failedTurns: 0,
    toolUsage: new Map(),
    hourlyActivity: new Map(),
    sessionDuration: 0,
    promptTokens: 0,
    generatedTokens: 0,
    contextSize: 0,
    subAgentInvocations: 0,
    errorCount: 0,
    warningCount: 0
  };

  let sessionStartMs: number | undefined;
  let sessionEndMs: number | undefined;

  function addTokens(day: string, tokens: number) {
    if (tokens <= 0) return;
    metrics.tokens += tokens;
    metrics.tokenCountsByDay.set(day, (metrics.tokenCountsByDay.get(day) || 0) + tokens);
  }

  // Iterative traversal with a depth cap to avoid stack overflows on large session files
  const stack: Array<{ value: unknown; depth: number; day: string }> = [{ value: root, depth: 0, day: fallbackDay }];

  while (stack.length > 0) {
    const item = stack.pop()!;
    const { value, depth, day: currentDay } = item;

    if (!value || typeof value !== "object" || depth > 12) continue;

    const record = value as Record<string, unknown>;
    const discoveredDay = getRecordDay(record) || currentDay;
    if (discoveredDay !== currentDay) {
      metrics.days.push(discoveredDay);
    }

    // --- tokens ---
    const inputTokens = numberValue(record.input_token_count) || numberValue(record.inputTokens) || numberValue(record.promptTokens);
    const outputTokens = numberValue(record.output_token_count) || numberValue(record.outputTokens) || numberValue(record.generatedTokens);
    const tokenTotal = inputTokens + outputTokens;
    if (tokenTotal > 0) {
      addTokens(discoveredDay, tokenTotal);
      if (inputTokens > 0) metrics.promptTokens += inputTokens;
      if (outputTokens > 0) metrics.generatedTokens += outputTokens;
    }

    const contextTokens = numberValue(record.context_token_count) || numberValue(record.contextTokens) || numberValue(record.contextSize);
    if (contextTokens > 0) metrics.contextSize = Math.max(metrics.contextSize, contextTokens);

    // --- credits ---
    if (Array.isArray(record.metering_usage)) {
      for (const m of record.metering_usage as unknown[]) {
        if (m && typeof m === "object") {
          const metering = m as Record<string, unknown>;
          if (String(metering.unit || "").toLowerCase() === "credit") {
            metrics.credits += numberValue(metering.value);
          }
        }
      }
    }

    // --- turn duration ---
    const turnDuration = record.turn_duration;
    if (turnDuration && typeof turnDuration === "object") {
      const dur = turnDuration as Record<string, unknown>;
      metrics.turnSeconds += numberValue(dur.secs) + numberValue(dur.nanos) / 1_000_000_000;
      metrics.turnCount += 1;
      metrics.totalTurns += 1;
    }

    // --- turn count (role-based, don't double-count with turn_duration) ---
    if (!record.turn_duration && (record.turn_id || record.turnId)) {
      metrics.totalTurns += 1;
    }

    // --- failed turns ---
    if (record.error || record.failed === true || record.status === "error" || record.status === "failed") {
      metrics.failedTurns += 1;
      metrics.errorCount += 1;
    }
    const level = String(record.level || record.severity || "").toLowerCase();
    const messageKind = String(record.kind || record.type || "").toLowerCase();
    if (level === "error" || messageKind === "error") {
      metrics.errorCount += 1;
    }
    if (level === "warning" || level === "warn" || messageKind === "warning" || messageKind === "warn") {
      metrics.warningCount += 1;
    }

    // --- tool usage ---
    const toolName = record.tool_name || record.toolName || record.name;
    if (typeof toolName === "string" && toolName.trim()) {
      const t = toolName.trim();
      metrics.toolUsage.set(t, (metrics.toolUsage.get(t) || 0) + 1);
      if (t === "invoke_sub_agent" || t === "invokeSubAgent") {
        metrics.subAgentInvocations += 1;
      }
    }

    // --- hourly activity from timestamps ---
    for (const key of ["end_timestamp", "updated_at", "created_at", "timestamp"]) {
      const val = record[key];
      const d = parseKiroDate(val);
      if (d) {
        if (!Number.isNaN(d.getTime())) {
          metrics.hourlyActivity.set(d.getHours(), (metrics.hourlyActivity.get(d.getHours()) || 0) + 1);
          break;
        }
      }
    }

    // --- session duration boundaries ---
    const createdAt = record.created_at || record.createdAt || record.start_timestamp;
    {
      const date = parseKiroDate(createdAt);
      const t = date?.getTime();
      if (typeof t === "number" && !Number.isNaN(t) && (!sessionStartMs || t < sessionStartMs)) sessionStartMs = t;
    }
    const endedAt = record.end_timestamp || record.endedAt || record.updated_at;
    {
      const date = parseKiroDate(endedAt);
      const t = date?.getTime();
      if (typeof t === "number" && !Number.isNaN(t) && (!sessionEndMs || t > sessionEndMs)) sessionEndMs = t;
    }

    // --- model info ---
    const modelInfo = record.model_info;
    if (modelInfo && typeof modelInfo === "object") {
      const model = String((modelInfo as Record<string, unknown>).model_id || "").trim();
      if (model) metrics.modelCounts.set(model, (metrics.modelCounts.get(model) || 0) + 1);
    }
    for (const key of ["selectedModel", "modelSelection", "kiroAgent.modelSelection"]) {
      const model = record[key];
      if (typeof model === "string" && model.trim()) {
        metrics.modelCounts.set(model.trim(), (metrics.modelCounts.get(model.trim()) || 0) + 1);
      }
    }

    // Push children — only plain objects and arrays, skip primitives
    for (const child of Object.values(record)) {
      if (child && typeof child === "object") {
        if (Array.isArray(child)) {
          for (const elem of child as unknown[]) {
            if (elem && typeof elem === "object") {
              stack.push({ value: elem, depth: depth + 1, day: discoveredDay });
            }
          }
        } else {
          stack.push({ value: child, depth: depth + 1, day: discoveredDay });
        }
      }
    }
  }

  if (sessionStartMs && sessionEndMs && sessionEndMs > sessionStartMs) {
    metrics.sessionDuration = (sessionEndMs - sessionStartMs) / 1000 / 60;
  }

  return metrics;
}

function getRecordDay(record: Record<string, unknown>): string | undefined {
  for (const key of ["end_timestamp", "updated_at", "created_at", "timestamp"]) {
    const date = parseKiroDate(record[key]);
    if (date) {
      return toIsoDate(date);
    }
  }
  return undefined;
}

function parseKiroDate(value: unknown): Date | undefined {
  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);
    const date = Number.isFinite(numeric) ? dateFromEpoch(numeric) : new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  if (typeof value === "number" && Number.isFinite(value) && value > 1_000_000_000) {
    const date = dateFromEpoch(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  return undefined;
}

function dateFromEpoch(value: number): Date {
  return new Date(value > 1_000_000_000_000 ? value : value * 1000);
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

async function listFiles(root: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(current: string) {
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }

  await walk(root);
  return files;
}

async function countFiles(root: string, extension: string): Promise<number> {
  const files = await listFiles(root);
  return files.filter((file) => file.toLowerCase().endsWith(extension.toLowerCase())).length;
}

async function countExtensionFolders(root: string): Promise<number> {
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory() && entry.name.includes(".")).length;
  } catch {
    return 0;
  }
}

async function countInstalledPowers(filePath: string): Promise<number> {
  try {
    const content = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(content) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.length;
    }
    if (parsed && typeof parsed === "object") {
      return Object.keys(parsed).length;
    }
  } catch {
    // Missing or unparseable power metadata means none can be counted safely.
  }
  return 0;
}

function buildHeatmap(days: string[]): DayPoint[] {
  const counts = new Map<string, number>();
  for (const day of days) {
    counts.set(day, (counts.get(day) || 0) + 1);
  }

  return buildHeatmapFromCounts(counts, days);
}

function buildHeatmapFromCounts(counts: Map<string, number>, fallbackDays: string[] = []): DayPoint[] {
  const years = new Set<number>([new Date().getFullYear()]);
  for (const day of [...counts.keys(), ...fallbackDays]) {
    const year = Number(day.slice(0, 4));
    if (Number.isFinite(year) && year > 2000 && year < 2100) {
      years.add(year);
    }
  }
  const sortedYears = [...years].sort((a, b) => a - b);
  const start = new Date(sortedYears[0], 0, 1);
  const end = new Date(sortedYears[sortedYears.length - 1], 11, 31);

  const points: DayPoint[] = [];
  for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const key = toIsoDate(cursor);
    points.push({ date: key, count: counts.get(key) || 0 });
  }

  return points;
}

function getAvailableYears(points: DayPoint[]): number[] {
  const years = new Set<number>();
  for (const point of points) {
    const year = Number(point.date.slice(0, 4));
    if (Number.isFinite(year)) {
      years.add(year);
    }
  }
  return [...years].sort((a, b) => b - a);
}

function getCurrentStreak(points: DayPoint[]): number {
  let streak = 0;
  const today = toIsoDate(new Date());
  let index = points.findIndex((point) => point.date === today);
  if (index < 0) {
    index = points.length - 1;
  }

  for (; index >= 0; index -= 1) {
    if (points[index].count <= 0) {
      break;
    }
    streak += 1;
  }
  return streak;
}

function getLongestStreak(points: DayPoint[]): number {
  let longest = 0;
  let current = 0;
  for (const point of points) {
    if (point.count > 0) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }
  return longest;
}

function sumValues(values: Map<string, number>): number {
  return [...values.values()].reduce((sum, value) => sum + value, 0);
}

function atStartOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  const initials = parts.map((part) => part[0]?.toUpperCase()).join("");
  return initials || "K";
}

function formatCompact(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return `${Math.round(value)}`;
}

function formatCredits(value: number): string {
  if (value <= 0) {
    return "0";
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toFixed(value >= 10 ? 1 : 2);
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours <= 0) {
    return `${mins}m`;
  }
  return `${hours}h ${mins}m`;
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) {
    return "0 KB";
  }
  if (bytes >= 1_048_576) {
    return `${(bytes / 1_048_576).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function getProfileHtml(webview: vscode.Webview, extensionUri: vscode.Uri, data: ProfileData): string {
  const nonce = getNonce();
  const cspSource = webview.cspSource;
  const encoded = JSON.stringify(data).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} data:; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kiro Stat</title>
  <style nonce="${nonce}">
    :root {
      color-scheme: dark;
      --bg: #0d0b14;
      --panel: #15111f;
      --panel-soft: #21192e;
      --line: #342945;
      --text: #f4f4f4;
      --muted: #b7adc7;
      --faint: #7e718f;
      --kiro-purple: #6f45ff;
      --kiro-purple-2: #a557ff;
      --kiro-pink: #ef6edb;
      --kiro-blue: #5aa8ff;
      --kiro-glow: rgba(165, 87, 255, 0.34);
      --token-gradient: linear-gradient(135deg, #4b2cff 0%, #9d4dff 48%, #ef6edb 100%);
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      background:
        radial-gradient(circle at 50% -12%, rgba(165, 87, 255, 0.24), transparent 34%),
        radial-gradient(circle at 100% 8%, rgba(90, 168, 255, 0.12), transparent 24%),
        linear-gradient(180deg, #171123 0%, var(--bg) 30%);
      color: var(--text);
      font-family: var(--vscode-font-family, "Segoe UI", sans-serif);
      font-size: var(--vscode-font-size, 13px);
    }

    button {
      color: inherit;
      font: inherit;
    }

    .shell {
      min-width: 420px;
      max-width: 920px;
      margin: 0 auto;
      padding: 24px 28px 34px;
    }

    .topbar {
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      justify-content: space-between;
      align-items: center;
      min-height: 50px;
    }

    .title {
      font-size: 14px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .actions {
      display: flex;
      gap: 16px;
      align-items: center;
      color: var(--text);
    }

    .action {
      border: 0;
      background: transparent;
      padding: 4px 0;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      border-radius: 6px;
    }

    .action:hover {
      color: var(--kiro-pink);
    }

    .action svg {
      width: 14px;
      height: 14px;
    }

    .action.is-loading svg {
      animation: spin 0.9s linear infinite;
    }

    .refresh-status {
      min-width: 48px;
      color: var(--muted);
      font-size: 12px;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    .hero {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 48px 0 36px;
      text-align: center;
    }

    .avatar-wrap {
      position: relative;
      width: 92px;
      height: 92px;
      margin-bottom: 14px;
    }

    .avatar {
      width: 80px;
      height: 80px;
      border-radius: 999px;
      display: grid;
      place-items: center;
      background: var(--token-gradient);
      color: white;
      font-size: 28px;
      font-weight: 500;
    }

    .spark {
      position: absolute;
      right: 2px;
      bottom: 6px;
      width: 32px;
      height: 32px;
      border-radius: 10px;
      display: grid;
      place-items: center;
      background: linear-gradient(135deg, #7447ff, #ef6edb 62%, #5aa8ff);
      box-shadow: 0 0 0 3px var(--bg);
    }

    .spark svg {
      width: 21px;
      height: 21px;
    }

    .name {
      margin: 0 0 6px;
      font-size: 24px;
      line-height: 1.2;
      font-weight: 500;
      letter-spacing: 0;
    }

    .handle {
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: center;
      color: var(--muted);
      white-space: nowrap;
    }

    .badge {
      border: 1px solid var(--line);
      background: var(--panel-soft);
      color: #cfcfcf;
      border-radius: 7px;
      padding: 2px 7px;
      font-size: 12px;
    }

    .stats {
      margin: 0 0 14px;
      border: 1px solid var(--line);
      border-radius: 13px;
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      overflow: hidden;
      background: #151515;
      background: linear-gradient(180deg, rgba(33, 25, 46, 0.96), rgba(17, 13, 26, 0.96));
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.26), 0 0 0 1px rgba(165, 87, 255, 0.08);
    }

    .stat {
      padding: 14px 12px 12px;
      text-align: center;
      min-width: 0;
      position: relative;
    }

    .stat-token {
      background: var(--token-gradient);
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.13), 0 0 24px rgba(165, 87, 255, 0.18);
    }

    .stat-token .stat-label,
    .stat-token .stat-value {
      color: white;
      text-shadow: 0 1px 12px rgba(0, 0, 0, 0.25);
    }

    .stat-peak {
      background: linear-gradient(135deg, rgba(111, 69, 255, 0.22), rgba(239, 110, 219, 0.13));
    }

    .stat + .stat {
      border-left: 1px solid rgba(255, 255, 255, 0.07);
    }

    .stat-value {
      font-size: 13px;
      color: white;
      margin-bottom: 5px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .stat-label {
      color: #b8b8b8;
      line-height: 1.25;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .section {
      margin-top: 44px;
    }

    .section-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }

    .section-title {
      margin: 0;
      font-size: 14px;
      font-weight: 700;
    }

    .tabs {
      display: flex;
      gap: 6px;
      color: var(--muted);
    }

    .activity-controls {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--muted);
    }

    .tab {
      border: 0;
      background: transparent;
      border-radius: 6px;
      color: var(--muted);
      cursor: pointer;
      padding: 3px 6px;
    }

    .tab-active {
      background: rgba(165, 87, 255, 0.17);
      color: #f0dfff;
    }

    .year-select {
      min-width: 82px;
      border: 1px solid var(--line);
      border-radius: 7px;
      background: var(--panel-soft);
      color: var(--text);
      padding: 3px 8px;
      font: inherit;
    }

    .heatmap-wrap {
      overflow-x: auto;
      overflow-y: hidden;
    }

    .heatmap {
      display: grid;
      grid-auto-flow: column;
      grid-template-rows: repeat(7, 11px);
      grid-auto-columns: 11px;
      gap: 4px;
      align-items: start;
    }

    .cell {
      width: 11px;
      height: 11px;
      border-radius: 3px;
      background: #202020;
    }

    .level-1 { background: #302644; }
    .level-2 { background: #53358f; }
    .level-3 { background: #7a49d8; }
    .level-4 { background: #ef6edb; box-shadow: 0 0 10px rgba(239, 110, 219, 0.45); }

    .months {
      position: relative;
      height: 18px;
      margin-bottom: 6px;
      color: var(--muted);
      font-size: 11px;
      min-width: max-content;
    }

    .months span {
      position: absolute;
      top: 0;
      white-space: nowrap;
    }

    .lower {
      margin-top: 42px;
      display: grid;
      grid-template-columns: 1fr 1.08fr;
      gap: 58px;
    }

    .lower-three {
      grid-template-columns: 1fr 1fr 1fr;
      gap: 34px;
    }

    .rows {
      display: grid;
      gap: 16px;
      margin-top: 18px;
    }

    .row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 18px;
      align-items: center;
      color: var(--muted);
      min-width: 0;
    }

    .row strong {
      color: white;
      font-weight: 500;
      white-space: nowrap;
    }

    .plugin {
      grid-template-columns: 24px minmax(0, 1fr) auto;
      gap: 10px;
    }

    .lang-icon {
      width: 20px;
      height: 20px;
      border-radius: 7px;
      display: grid;
      place-items: center;
      background: linear-gradient(135deg, rgba(111, 69, 255, 0.85), rgba(239, 110, 219, 0.7));
      color: white;
      font-size: 9px;
      font-weight: 800;
    }

    .model-icon {
      background: linear-gradient(135deg, #5a35ff, #a557ff 58%, #5aa8ff);
      color: white;
    }

    .plugin-name {
      color: white;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .app-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 24px;
      margin: 18px 0 26px;
    }

    .profile-line {
      display: flex;
      align-items: center;
      gap: 16px;
      min-width: 0;
    }

    .profile-line .avatar {
      width: 72px;
      height: 72px;
      flex: 0 0 auto;
      font-size: 24px;
      box-shadow: 0 0 30px rgba(165, 87, 255, 0.36);
    }

    .profile-meta {
      display: grid;
      gap: 3px;
    }

    .profile-meta .name {
      margin: 0;
      font-size: 22px;
      line-height: 1.15;
      font-weight: 760;
    }

    .header-actions {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 8px;
    }

    .sync-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .sync-button {
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.045);
      padding: 8px 14px;
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.2);
    }

    .leaderboard-button {
      border: 0;
      background: transparent;
      padding: 8px;
      color: var(--muted);
    }

    .public-toggle {
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.055);
      color: #cfc7df;
      min-width: 116px;
      min-height: 38px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      padding: 8px 14px;
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.16);
      cursor: pointer;
    }

    .public-toggle #public-toggle-icon {
      width: 18px;
      height: 18px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.08);
    }

    .public-toggle #public-toggle-icon svg {
      width: 15px;
      height: 15px;
    }

    .public-toggle.is-public {
      border-color: rgba(94, 234, 212, 0.58);
      background: linear-gradient(135deg, rgba(94, 234, 212, 0.22), rgba(165, 87, 255, 0.28));
      color: #d8fff7;
    }

    .share-button {
      border: 0;
      background: transparent;
      padding: 8px;
      color: var(--muted);
    }

    .sync-subtext {
      font-size: 11px;
      color: var(--muted);
    }

    .status-dot {
      display: inline-block;
      width: 6px;
      height: 6px;
      border-radius: 999px;
      background: #66e58d;
      margin-left: 6px;
      box-shadow: 0 0 10px rgba(102, 229, 141, 0.75);
    }

    .metric-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 16px;
      margin: 18px 0 18px;
    }

    .metric-card {
      position: relative;
      min-height: 150px;
      border: 1px solid rgba(255, 255, 255, 0.09);
      border-radius: 8px;
      background: linear-gradient(180deg, rgba(20, 23, 34, 0.9), rgba(12, 14, 22, 0.94));
      padding: 18px;
      overflow: hidden;
      box-shadow: 0 14px 32px rgba(0, 0, 0, 0.24);
    }

    .metric-card.hot {
      background: var(--token-gradient);
      border-color: rgba(255, 255, 255, 0.34);
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.14), 0 18px 52px rgba(239, 110, 219, 0.34);
    }

    .metric-card.soft {
      background: linear-gradient(180deg, rgba(31, 26, 48, 0.92), rgba(14, 17, 26, 0.94));
    }

    .metric-label {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      color: #d8d1e8;
      font-size: 15px;
      line-height: 1.15;
      font-weight: 700;
    }

    .metric-icon {
      width: 18px;
      height: 18px;
      color: #b884ff;
    }

    .metric-card.hot .metric-icon,
    .metric-card.hot .metric-label,
    .metric-card.hot .metric-sub {
      color: white;
    }

    .metric-value {
      margin-top: 26px;
      font-size: 42px;
      line-height: 1;
      font-weight: 780;
      color: #b681ff;
    }

    .metric-card.hot .metric-value {
      color: white;
    }

    .metric-sub {
      margin-top: 8px;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.2;
    }

    .metric-up {
      color: #73f1a2;
    }

    .dashboard-grid {
      display: grid;
      grid-template-columns: 1.1fr 0.9fr;
      gap: 12px;
      margin-top: 14px;
    }

    .panel {
      border: 1px solid rgba(255, 255, 255, 0.09);
      border-radius: 8px;
      background: linear-gradient(180deg, rgba(15, 18, 29, 0.92), rgba(10, 12, 20, 0.96));
      padding: 14px;
      box-shadow: 0 14px 32px rgba(0, 0, 0, 0.22);
    }

    .panel-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 14px;
    }

    .panel-title {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      font-size: 14px;
      font-weight: 760;
    }

    .panel-title svg {
      width: 17px;
      height: 17px;
      color: var(--kiro-pink);
    }

    .weekday-grid {
      display: grid;
      grid-template-columns: 28px 1fr;
      gap: 8px;
    }

    .weekday-labels {
      display: grid;
      grid-template-rows: repeat(7, 11px);
      gap: 4px;
      color: var(--muted);
      font-size: 10px;
    }

    .weekday-labels span:nth-child(even) {
      visibility: hidden;
    }

    .activity-legend {
      display: flex;
      align-items: center;
      gap: 7px;
      margin: 18px 0 4px 28px;
      color: var(--muted);
      font-size: 11px;
    }

    .legend-cells {
      display: flex;
      gap: 4px;
    }

    .legend-cells .cell {
      display: block;
    }

    .insight-cards {
      display: grid;
      gap: 8px;
    }

    .insight-card {
      display: grid;
      grid-template-columns: 28px minmax(0, 1fr) 16px;
      align-items: center;
      gap: 10px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 7px;
      background: rgba(255, 255, 255, 0.035);
      padding: 10px;
    }

    .insight-icon {
      color: #b884ff;
    }

    .insight-copy strong {
      display: block;
      color: var(--text);
      font-weight: 680;
      margin-bottom: 2px;
    }

    .insight-copy span {
      color: var(--muted);
      font-size: 12px;
    }

    .chev {
      color: var(--muted);
    }

    .bottom-grid {
      display: grid;
      grid-template-columns: 0.92fr 1fr;
      gap: 12px;
      margin-top: 12px;
    }

    .full-panel {
      margin-top: 12px;
    }

    .dense-rows {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px 18px;
    }

    .language-tiles {
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 10px;
    }

    .language-tile {
      aspect-ratio: 1;
      min-width: 0;
      border: 1px solid rgba(255, 255, 255, 0.11);
      border-radius: 7px;
      display: grid;
      place-items: center;
      background: rgba(255, 255, 255, 0.045);
      color: #fff;
      font-size: 20px;
      font-weight: 840;
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04);
    }

    .model-list {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .model-row {
      display: grid;
      grid-template-columns: 28px minmax(0, 1fr);
      align-items: center;
      column-gap: 10px;
      row-gap: 5px;
    }

    .model-copy {
      display: grid;
      gap: 2px;
      min-width: 0;
    }

    .model-name {
      color: var(--text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .model-detail {
      color: var(--muted);
      font-size: 11px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    @media (max-width: 620px) {
      .shell {
        min-width: 0;
        padding: 18px 16px 28px;
      }

      .actions {
        gap: 10px;
      }

      .action span {
        display: none;
      }

      .public-toggle span {
        display: inline-flex;
      }

      .hero {
        padding-top: 34px;
      }

      .stats {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .stat + .stat {
        border-left: 0;
      }

      .stat {
        border-top: 1px solid #242424;
      }

      .stat:first-child,
      .stat:nth-child(2) {
        border-top: 0;
      }

      .lower {
        grid-template-columns: 1fr;
        gap: 38px;
      }

      .lower-three {
        grid-template-columns: 1fr;
      }

      .app-header {
        flex-direction: column;
        align-items: flex-start;
      }

      .header-actions {
        align-items: flex-start;
        padding-top: 0;
      }

      .metric-grid,
      .dashboard-grid,
      .bottom-grid,
      .dense-rows {
        grid-template-columns: 1fr;
      }

      .heatmap {
        justify-content: start;
      }
    }
  </style>
</head>
<body>
  <main class="shell">
    <header class="app-header">
      <div class="profile-line">
        <div class="avatar" id="profile-initials">${escapeHtml(data.initials)}</div>
        <div class="profile-meta">
          <div class="name" id="profile-name">${escapeHtml(data.displayName)}</div>
          <div class="handle">
            <span id="profile-account" title="${escapeHtml(data.accountLabel)}">${escapeHtml(data.accountDetail)}</span>
            <span class="badge" id="profile-plan">${escapeHtml(data.planLabel)}</span>
          </div>
        </div>
      </div>
      <div class="header-actions">
        <div class="sync-row">
          <button class="public-toggle ${data.leaderboardPublic ? "is-public" : ""}" title="Toggle public leaderboard profile" id="public-toggle" aria-pressed="${data.leaderboardPublic ? "true" : "false"}"><span id="public-toggle-icon">${data.leaderboardPublic ? globeIcon() : shieldLockIcon()}</span>${data.leaderboardPublic ? "Public" : "Private"}</button>
          <button class="action leaderboard-button" title="Open leaderboard" id="leaderboard">${trophyIcon()}</button>
          <button class="action share-button" title="Save share card" id="share">${shareIcon()}</button>
          <button class="action sync-button" title="Refresh insights" id="refresh">${refreshIcon()}<span>Sync now</span></button>
        </div>
        <div class="sync-subtext"><span id="refresh-status">Last synced just now</span><span class="status-dot"></span></div>
      </div>
    </header>

    <section class="metric-grid" aria-label="Profile stats">
      ${metricCard("Plan / quota", data.planLabel, "From local profile or settings", starIcon(), "soft", "stat-plan")}
      ${metricCard("Kiro opens, 30d", data.kiroOpens30d, "From local launch logs", trendIcon(), "", "stat-opens")}
      ${metricCard("Local sessions", data.localSessions, "Tracked from Kiro sessions", calendarIcon(), "", "stat-sessions")}
      ${metricCard("Credits used", data.totalCredits, "Metered by Kiro billing", cubeLineIcon(), "hot", "stat-credits")}
    </section>

    <section class="stats" aria-label="Profile highlights">
      ${statBlock(data.totalTokens, "Est. tokens", "stat-token", "stat-tokens")}
      ${statBlock(data.currentStreak, "Current streak", "", "stat-current-streak")}
      ${statBlock(data.longestStreak, "Longest streak", "", "stat-longest-streak")}
      ${statBlock(data.peakTokens, "Peak token day", "stat-peak", "stat-peak-tokens")}
      ${statBlock(data.activeDays, "Active days", "", "stat-active-days")}
    </section>

    <section class="dashboard-grid">
      <div class="panel full-panel">
        <div class="panel-head">
          <h2 class="panel-title">${calendarIcon()} Daily activity</h2>
          <div class="activity-controls">
            <select class="year-select" id="year-select" aria-label="Activity year">
              ${data.availableYears.map((year) => `<option value="${year}">${year}</option>`).join("")}
            </select>
          </div>
        </div>
        <div class="weekday-grid">
          <div class="weekday-labels"><span>Mon</span><span></span><span>Wed</span><span></span><span>Fri</span><span></span><span>Sun</span></div>
          <div class="heatmap-wrap">
            <div class="months" id="months"></div>
            <div class="heatmap" id="heatmap"></div>
          </div>
        </div>
        <div class="activity-legend">
          <span>Less activity</span>
          <span class="legend-cells"><span class="cell"></span><span class="cell level-1"></span><span class="cell level-2"></span><span class="cell level-3"></span><span class="cell level-4"></span></span>
          <span>More activity</span>
        </div>
      </div>
    </section>

    <section class="bottom-grid">
      <div class="panel">
        <div class="panel-head">
          <h2 class="panel-title">${statsIcon()} Session quality</h2>
        </div>
        <div class="rows" id="session-stats-list">
          ${simpleRows(data.sessionStats)}
        </div>
      </div>
      <div class="panel">
        <div class="panel-head">
          <h2 class="panel-title">${databaseIcon()} Token breakdown</h2>
        </div>
        <div class="rows" id="token-stats-list">
          ${simpleRows(data.tokenStats)}
        </div>
      </div>
    </section>

    <section class="bottom-grid">
      <div class="panel">
        <div class="panel-head">
          <h2 class="panel-title">${clockIcon()} Activity patterns</h2>
        </div>
        <div class="rows" id="activity-patterns-list">
          ${simpleRows(data.activityPatterns)}
        </div>
      </div>
      <div class="panel">
        <div class="panel-head">
          <h2 class="panel-title">${toolIcon()} Top tools</h2>
        </div>
        <div class="rows" id="tool-stats-list">
          ${simpleRows(data.toolStats)}
        </div>
      </div>
    </section>

    <section class="bottom-grid">
      <div class="panel">
        <div class="panel-head">
          <h2 class="panel-title">${cubeLineIcon()} Most used models</h2>
        </div>
        <div class="model-list" id="models-list">
          ${modelRows(data.modelItems)}
        </div>
      </div>
      <div class="panel">
        <div class="panel-head">
          <h2 class="panel-title">${codeIcon()} Top languages</h2>
        </div>
        <div class="rows" id="languages-list">
          ${topItemRows(data.topItems)}
        </div>
      </div>
    </section>

    <section class="bottom-grid">
      <div class="panel">
        <div class="panel-head">
          <h2 class="panel-title">${settingsIcon()} Kiro setup</h2>
        </div>
        <div class="rows" id="system-stats-list">
          ${simpleRows(data.systemStats)}
        </div>
      </div>
      <div class="panel">
        <div class="panel-head">
          <h2 class="panel-title">${bulbIcon()} Data sources</h2>
        </div>
        <div class="rows" id="data-sources-list">
          ${simpleRows(data.dataSources)}
        </div>
      </div>
    </section>
  </main>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    let data = ${encoded};
    const heatmap = document.getElementById("heatmap");
    const yearSelect = document.getElementById("year-select");
    const refreshButton = document.getElementById("refresh");
    const refreshStatus = document.getElementById("refresh-status");
    const leaderboardButton = document.getElementById("leaderboard");
    const publicToggleButton = document.getElementById("public-toggle");

    function formatCompact(value) {
      if (value >= 1000000) return (value / 1000000).toFixed(1) + "M";
      if (value >= 1000) return (value / 1000).toFixed(1) + "K";
      return String(Math.round(value));
    }

    function pointsForYear(year) {
      return data.heatmap.filter((point) => point.date.startsWith(String(year) + "-"));
    }

    function renderHeatmap(year) {
      heatmap.innerHTML = "";
      const monthsEl = document.getElementById("months");
      monthsEl.innerHTML = "";
      const points = pointsForYear(year);
      const max = Math.max(1, ...points.map((point) => point.count));
      heatmap.style.gridTemplateRows = "repeat(7, 11px)";

      let offset = 0;
      if (points.length > 0) {
        const jan1 = new Date(points[0].date);
        const dow = jan1.getDay();
        offset = dow === 0 ? 6 : dow - 1;
        for (let i = 0; i < offset; i++) {
          const pad = document.createElement("span");
          pad.className = "cell";
          pad.style.visibility = "hidden";
          heatmap.appendChild(pad);
        }
      }

      const cell = 15;
      const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      let lastMonth = -1;

      points.forEach((point, index) => {
        const cellEl = document.createElement("span");
        const ratio = point.count / max;
        const level = point.count <= 0 ? 0 : ratio > 0.75 ? 4 : ratio > 0.45 ? 3 : ratio > 0.2 ? 2 : 1;
        cellEl.className = "cell level-" + level;
        cellEl.title = point.count > 0
          ? point.date + " - " + formatCompact(point.count) + " tokens"
          : point.date + " - no activity";
        heatmap.appendChild(cellEl);

        const d = new Date(point.date);
        const month = d.getMonth();
        if (month !== lastMonth) {
          lastMonth = month;
          const totalCells = offset + index;
          const col = Math.floor(totalCells / 7);
          const label = document.createElement("span");
          label.textContent = monthNames[month];
          label.style.left = (col * cell) + "px";
          monthsEl.appendChild(label);
        }
      });
    }

    function escapeHtml(value) {
      return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function languageShortName(language) {
      const direct = {
        TypeScript: "TS",
        JavaScript: "JS",
        Markdown: "MD",
        Python: "PY",
        JSON: "{}",
        YAML: "Y",
        HTML: "<>",
        CSS: "#",
        Rust: "RS",
        Go: "GO",
        Java: "JV"
      };
      return direct[language] || String(language).slice(0, 2).toUpperCase();
    }

    function insightRow(item) {
      return '<div class="row"><span>' + escapeHtml(item.name) + '</span><strong>' + escapeHtml(item.value) + '</strong></div>';
    }

    function topItemRow(item) {
      return '<div class="language-tile" title="' + escapeHtml(item.name + " - " + item.value) + '">' + escapeHtml(languageShortName(item.name)) + '</div>';
    }

    function pluginRow(item) {
      return '<div class="row plugin"><span class="lang-icon">' + escapeHtml(languageShortName(item.name)) + '</span><span class="plugin-name">' + escapeHtml(item.name) + '</span><span>' + escapeHtml(item.value) + '</span></div>';
    }

    function iconSvg(name) {
      const icons = {
        calendar: '${calendarIcon()}',
        trend: '${trendIcon()}',
        flame: '${flameIcon()}',
        cube: '${cubeLineIcon()}'
      };
      return icons[name] || icons.trend;
    }

    function insightCards(nextData) {
      const language = nextData.insights.find((item) => item.name === "Most used language")?.value || "Unknown";
      const peak = nextData.insights.find((item) => item.name === "Peak token day")?.value || nextData.peakTokens;
      const sessions = nextData.insights.find((item) => item.name === "Local Kiro sessions")?.value || nextData.localSessions;
      const streak = nextData.insights.find((item) => item.name === "Longest streak")?.value || nextData.currentStreak;
      return [
        { icon: "calendar", title: "You used Kiro across " + nextData.kiroOpens30d + " launches.", detail: "Local sessions tracked: " + sessions + "." },
        { icon: "trend", title: "Your top workspace language is " + language + ".", detail: "Language mix is based on files in this workspace." },
        { icon: "cube", title: "Peak daily activity reached " + peak + " tokens.", detail: "Token activity comes from Kiro local logs when available." },
        { icon: "flame", title: "You've been on a " + streak + " best streak.", detail: "Keep up the momentum!" }
      ].map((item) => '<div class="insight-card"><span class="insight-icon">' + iconSvg(item.icon) + '</span><span class="insight-copy"><strong>' + escapeHtml(item.title) + '</strong><span>' + escapeHtml(item.detail) + '</span></span><span class="chev">›</span></div>').join("");
    }

    function modelRows(items) {
      return items.map((item) => {
        const iconSvg = '<svg viewBox="0 0 24 24" fill="none"><path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 12 3 7M12 12l9-5M12 12v10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        return '<div class="model-row">' +
          '<span class="lang-icon model-icon">' + iconSvg + '</span>' +
          '<span class="model-copy"><span class="model-name">' + escapeHtml(item.name) + '</span><span class="model-detail">' + escapeHtml(item.value) + '</span></span>' +
          '</div>';
      }).join("");
    }

    function updateYearOptions(nextData) {
      const previousYear = yearSelect.value;
      yearSelect.innerHTML = "";
      for (const year of nextData.availableYears) {
        const option = document.createElement("option");
        option.value = String(year);
        option.textContent = String(year);
        yearSelect.appendChild(option);
      }
      yearSelect.value = nextData.availableYears.includes(Number(previousYear)) ? previousYear : String(nextData.availableYears[0]);
    }

    function setText(id, value) {
      const node = document.getElementById(id);
      if (node) node.textContent = value;
    }

    function updateProfile(nextData) {
      data = nextData;
      setText("profile-initials", data.initials);
      setText("profile-name", data.displayName);
      setText("profile-account", data.accountDetail);
      setText("profile-plan", data.planLabel);
      setText("stat-plan", data.planLabel);
      setText("stat-opens", data.kiroOpens30d);
      setText("stat-sessions", data.localSessions);
      setText("stat-tokens", data.totalTokens);
      setText("stat-credits", data.totalCredits);
      setText("stat-current-streak", data.currentStreak);
      setText("stat-longest-streak", data.longestStreak);
      setText("stat-peak-tokens", data.peakTokens);
      setText("stat-active-days", data.activeDays);
      document.getElementById("models-list").innerHTML = modelRows(data.modelItems);
      document.getElementById("session-stats-list").innerHTML = data.sessionStats.map(insightRow).join("");
      document.getElementById("token-stats-list").innerHTML = data.tokenStats.map(insightRow).join("");
      document.getElementById("activity-patterns-list").innerHTML = data.activityPatterns.map(insightRow).join("");
      document.getElementById("tool-stats-list").innerHTML = data.toolStats.map(insightRow).join("");
      document.getElementById("languages-list").innerHTML = data.topItems.map(pluginRow).join("");
      document.getElementById("system-stats-list").innerHTML = data.systemStats.map(insightRow).join("");
      document.getElementById("data-sources-list").innerHTML = data.dataSources.map(insightRow).join("");
      updatePublicToggle();
      updateYearOptions(data);
      renderHeatmap(yearSelect.value);
    }

    function updatePublicToggle() {
      publicToggleButton.classList.toggle("is-public", Boolean(data.leaderboardPublic));
      publicToggleButton.setAttribute("aria-pressed", data.leaderboardPublic ? "true" : "false");
      publicToggleButton.innerHTML = '<span id="public-toggle-icon">' + (data.leaderboardPublic ? '${globeIcon()}' : '${shieldLockIcon()}') + '</span>' + (data.leaderboardPublic ? 'Public' : 'Private');
      publicToggleButton.title = data.leaderboardPublic
        ? "Profile is public and syncs on refresh"
        : "Profile is private and does not sync";
    }

    function buildLeaderboardUrl() {
      let url;
      try {
        url = new URL(data.leaderboardUrl || "http://localhost:3000");
      } catch {
        url = new URL("http://localhost:3000");
      }

      url.searchParams.set("name", data.displayName || "Kiro Developer");
      url.searchParams.set("handle", data.accountLabel || data.username || "Local");
      url.searchParams.set("tokens", String(Math.max(0, Math.round(Number(data.totalTokensRaw) || 0))));
      return url.toString();
    }

    yearSelect.addEventListener("change", () => renderHeatmap(yearSelect.value));
    updatePublicToggle();
    renderHeatmap(yearSelect.value);

    window.addEventListener("message", (event) => {
      if (event.data?.type === "profile-data") {
        updateProfile(event.data.data);
        refreshButton.classList.remove("is-loading");
        refreshStatus.textContent = "Updated";
        window.setTimeout(() => {
          refreshStatus.textContent = "";
        }, 1400);
      }
    });

    refreshButton.addEventListener("click", () => {
      refreshButton.classList.add("is-loading");
      refreshStatus.textContent = "Refreshing";
      vscode.postMessage({ type: "refresh" });
    });

    leaderboardButton.addEventListener("click", () => {
      vscode.postMessage({ type: "open-leaderboard", url: buildLeaderboardUrl() });
    });

    publicToggleButton.addEventListener("click", () => {
      const nextValue = !data.leaderboardPublic;
      publicToggleButton.innerHTML = '<span id="public-toggle-icon">' + (nextValue ? '${globeIcon()}' : '${shieldLockIcon()}') + '</span>' + (nextValue ? 'Publishing' : 'Private');
      refreshStatus.textContent = nextValue ? "Publishing" : "Removing";
      vscode.postMessage({ type: "set-leaderboard-public", enabled: nextValue });
    });

    document.getElementById("share").addEventListener("click", async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1400;
      canvas.height = 800;
      const ctx = canvas.getContext("2d");
      
      // Modern gradient background
      const bgGradient = ctx.createRadialGradient(700, 0, 100, 700, 800, 900);
      bgGradient.addColorStop(0, "#2d1b4e");
      bgGradient.addColorStop(0.4, "#1a0f2e");
      bgGradient.addColorStop(1, "#0d0614");
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Add glow effects
      const glowGradient1 = ctx.createRadialGradient(200, 150, 0, 200, 150, 300);
      glowGradient1.addColorStop(0, "rgba(111, 69, 255, 0.15)");
      glowGradient1.addColorStop(1, "rgba(111, 69, 255, 0)");
      ctx.fillStyle = glowGradient1;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const glowGradient2 = ctx.createRadialGradient(1100, 600, 0, 1100, 600, 400);
      glowGradient2.addColorStop(0, "rgba(239, 110, 219, 0.12)");
      glowGradient2.addColorStop(1, "rgba(239, 110, 219, 0)");
      ctx.fillStyle = glowGradient2;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Top accent bar
      const accentGradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
      accentGradient.addColorStop(0, "#6f45ff");
      accentGradient.addColorStop(0.5, "#a557ff");
      accentGradient.addColorStop(1, "#ef6edb");
      ctx.fillStyle = accentGradient;
      ctx.fillRect(0, 0, canvas.width, 8);
      
      // Avatar with glow
      ctx.shadowColor = "rgba(165, 87, 255, 0.6)";
      ctx.shadowBlur = 30;
      const avatarGradient = ctx.createLinearGradient(70, 60, 190, 180);
      avatarGradient.addColorStop(0, "#4b2cff");
      avatarGradient.addColorStop(0.5, "#9d4dff");
      avatarGradient.addColorStop(1, "#ef6edb");
      ctx.fillStyle = avatarGradient;
      ctx.beginPath();
      ctx.arc(130, 120, 60, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      
      // Initials
      ctx.fillStyle = "#fff";
      ctx.font = "700 48px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(data.initials, 130, 135);
      
      // Name and username
      ctx.textAlign = "left";
      ctx.font = "800 54px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(data.displayName, 220, 110);
      
      ctx.font = "400 28px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
      ctx.fillStyle = "#9ba3b4";
      ctx.fillText(data.accountDetail, 220, 150);
      
      // Badge
      ctx.fillStyle = "rgba(165, 87, 255, 0.25)";
      ctx.strokeStyle = "rgba(165, 87, 255, 0.5)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      const badgeX = 220 + ctx.measureText(data.accountDetail).width + 16;
      const badgeWidth = Math.max(90, ctx.measureText(data.planLabel).width + 32);
      ctx.roundRect(badgeX, 128, badgeWidth, 32, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#d4b3ff";
      ctx.font = "600 18px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
      ctx.fillText(data.planLabel, badgeX + 16, 150);
      
      // "Kiro Stat" subtitle
      ctx.font = "500 20px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
      ctx.fillStyle = "#6b7280";
      ctx.fillText("Kiro Stat", 220, 182);
      
      // Featured stats - Only the most impressive ones
      const featuredStats = [
        { label: "Credits Used", value: data.totalCredits, icon: "⚡", gradient: true },
        { label: "Est. Tokens", value: data.totalTokens, icon: "🎯", gradient: true },
        { label: "Kiro Opens (30d)", value: data.kiroOpens30d, icon: "🚀", gradient: false }
      ];
      
      // Large featured cards
      featuredStats.forEach((stat, index) => {
        const x = 70 + index * 430;
        const y = 260;
        const w = 400;
        const h = 180;
        
        ctx.shadowColor = stat.gradient ? "rgba(165, 87, 255, 0.4)" : "rgba(0, 0, 0, 0.3)";
        ctx.shadowBlur = stat.gradient ? 40 : 20;
        ctx.shadowOffsetY = 10;
        
        if (stat.gradient) {
          const cardGradient = ctx.createLinearGradient(x, y, x + w, y + h);
          cardGradient.addColorStop(0, "#4b2cff");
          cardGradient.addColorStop(0.5, "#9d4dff");
          cardGradient.addColorStop(1, "#ef6edb");
          ctx.fillStyle = cardGradient;
        } else {
          ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
        }
        
        ctx.strokeStyle = stat.gradient ? "rgba(255, 255, 255, 0.3)" : "rgba(255, 255, 255, 0.15)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 20);
        ctx.fill();
        ctx.stroke();
        
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        
        // Icon emoji
        ctx.font = "48px sans-serif";
        ctx.fillText(stat.icon, x + 28, y + 60);
        
        // Value
        ctx.fillStyle = "#ffffff";
        ctx.font = "900 68px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(stat.value, x + 28, y + 130);
        
        // Label
        ctx.fillStyle = stat.gradient ? "rgba(255, 255, 255, 0.85)" : "#9ba3b4";
        ctx.font = "600 22px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
        ctx.fillText(stat.label, x + 28, y + 162);
      });
      
      // Bottom stats row - smaller cards
      const bottomStats = [
        { label: "Top Model", value: data.modelItems[0]?.name || "Auto", icon: "🤖" },
        { label: "Hooks", value: data.systemStats.find((item) => item.name === "Hooks Installed")?.value || "0", icon: "H" },
        { label: "Powers", value: data.systemStats.find((item) => item.name === "Powers Installed")?.value || "0", icon: "P" },
        { label: "Extensions", value: data.systemStats.find((item) => item.name === "Extensions Installed")?.value || "0", icon: "E" }
      ];
      
      bottomStats.forEach((stat, index) => {
        const x = 70 + index * 322;
        const y = 500;
        const w = 292;
        const h = 140;
        
        ctx.shadowColor = "rgba(0, 0, 0, 0.2)";
        ctx.shadowBlur = 15;
        ctx.shadowOffsetY = 8;
        
        ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
        ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 16);
        ctx.fill();
        ctx.stroke();
        
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        
        // Icon
        ctx.font = "36px sans-serif";
        ctx.fillText(stat.icon, x + 24, y + 52);
        
        // Value
        ctx.fillStyle = "#ffffff";
        ctx.font = "700 42px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
        const valueText = String(stat.value).length > 15 ? String(stat.value).substring(0, 15) + "..." : stat.value;
        ctx.fillText(valueText, x + 24, y + 94);
        
        // Label
        ctx.fillStyle = "#9ba3b4";
        ctx.font = "500 18px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
        ctx.fillText(stat.label, x + 24, y + 118);
      });
      
      // Footer watermark
      ctx.fillStyle = "rgba(155, 163, 180, 0.4)";
      ctx.font = "400 16px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Generated with Kiro Stat • 100% Local & Private", canvas.width / 2, 730);
      
      const dataUrl = canvas.toDataURL("image/png");
      let copied = false;
      let copiedText = false;
      
      try {
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
        if (blob && navigator.clipboard && window.ClipboardItem) {
          await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
          copied = true;
        }
      } catch {
        copied = false;
      }
      
      if (!copied && navigator.clipboard) {
        try {
          await navigator.clipboard.writeText([
            data.displayName + " - Kiro Stat",
            data.accountDetail + " · " + data.planLabel,
            "⚡ " + data.totalCredits + " credits used",
            "🎯 " + data.totalTokens + " est. tokens",
            "⚡ " + data.peakTokens + " peak token day",
            "🚀 " + data.kiroOpens30d + " Kiro opens (30d)",
            "🔥 " + data.currentStreak + " current streak",
            "💻 " + (data.insights.find((item) => item.name === "Most used language")?.value || "Unknown") + " top language",
            "🤖 " + (data.modelItems[0]?.name || "Auto") + " top model"
          ].join("\\n"));
          copiedText = true;
        } catch {
          copiedText = false;
        }
      }
      
      vscode.postMessage({
        type: "share-card",
        payload: {
          fileName: "kiro-profile-" + Date.now() + ".png",
          dataUrl,
          copiedToClipboard: copied,
          copiedTextFallback: copiedText
        }
      });
    });
  </script>
</body>
</html>`;
}

function statBlock(value: string, label: string, className = "", valueId = ""): string {
  const classes = ["stat", className].filter(Boolean).join(" ");
  const idAttribute = valueId ? ` id="${escapeHtml(valueId)}"` : "";
  return `<div class="${classes}"><div class="stat-value"${idAttribute}>${escapeHtml(value)}</div><div class="stat-label">${escapeHtml(label)}</div></div>`;
}

function metricCard(label: string, value: string, subtext: string, icon: string, className = "", valueId = ""): string {
  const classes = ["metric-card", className].filter(Boolean).join(" ");
  const idAttribute = valueId ? ` id="${escapeHtml(valueId)}"` : "";
  return `<article class="${classes}"><div class="metric-label"><span>${escapeHtml(label)}</span><span class="metric-icon">${icon}</span></div><div class="metric-value"${idAttribute}>${escapeHtml(value)}</div><div class="metric-sub">${subtext.startsWith("+") || subtext.includes("%") ? `<span class="metric-up">${escapeHtml(subtext)}</span>` : escapeHtml(subtext)}</div></article>`;
}

function insightRow(item: NamedMetric): string {
  return `<div class="row"><span>${escapeHtml(item.name)}</span><strong>${escapeHtml(item.value)}</strong></div>`;
}

function insightCards(data: ProfileData): string {
  const language = data.insights.find((item) => item.name === "Most used language")?.value || "Unknown";
  const peak = data.insights.find((item) => item.name === "Peak token day")?.value || data.peakTokens;
  const sessions = data.insights.find((item) => item.name === "Local Kiro sessions")?.value || data.localSessions;
  const streak = data.insights.find((item) => item.name === "Longest streak")?.value || data.currentStreak;
  const items = [
    { icon: calendarIcon(), title: `You used Kiro across ${data.kiroOpens30d} launches.`, detail: `Local sessions tracked: ${sessions}.` },
    { icon: trendIcon(), title: `Your top workspace language is ${language}.`, detail: "Language mix is based on files in this workspace." },
    { icon: cubeLineIcon(), title: `Peak daily activity reached ${peak} tokens.`, detail: "Token activity comes from Kiro local logs when available." },
    { icon: flameIcon(), title: `You've been on a ${streak} best streak.`, detail: "Keep up the momentum!" }
  ];
  return items.map((item) => `<div class="insight-card"><span class="insight-icon">${item.icon}</span><span class="insight-copy"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.detail)}</span></span><span class="chev">›</span></div>`).join("");
}

function topItemRow(item: NamedMetric): string {
  return `<div class="row plugin"><span class="lang-icon">${escapeHtml(languageShortName(item.name))}</span><span class="plugin-name">${escapeHtml(item.name)}</span><span>${escapeHtml(item.value)}</span></div>`;
}

function topItemRows(items: NamedMetric[]): string {
  return items.map(topItemRow).join("");
}

function languageTiles(items: NamedMetric[]): string {
  return items.slice(0, 6).map((item) => `<div class="language-tile" title="${escapeHtml(`${item.name} - ${item.value}`)}">${escapeHtml(languageShortName(item.name))}</div>`).join("");
}

function modelItemRow(item: NamedMetric): string {
  return `<div class="row plugin"><span class="lang-icon model-icon">${modelIcon()}</span><span class="plugin-name">${escapeHtml(item.name)}</span><span>${escapeHtml(item.value)}</span></div>`;
}

function modelRows(items: NamedMetric[]): string {
  return items.map((item) => `<div class="model-row">` +
      `<span class="lang-icon model-icon">${modelIcon()}</span>` +
      `<span class="model-copy"><span class="model-name">${escapeHtml(item.name)}</span><span class="model-detail">${escapeHtml(item.value)}</span></span>` +
      `</div>`).join("");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getNonce(): string {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i += 1) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function shareIcon(): string {
  return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v4.5A1.5 1.5 0 0 0 6.5 20h13a1.5 1.5 0 0 0 1.5-1.5V14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function trophyIcon(): string {
  return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 4h8v3.5A4 4 0 0 1 12 11.5 4 4 0 0 1 8 7.5V4Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 6H5.5A1.5 1.5 0 0 0 4 7.5v.7A3.8 3.8 0 0 0 8.2 12M16 6h2.5A1.5 1.5 0 0 1 20 7.5v.7A3.8 3.8 0 0 1 15.8 12M12 11.5V17M8.5 20h7M10 17h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function shieldLockIcon(): string {
  return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3.2 5.5 5.6v5.2c0 4.2 2.6 7.7 6.5 9.2 3.9-1.5 6.5-5 6.5-9.2V5.6L12 3.2Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9.5 12h5v4h-5v-4ZM10.5 12v-1.2a1.5 1.5 0 0 1 3 0V12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function globeIcon(): string {
  return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" stroke="currentColor" stroke-width="1.8"/><path d="M3.6 9h16.8M3.6 15h16.8M12 3c2.2 2.4 3.2 5.3 3.2 9S14.2 18.6 12 21M12 3C9.8 5.4 8.8 8.3 8.8 12s1 6.6 3.2 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
}

function lockIcon(): string {
  return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 10V8a5 5 0 0 1 10 0v2M6.5 10h11A1.5 1.5 0 0 1 19 11.5v7A1.5 1.5 0 0 1 17.5 20h-11A1.5 1.5 0 0 1 5 18.5v-7A1.5 1.5 0 0 1 6.5 10Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
}

function unlockIcon(): string {
  return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 10V7.8a4.3 4.3 0 0 1 8.1-2M6.5 10h11A1.5 1.5 0 0 1 19 11.5v7A1.5 1.5 0 0 1 17.5 20h-11A1.5 1.5 0 0 1 5 18.5v-7A1.5 1.5 0 0 1 6.5 10Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
}

function refreshIcon(): string {
  return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 12a8 8 0 0 1-13.2 6.1M4 12A8 8 0 0 1 17.2 5.9M17.2 5.9H13m4.2 0V2M6.8 18.1H11m-4.2 0V22" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function calendarIcon(): string {
  return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 3v4M17 3v4M4.5 9h15M6.5 5h11A2.5 2.5 0 0 1 20 7.5v11A2.5 2.5 0 0 1 17.5 21h-11A2.5 2.5 0 0 1 4 18.5v-11A2.5 2.5 0 0 1 6.5 5Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
}

function trendIcon(): string {
  return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 17 9 12l4 4 7-9M15 7h5v5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 21v-3M10 21v-7M15 21v-5M20 21V9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity=".55"/></svg>`;
}

function starIcon(): string {
  return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 3 2.5 6 6.5.5-5 4.2 1.5 6.3-5.5-3.4L6.5 20 8 13.7 3 9.5 9.5 9 12 3Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`;
}

function flameIcon(): string {
  return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12.5 21c4 0 7-2.7 7-6.7 0-3-1.8-5.1-3.5-6.8-.5 2.2-1.8 3.4-3.2 4.1.4-3.1-1.2-5.8-4-8.1.1 4.2-4.3 5.7-4.3 10.8C4.5 18 7.4 21 12.5 21Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
}

function bulbIcon(): string {
  return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 18h6M10 22h4M8.5 14.5c-1.5-1.1-2.5-2.9-2.5-5A6 6 0 0 1 18 9.5c0 2.1-1 3.9-2.5 5-.8.6-1.1 1.2-1.1 2H9.6c0-.8-.3-1.4-1.1-2Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function codeIcon(): string {
  return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function cubeIcon(): string {
  return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 12 3 7M12 12l9-5M12 12v10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function statsIcon(): string {
  return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="2.5" stroke="currentColor" stroke-width="1.8"/><path d="M12 5V3M12 21v-2M19 12h2M3 12h2M16.5 16.5l1.5 1.5M6 6l1.5 1.5M16.5 7.5 18 6M6 18l1.5-1.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
}

function clockIcon(): string {
  return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v5l3 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function toolIcon(): string {
  return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M13 10 18.5 4.5a2.1 2.1 0 1 1 3 3L16 13M6 13l-1.4 1.4a2 2 0 0 0 0 2.8l2.2 2.2a2 2 0 0 0 2.8 0L11 18M9 11l4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function settingsIcon(): string {
  return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10.3 3.5h3.4l.8 2.2c.3.1.6.3.9.5l2.1-.8 1.7 3-1.5 1.7c0 .3.1.6.1.9 0 .3 0 .6-.1.9l1.5 1.7-1.7 3-2.1-.8c-.3.2-.6.4-.9.5l-.8 2.2h-3.4l-.8-2.2c-.3-.1-.6-.3-.9-.5l-2.1.8-1.7-3 1.5-1.7c0-.3-.1-.6-.1-.9 0-.3 0-.6.1-.9L5.8 9.4l1.7-3 2.1.8c.3-.2.6-.4.9-.5l.8-2.2Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.5" stroke="currentColor" stroke-width="1.8"/></svg>`;
}

function databaseIcon(): string {
  return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><ellipse cx="12" cy="5" rx="7" ry="3" stroke="currentColor" stroke-width="1.8"/><path d="M5 5v7c0 1.7 3.1 3 7 3s7-1.3 7-3V5M5 12v7c0 1.7 3.1 3 7 3s7-1.3 7-3v-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
}

function simpleRows(items: NamedMetric[]): string {
  return items.map((item) => `<div class="row"><span>${escapeHtml(item.name)}</span><strong>${escapeHtml(item.value)}</strong></div>`).join("");
}
function cubeLineIcon(): string {
  return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 3 7 4v8l-7 4-7-4V7l7-4Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M5 7l7 4 7-4M12 11v8" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`;
}

function sparkIcon(): string {
  return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2.8 14.5 9l6.7 1-4.9 4.5 1.2 6.5L12 17.8 6.5 21l1.2-6.5L2.8 10l6.7-1L12 2.8Z" fill="white"/></svg>`;
}

function modelIcon(): string {
  return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3.2 18.8 7v7.8L12 20.8l-6.8-6V7L12 3.2Z" fill="white" opacity=".95"/><path d="M8.4 9.2h7.2M8.4 12h7.2M8.4 14.8h4.8" stroke="#4b3fd9" stroke-width="1.7" stroke-linecap="round"/></svg>`;
}

function languageShortName(language: string): string {
  const direct = new Map<string, string>([
    ["TypeScript", "TS"],
    ["JavaScript", "JS"],
    ["Markdown", "MD"],
    ["Python", "PY"],
    ["JSON", "{}"],
    ["YAML", "Y"],
    ["HTML", "<>"],
    ["CSS", "#"],
    ["Rust", "RS"],
    ["Go", "GO"],
    ["Java", "JV"],
    ["No code files yet", "--"]
  ]);
  return direct.get(language) || language.slice(0, 2).toUpperCase();
}

function formatModelName(model: string): string {
  if (model.toLowerCase() === "auto") {
    return "Auto";
  }
  if (model.toLowerCase() === "claude-sonnet-4.5") {
    return "Claude Sonnet 4.5";
  }
  if (model.toLowerCase() === "claude-sonnet-4") {
    return "Claude Sonnet 4";
  }
  if (model.toLowerCase() === "qdev") {
    return "Amazon Q Developer";
  }
  return model
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
