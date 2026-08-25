import { sendMessageToGroup } from "../../core/whatsapp/send-message";
import { Commands } from "../enums/commands.enum";
import type { CommandHandler } from "../interfaces/command.interface";

export class JobCommand implements CommandHandler {
  command = Commands.JOB;
  description = "Give a list of jobs";
  requiresAdmin = false;

  async execute(_: string, groupSender: string): Promise<void> {
    await sendMessageToGroup(
      groupSender,
      "*Places to look for jobs:*\n\n" +
        "*LinkedIn* - _Professional network and job listings_\n" +
        "https://www.linkedin.com/jobs/\n\n" +
        "*Indeed* - _Job search engine with thousands of listings_\n" +
        "https://www.indeed.com/\n\n" +
        "*Wellfound* - _Great for startups and tech jobs_\n" +
        "https://wellfound.com/jobs\n\n" +
        "*Remote OK* - _Remote job opportunities from around the world_\n" +
        "https://remoteok.com/\n\n" +
        "*Glassdoor* - _Job listings, company reviews, and salaries_\n" +
        "https://www.glassdoor.com/Job/index.htm\n\n" +
        "*FlexJobs* - _Remote, hybrid, and flexible job opportunities_\n" +
        "https://www.flexjobs.com/\n\n",
    );
  }
}
