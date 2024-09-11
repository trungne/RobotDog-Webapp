import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type NumberInputProps = {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
};

export const NumberInput = ({
  label,
  value,
  onChange,
  id,
}: NumberInputProps) => {
  const handleOnChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(parseFloat(event.target.value));
  };
  return (
    <div className="flex gap-2 justify-between items-center">
      <Label className="w-24 break-words" htmlFor={id}>
        {label}
      </Label>
      <div className="w-2">:</div>
      <Input
        className="w-auto"
        type="number"
        id={id}
        value={value}
        onChange={handleOnChange}
      />
    </div>
  );
};
