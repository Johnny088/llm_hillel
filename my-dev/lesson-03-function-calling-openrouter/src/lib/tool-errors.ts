export type ToolErrorCode =
  | "INVALID_TOOL_ARGUMENTS"
  | "UNKNOWN_TOOL"
  | "UPSTREAM_TIMEOUT"
  | "UPSTREAM_RATE_LIMITED"
  | "UPSTREAM_UNAVAILABLE"
  | "UNSUPPORTED_CURRENCY_PAIR"
  | "TOOL_CALL_LIMIT_REACHED"
  | "TOOL_EXECUTION_ERROR";

export class ToolError extends Error {
  public constructor(
    public readonly code: ToolErrorCode,
    message: string,
    public readonly retryable: boolean,
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "ToolError";
  }
}

export function getPublicToolMessage(code: ToolErrorCode): string {
  switch (code) {
    case "INVALID_TOOL_ARGUMENTS":
      return "Передані аргументи не відповідають визначеній схемі.";
    case "UNKNOWN_TOOL":
      return "Запитуваний інструмент не зареєстровано у застосунку.";
    case "UPSTREAM_TIMEOUT":
      return "Час очікування відповіді зовнішнього сервісу вичерпано.";
    case "UPSTREAM_RATE_LIMITED":
      return "Зовнішній сервіс тимчасово обмежив частоту запитів.";
    case "UPSTREAM_UNAVAILABLE":
      return "Зовнішній фінансовий сервіс тимчасово недоступний.";
    case "UNSUPPORTED_CURRENCY_PAIR":
      return "Валютна пара не підтримується навчальним сервісом.";
    case "TOOL_CALL_LIMIT_REACHED":
      return "Перевищено дозволену кількість викликів інструментів.";
    case "TOOL_EXECUTION_ERROR":
      return "Не вдалося виконати інструмент.";
  }
}
const MONTH_INDEX: Readonly<Record<string, number>> = {
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

const WEEKDAY_INDEX: Readonly<Record<string, number>> = {
  Sun: 0,
  Sunday: 0,
  Mon: 1,
  Monday: 1,
  Tue: 2,
  Tuesday: 2,
  Wed: 3,
  Wednesday: 3,
  Thu: 4,
  Thursday: 4,
  Fri: 5,
  Friday: 5,
  Sat: 6,
  Saturday: 6,
};

const IMF_FIXDATE_PATTERN =
  /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat), (\d{2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4}) (\d{2}):(\d{2}):(\d{2}) GMT$/;

const RFC850_DATE_PATTERN =
  /^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday), (\d{2})-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2}) (\d{2}):(\d{2}):(\d{2}) GMT$/;

const ASCTIME_DATE_PATTERN =
  /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (?: (\d)|(\d{2})) (\d{2}):(\d{2}):(\d{2}) (\d{4})$/;

function readGroup(match: RegExpExecArray, index: number): string {
  const value = match[index];

  if (value === undefined) {
    throw new TypeError(`Missing HTTP-date capture group ${index}.`);
  }

  return value;
}

function toUtcDateMs(
  weekday: string,
  day: number,
  month: string,
  year: number,
  hour: number,
  minute: number,
  second: number,
): number | undefined {
  const monthIndex = MONTH_INDEX[month];
  const weekdayIndex = WEEKDAY_INDEX[weekday];

  if (
    monthIndex === undefined ||
    weekdayIndex === undefined ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 60
  ) {
    return undefined;
  }

  const isLeapSecond = second === 60;
  const date = new Date(0);

  date.setUTCFullYear(year, monthIndex, day);
  date.setUTCHours(hour, minute, isLeapSecond ? 59 : second, 0);

  const isExactDate =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === monthIndex &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute &&
    date.getUTCSeconds() === (isLeapSecond ? 59 : second) &&
    date.getUTCDay() === weekdayIndex;

  return isExactDate ? date.getTime() + (isLeapSecond ? 1_000 : 0) : undefined;
}

function parseHttpDate(value: string, now: number): number | undefined {
  const imfMatch = IMF_FIXDATE_PATTERN.exec(value);

  if (imfMatch) {
    return toUtcDateMs(
      readGroup(imfMatch, 1),
      Number(readGroup(imfMatch, 2)),
      readGroup(imfMatch, 3),
      Number(readGroup(imfMatch, 4)),
      Number(readGroup(imfMatch, 5)),
      Number(readGroup(imfMatch, 6)),
      Number(readGroup(imfMatch, 7)),
    );
  }

  const rfc850Match = RFC850_DATE_PATTERN.exec(value);

  if (rfc850Match) {
    const currentYear = new Date(now).getUTCFullYear();
    const twoDigitYear = Number(readGroup(rfc850Match, 4));

    let year = Math.floor(currentYear / 100) * 100 + twoDigitYear;

    if (year > currentYear + 50) {
      year -= 100;
    }

    return toUtcDateMs(
      readGroup(rfc850Match, 1),
      Number(readGroup(rfc850Match, 2)),
      readGroup(rfc850Match, 3),
      year,
      Number(readGroup(rfc850Match, 5)),
      Number(readGroup(rfc850Match, 6)),
      Number(readGroup(rfc850Match, 7)),
    );
  }

  const asctimeMatch = ASCTIME_DATE_PATTERN.exec(value);

  if (asctimeMatch) {
    const day = Number(asctimeMatch[3] ?? asctimeMatch[4]);

    return toUtcDateMs(
      readGroup(asctimeMatch, 1),
      day,
      readGroup(asctimeMatch, 2),
      Number(readGroup(asctimeMatch, 8)),
      Number(readGroup(asctimeMatch, 5)),
      Number(readGroup(asctimeMatch, 6)),
      Number(readGroup(asctimeMatch, 7)),
    );
  }

  return undefined;
}
export function parseRetryAfter(
  value: string | null,
  now: number = Date.now(),
): number | undefined {
  const normalized = value?.trim();

  if (!normalized) {
    return undefined;
  }

  if (/^\d+$/.test(normalized)) {
    const seconds = Number(normalized);
    const maxSafeSeconds = Math.floor(Number.MAX_SAFE_INTEGER / 1_000);

    return Number.isSafeInteger(seconds) && seconds <= maxSafeSeconds ? seconds * 1_000 : undefined;
  }

  const dateMs = parseHttpDate(normalized, now);

  return dateMs === undefined ? undefined : Math.max(0, dateMs - now);
}

export function createHttpToolError(response: Response): ToolError {
  const retryAfterMs = parseRetryAfter(response.headers.get("Retry-After"));

  switch (response.status) {
    case 408:
      return new ToolError(
        "UPSTREAM_TIMEOUT",
        "Зовнішній сервіс не відповів вчасно.",
        true,
        retryAfterMs,
      );
    case 429:
      return new ToolError(
        "UPSTREAM_RATE_LIMITED",
        "Зовнішній сервіс обмежив частоту запитів.",
        true,
        retryAfterMs,
      );
    case 500:
    case 502:
    case 503:
    case 504:
      return new ToolError(
        "UPSTREAM_UNAVAILABLE",
        `Зовнішній сервіс повернув HTTP ${response.status}.`,
        true,
        retryAfterMs,
      );
    default:
      return new ToolError(
        "TOOL_EXECUTION_ERROR",
        `Зовнішній сервіс повернув HTTP ${response.status}.`,
        false,
      );
  }
}
