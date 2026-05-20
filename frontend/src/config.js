const formatLabel = (minutes) => {
  if (minutes < 60) return `${minutes} phút`;
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 24 ? "1 ngày" : `${hours} giờ`;
  }
  return `${Math.floor(minutes / 60)} giờ ${minutes % 60} phút`;
};

export const INTERVAL_OPTIONS = Array.from({ length: 1440 }, (_, i) => {
  const value = i + 1;
  return {
    value: value,
    label: formatLabel(value),
  };
});

export const STATUS_FILTERS = [
  { value: "all", label: "Tất cả" },
  { value: "active", label: "Active" },
  { value: "dead", label: "Dead" },
  { value: "paused", label: "Paused" },
];
