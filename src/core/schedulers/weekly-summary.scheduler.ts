import cron, { type ScheduledTask } from "node-cron";
import { sendMessageToGroup } from "../whatsapp/send-message";
import { GroupService } from "../../database/services/GroupService/group.service";
import { WeeklySummaryReportService } from "../../database/services/WeeklySummaryReportService/weekly-summary-report.service";
import logger from "../../shared/utils/logger/logger";
import type { SummaryService } from "../summary/summary.service";
import { GroupSummaryConfigService } from "../../database/services/GroupSummaryConfigService/groupSummaryConfig.service";
import { MessageHistoryService } from "../../database/services/MessageHistoryService/messageHistory.service";

const SUMMARY_CRON = "50 16 * * 5"; // Fridays, 16:50 (in the configured timezone)
const MAX_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export interface RunOptions {
  /**
   * Generate and save the report but do NOT send it to WhatsApp and do NOT
   * move `lastSummaryAt`. Lets you test the whole pipeline without a
   * WhatsApp connection and without "consuming" the week.
   */
  dryRun?: boolean;
  /** Process only this group (full JID, e.g. 1203...@g.us). */
  groupJid?: string;
}

/**
 * Generates and sends the weekly report of every group that opted in with
 * /setsummaryprompt.
 *
 * This is not a command, so /globaldisable can't switch it off. Two gates
 * exist instead:
 *  - per group: the GroupSummaryConfig document (its existence = enabled);
 *  - global: WEEKLY_SUMMARY_ENABLED=false, checked in bootstrap, which
 *    prevents the scheduler from being created at all.
 */
export class WeeklySummaryScheduler {
  private task?: ScheduledTask;
  private running = false;

  constructor(
    private readonly summaryService: SummaryService,
    private readonly configService: GroupSummaryConfigService = new GroupSummaryConfigService(),
    private readonly groupService: GroupService = new GroupService(),
    private readonly historyService: MessageHistoryService = new MessageHistoryService(),
    private readonly reportService: WeeklySummaryReportService = new WeeklySummaryReportService(),
    private readonly timezone = "America/Bogota",
  ) { }

  start(): void {
    this.task = cron.schedule(
      SUMMARY_CRON,
      () => {
        this.runWeeklySummaries().catch((error) => {
          logger.error("[WeeklySummary] Unhandled scheduler error", { error });
        });
      },
      { timezone: this.timezone },
    );

    logger.info(
      `📅 [WeeklySummary] Scheduler registered — fires every Friday at 16:50 (${this.timezone})`,
    );
  }

  stop(): void {
    this.task?.stop();
    this.task = undefined;
    logger.info("[WeeklySummary] Scheduler stopped");
  }

  /**
   * Runs one pass over the eligible groups. Also used for manual runs
   * (see src/scripts/run-weekly-summary.ts).
   */
  async runWeeklySummaries(options: RunOptions = {}): Promise<void> {
    if (this.running) {
      logger.warn("[WeeklySummary] A run is already in progress — skipping");
      return;
    }

    this.running = true;
    try {
      logger.info(
        `[WeeklySummary] Starting run${options.dryRun ? " (dry run)" : ""}...`,
      );

      const configs = (await this.configService.findAll()).filter(
        (config) =>
          !options.groupJid || config.groupWhatsappId === options.groupJid,
      );

      if (configs.length === 0) {
        logger.info("[WeeklySummary] No configured groups — nothing to do");
        return;
      }

      const until = new Date();
      const currentDate = this.formatCurrentDate(until);

      // Sequential on purpose: don't hammer Gemini and WhatsApp at once.
      for (const config of configs) {
        await this.processGroup(
          config.groupWhatsappId,
          config.promptTemplate,
          config.lastSummaryAt,
          until,
          currentDate,
          options.dryRun ?? false,
        );
      }

      logger.info("[WeeklySummary] Run complete");
    } finally {
      this.running = false;
    }
  }

  private async processGroup(
    groupWhatsappId: string,
    promptTemplate: string,
    lastSummaryAt: Date | null,
    until: Date,
    currentDate: string,
    dryRun: boolean,
  ): Promise<void> {
    const label = `[WeeklySummary:${groupWhatsappId}]`;

    try {
      const group = await this.groupService.findByWhatsappId(groupWhatsappId);
      if (!group) {
        logger.warn(`${label} Group no longer registered — skipping`);
        return;
      }
      if (group.status !== "approved") {
        logger.info(`${label} Group status is "${group.status}" — skipping`);
        return;
      }

      // Window: since the last successful report, but never more than 7 days
      // back. A double run (or a retry after a failure) therefore doesn't
      // repeat messages that were already summarized and sent.
      const weekAgo = new Date(until.getTime() - MAX_WINDOW_MS);
      const since =
        lastSummaryAt && lastSummaryAt > weekAgo ? lastSummaryAt : weekAgo;

      const history = await this.historyService.buildWeeklyHistory(
        groupWhatsappId,
        since,
        until,
      );

      if (!history) {
        logger.info(`${label} No messages in the period — skipping`);
        return;
      }

      logger.info(`${label} Requesting Gemini summary...`);
      const summary = await this.summaryService.generateWeeklySummary({
        groupName: group.name,
        currentDate,
        weeklyHistory: history,
        promptTemplate,
      });

      // Saved BEFORE sending: if delivery fails we keep the Gemini output.
      const reportId = await this.reportService.save({
        groupWhatsappId,
        periodStart: since,
        periodEnd: until,
        content: summary,
        model: this.summaryService.modelName,
      });

      if (dryRun) {
        logger.info(
          `${label} Dry run — report saved (${reportId}), NOT sent to WhatsApp`,
        );
        return;
      }

      logger.info(`${label} Sending summary to the group...`);
      await sendMessageToGroup(groupWhatsappId, summary);

      // NOTE: sendMessageToGroup currently swallows its own errors (try/catch
      // without rethrow), so reaching this line does not prove WhatsApp
      // accepted the message. Once it returns a boolean, check it here and
      // skip these two calls when it is false.
      await this.reportService.markDelivered(reportId);
      await this.configService.markSummarized(groupWhatsappId, until);

      logger.info(`${label} Done`);
    } catch (error) {
      // Log and move on: one failing group must not stop the others.
      logger.error(`${label} Failed`, { error });
    }
  }

  private formatCurrentDate(date: Date): string {
    return date.toLocaleDateString("es-CO", {
      timeZone: this.timezone,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}
