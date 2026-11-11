import {
  Airplane,
  Briefcase,
  Car,
  Coffee,
  Heart,
  House,
  Plant,
  ShieldCheck,
  Stack,
  Target,
  type Icon,
} from "@phosphor-icons/react";
import Image from "next/image";

const icons: Record<string, Icon> = {
  house: House,
  coffee: Coffee,
  sprout: Plant,
  briefcase: Briefcase,
  layers: Stack,
  plane: Airplane,
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
  const IconComponent = icons[name] || Stack;
  return <IconComponent size={size} {...props} />;
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
