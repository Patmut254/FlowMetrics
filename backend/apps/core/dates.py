"""Date-range helpers shared by the analytics endpoints."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

from django.utils import timezone
from rest_framework.exceptions import ValidationError

MAX_RANGE_DAYS = 366 * 3


@dataclass(frozen=True)
class DateRange:
    start: date
    end: date

    @property
    def days(self) -> int:
        return (self.end - self.start).days + 1

    def previous(self) -> "DateRange":
        """The period of equal length immediately before this one."""
        prev_end = self.start - timedelta(days=1)
        return DateRange(prev_end - timedelta(days=self.days - 1), prev_end)

    def contains(self, value: date | None) -> bool:
        return value is not None and self.start <= value <= self.end


@dataclass(frozen=True)
class Bucket:
    label: str
    start: date
    end: date


def _parse(value: str, field: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise ValidationError({field: ["Use the YYYY-MM-DD format."]}) from exc


def parse_date_range(params, default_days: int = 30) -> DateRange:
    """Build a DateRange from `?start=YYYY-MM-DD&end=YYYY-MM-DD` query params."""
    today = timezone.localdate()
    end = _parse(params["end"], "end") if params.get("end") else today
    if params.get("start"):
        start = _parse(params["start"], "start")
    else:
        start = end - timedelta(days=default_days - 1)

    if start > end:
        raise ValidationError({"start": ["Start date must be on or before the end date."]})
    if (end - start).days + 1 > MAX_RANGE_DAYS:
        raise ValidationError({"start": ["Date ranges are limited to three years."]})
    return DateRange(start, end)


def month_start(value: date) -> date:
    return value.replace(day=1)


def add_months(value: date, months: int) -> date:
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    return date(year, month, 1)


def month_end(value: date) -> date:
    return add_months(value, 1) - timedelta(days=1)


def granularity_for(rng: DateRange) -> str:
    if rng.days <= 31:
        return "day"
    if rng.days <= 120:
        return "week"
    return "month"


def build_buckets(rng: DateRange) -> tuple[str, list[Bucket]]:
    """Split a range into day / week / month buckets depending on its length."""
    granularity = granularity_for(rng)
    buckets: list[Bucket] = []

    if granularity == "day":
        current = rng.start
        while current <= rng.end:
            buckets.append(Bucket(current.isoformat(), current, current))
            current += timedelta(days=1)
    elif granularity == "week":
        current = rng.start
        while current <= rng.end:
            week_end = min(current + timedelta(days=6 - current.weekday()), rng.end)
            buckets.append(Bucket(current.isoformat(), current, week_end))
            current = week_end + timedelta(days=1)
    else:
        current = rng.start
        while current <= rng.end:
            bucket_end = min(month_end(current), rng.end)
            buckets.append(Bucket(month_start(current).isoformat(), current, bucket_end))
            current = bucket_end + timedelta(days=1)

    return granularity, buckets


def bucket_index(buckets: list[Bucket]):
    """Return a function mapping a date to the index of its bucket (or None)."""
    def lookup(value: date) -> int | None:
        lo, hi = 0, len(buckets) - 1
        while lo <= hi:
            mid = (lo + hi) // 2
            bucket = buckets[mid]
            if value < bucket.start:
                hi = mid - 1
            elif value > bucket.end:
                lo = mid + 1
            else:
                return mid
        return None

    return lookup
