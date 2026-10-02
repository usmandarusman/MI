export type ChartPeriod =
  | "1M"
  | "3M"
  | "6M"
  | "YTD"
  | "ALL";

export function formatPrice(
  value: number
): string {
  return new Intl.NumberFormat(
    "id-ID",
    {
      maximumFractionDigits: 2,
    }
  ).format(value);
}

export function formatCompactNumber(
  value: number
): string {
  if (!Number.isFinite(value)) {
    return "0";
  }

  const absolute = Math.abs(value);

  if (absolute >= 1_000_000_000_000) {
    return `${(
      value / 1_000_000_000_000
    ).toFixed(2)}T`;
  }

  if (absolute >= 1_000_000_000) {
    return `${(
      value / 1_000_000_000
    ).toFixed(2)}B`;
  }

  if (absolute >= 1_000_000) {
    return `${(
      value / 1_000_000
    ).toFixed(2)}M`;
  }

  if (absolute >= 1_000) {
    return `${(
      value / 1_000
    ).toFixed(1)}K`;
  }

  return new Intl.NumberFormat(
    "id-ID"
  ).format(value);
}

export function formatDate(
  date: string
): string {
  if (!/^\d{8}$/.test(date)) {
    return date;
  }

  const year = date.slice(0, 4);
  const month = date.slice(4, 6);
  const day = date.slice(6, 8);

  return `${day}/${month}/${year}`;
}

export function formatDateShort(
  date: string
): string {
  if (!/^\d{8}$/.test(date)) {
    return date;
  }

  const month = date.slice(4, 6);
  const day = date.slice(6, 8);

  return `${day}/${month}`;
}

export function calculateChange(
  previousClose: number | undefined,
  currentClose: number
): number {
  if (
    previousClose === undefined ||
    previousClose === 0
  ) {
    return 0;
  }

  return (
    ((currentClose - previousClose) /
      previousClose) *
    100
  );
}

function getJakartaTodayParts() {
  const parts = new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).formatToParts(new Date());

  return {
    year: Number(
      parts.find(
        (item) =>
          item.type === "year"
      )?.value
    ),

    month:
      Number(
        parts.find(
          (item) =>
            item.type === "month"
        )?.value
      ) - 1,

    day: Number(
      parts.find(
        (item) =>
          item.type === "day"
      )?.value
    ),
  };
}

function toYYYYMMDD(
  date: Date
): string {
  const year =
    date.getFullYear().toString();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}${month}${day}`;
}

export function getPeriodStart(
  period: ChartPeriod
): string {
  const {
    year,
    month,
    day,
  } = getJakartaTodayParts();

  const date = new Date(
    year,
    month,
    day
  );

  switch (period) {
    case "1M":
      date.setMonth(
        date.getMonth() - 1
      );
      return toYYYYMMDD(date);

    case "3M":
      date.setMonth(
        date.getMonth() - 3
      );
      return toYYYYMMDD(date);

    case "6M":
      date.setMonth(
        date.getMonth() - 6
      );
      return toYYYYMMDD(date);

    case "YTD":
      return `${year}0101`;

    case "ALL":
    default:
      return "20260820";
  }
}