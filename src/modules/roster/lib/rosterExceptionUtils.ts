import { formatRequestDate } from "../../../shared/lib/format";
import type { RosterExceptionSource, WorkerRosterException } from "../types";

export type RosterExceptionGroup = {
  key: string;
  exceptions: WorkerRosterException[];
  startDate: string;
  endDate: string;
  dayCount: number;
  exceptionLabel: string;
  exceptionSource: RosterExceptionSource;
  notes: string | null;
  isActive: boolean;
};

function getDateTime(dateValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function getNextDateValue(dateValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + 1));
  return date.toISOString().slice(0, 10);
}

function getExceptionGroupKey(exception: WorkerRosterException) {
  return [
    exception.exceptionType,
    exception.exceptionLabel,
    exception.exceptionSource,
    exception.isActive ? "active" : "inactive",
    exception.notes?.trim() ?? ""
  ].join("|");
}

export function groupRosterExceptions(exceptions: WorkerRosterException[]): RosterExceptionGroup[] {
  return [...exceptions]
    .sort((left, right) => getDateTime(left.exceptionDate) - getDateTime(right.exceptionDate))
    .reduce<RosterExceptionGroup[]>((groups, exception) => {
      const lastGroup = groups[groups.length - 1];
      const groupKey = getExceptionGroupKey(exception);
      const canAppend =
        lastGroup?.key === groupKey &&
        getNextDateValue(lastGroup.endDate) === exception.exceptionDate;

      if (canAppend) {
        lastGroup.exceptions.push(exception);
        lastGroup.endDate = exception.exceptionDate;
        lastGroup.dayCount += 1;
        return groups;
      }

      groups.push({
        key: groupKey,
        exceptions: [exception],
        startDate: exception.exceptionDate,
        endDate: exception.exceptionDate,
        dayCount: 1,
        exceptionLabel: exception.exceptionLabel,
        exceptionSource: exception.exceptionSource,
        notes: exception.notes,
        isActive: exception.isActive
      });

      return groups;
    }, []);
}

export function formatExceptionGroupRange(group: RosterExceptionGroup) {
  const range =
    group.startDate === group.endDate
      ? formatRequestDate(group.startDate)
      : `${formatRequestDate(group.startDate)} - ${formatRequestDate(group.endDate)}`;

  return `${range} · ${group.dayCount === 1 ? "1 día" : `${group.dayCount} días`}`;
}
