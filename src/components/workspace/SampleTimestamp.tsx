import { displayTimestamp } from "@/lib/display-timestamp";
/** New fixtures carry fixed scenario timestamps; old snapshot wording is retained honestly. */
export function SampleTimestamp({ value }: { value: string }) {
  const timestamp = displayTimestamp(value);
  if (!timestamp) return <span>At capture: {value}</span>;
  return <time dateTime={timestamp.dateTime} title={`Sample data · ${timestamp.label}`}>{timestamp.label}</time>;
}
