import { Label } from "@/components/ui/label";

export function SelectField({
  name,
  label,
  error,
  options,
  defaultValue,
  placeholder,
}: {
  name: string;
  label: string;
  error?: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue ?? ""}
        aria-invalid={!!error}
        className="min-h-11 rounded-md border border-input bg-card px-3 text-base md:text-sm"
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
