import type { WhoCauseType } from "../services/hiringControl";

export type WhoCauseDraft = {
  type: WhoCauseType | "";
  year: string;
  comment: string;
};

export const isWhoCauseDraftStarted = (cause: WhoCauseDraft) =>
  Boolean(cause.type || cause.year.trim() || cause.comment.trim());

export const isWhoCauseDraftComplete = (cause: WhoCauseDraft) =>
  Boolean(cause.type && cause.year.trim() && cause.comment.trim());

export const buildEmptyWhoCauseDrafts = (): WhoCauseDraft[] =>
  Array.from({ length: 4 }, () => ({
    type: "",
    year: "",
    comment: ""
  }));
