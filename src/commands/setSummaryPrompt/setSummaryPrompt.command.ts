import type { proto } from "baileys";
import { sendMessageToGroup } from "../../core/whatsapp/send-message";
import { GroupService } from "../../database/services/GroupService/group.service";
import type { CommandHandler } from "../interfaces/command.interface";
import { GroupSummaryConfigService } from "../../database/services/GroupSummaryConfigService/groupSummaryConfig.service";

const REQUIRED_PLACEHOLDERS = ["{{CURRENT_DATE}}", "{{WEEKLY_HISTORY}}"];

/**
 * /setsummaryprompt @<groupJid> <prompt text>
 *
 * Owner-only. Unlike the other commands, it does NOT act on the chat it was
 * sent from: it targets the group given as the first argument, because it
 * is meant to be run from the owner's DM with the bot (where `groupJid`, as
 * passed by HandleCommand, is the owner's own chat). The reply goes back to
 * that same chat.
 *
 * The first successful run for a group also ENABLES its weekly report and
 * starts logging that group's message text from that moment on.
 *
 * Example:
 *   /setsummaryprompt @120363045678901234 Resume la semana... {{CURRENT_DATE}} ... {{WEEKLY_HISTORY}}
 */
export class SetSummaryPromptCommand implements CommandHandler {
  command = "/setsummaryprompt";
  description =
    "Sets the weekly-summary prompt for a group, by JID (owner only)";
  requiresOwner = true;

  constructor(
    private readonly summaryConfigService: GroupSummaryConfigService = new GroupSummaryConfigService(),
    private readonly groupService: GroupService = new GroupService(),
  ) { }

  async execute(
    message: string,
    groupJid: string,
    _senderJid: string,
    _msgObj?: proto.IWebMessageInfo,
  ): Promise<void> {
    const rest = message.slice(this.command.length).trim();
    const usage = `Uso: ${this.command} @<groupJid> <prompt>\nEl prompt debe incluir ${REQUIRED_PLACEHOLDERS.join(" y ")}.`;

    const firstSpaceIndex = rest.search(/\s/);
    if (!rest || firstSpaceIndex === -1) {
      await sendMessageToGroup(groupJid, `⚠️ ${usage}`);
      return;
    }

    const rawTarget = rest.slice(0, firstSpaceIndex);
    const promptTemplate = rest.slice(firstSpaceIndex + 1).trim();

    const targetGroupJid = this.normalizeGroupJid(rawTarget);
    if (!targetGroupJid) {
      await sendMessageToGroup(
        groupJid,
        `⚠️ "${rawTarget}" no parece un JID de grupo válido. Debe verse como 120363045678901234@g.us (el @g.us se agrega solo si falta).`,
      );
      return;
    }

    const missing = REQUIRED_PLACEHOLDERS.filter(
      (placeholder) => !promptTemplate.includes(placeholder),
    );
    if (!promptTemplate || missing.length > 0) {
      await sendMessageToGroup(
        groupJid,
        `⚠️ El prompt debe incluir ${REQUIRED_PLACEHOLDERS.join(" y ")}.` +
        (missing.length > 0 ? `\nFalta: ${missing.join(", ")}` : ""),
      );
      return;
    }

    const group = await this.groupService.findByWhatsappId(targetGroupJid);
    if (!group) {
      await sendMessageToGroup(
        groupJid,
        `⚠️ El grupo ${targetGroupJid} no está registrado en el bot. Revisa el JID.`,
      );
      return;
    }
    if (group.status !== "approved") {
      await sendMessageToGroup(
        groupJid,
        `⚠️ El grupo "${group.name}" está en estado "${group.status}". Apruébalo primero con /approve.`,
      );
      return;
    }

    await this.summaryConfigService.setPromptTemplate(
      targetGroupJid,
      promptTemplate,
    );

    await sendMessageToGroup(
      groupJid,
      `✅ Informe semanal configurado para "${group.name}" (${targetGroupJid}). Desde ahora se guardan sus mensajes; el informe sale los viernes a las 16:50.`,
    );
  }

  /**
   * Accepts "@1203...@g.us", "1203...@g.us" or a bare "1203..." and returns
   * the full "...@g.us" JID, or null when what remains isn't numeric.
   *
   * Prefer helpers from shared/utils/jid/jid.ts if one already covers this;
   * this is a standalone fallback that doesn't assume that file's API.
   */
  private normalizeGroupJid(raw: string): string | null {
    const withoutAt = raw.replace(/^@/, "");
    const withoutSuffix = withoutAt.replace(/@g\.us$/, "");

    if (!/^\d+(-\d+)?$/.test(withoutSuffix)) return null;

    return `${withoutSuffix}@g.us`;
  }
}
