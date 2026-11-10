import {
  House,
  Coffee,
  Sprout,
  BriefcaseBusiness,
  Layers3,
  Plane,
  Heart,
  Car,
  ShieldCheck,
  Target,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
const icons: Record<string, LucideIcon> = {
  house: House,
  coffee: Coffee,
  sprout: Sprout,
  briefcase: BriefcaseBusiness,
  layers: Layers3,
  plane: Plane,
  heart: Heart,
  car: Car,
  shield: ShieldCheck,
  target: Target,
};
export function FinanceIcon({
  name,
  size = 18,
  ...props
}: {
  name: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const Icon = icons[name] || Layers3;
  return <Icon size={size} strokeWidth={1.75} {...props} />;
}
export function Illustration({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  return (
    <Image
      src={`/illustrations/${name}.webp`}
      width={320}
      height={320}
      unoptimized
      loading={name === "wallet" || name === "calendar" ? "eager" : "lazy"}
      className={`illustration ${className}`}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}
