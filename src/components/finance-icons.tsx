import {
  Airplane,
  ArrowsLeftRight,
  Bag,
  Briefcase,
  Car,
  Code,
  Coffee,
  DotsThreeOutline,
  FirstAid,
  ForkKnife,
  GameController,
  Heart,
  House,
  Lightning,
  PawPrint,
  Percent,
  Plant,
  Question,
  ShieldCheck,
  ShoppingBag,
  Stack,
  Target,
  TelevisionSimple,
  type Icon,
} from "@phosphor-icons/react";
import Image from "next/image";
import { categoryImageSource } from "@/lib/category-image";

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
  "fork-knife": ForkKnife,
  bag: Bag,
  "shopping-bag": ShoppingBag,
  lightning: Lightning,
  "first-aid": FirstAid,
  paw: PawPrint,
  game: GameController,
  code: Code,
  tv: TelevisionSimple,
  percent: Percent,
  transfer: ArrowsLeftRight,
  question: Question,
  dots: DotsThreeOutline,
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

export function CategoryImage({
  name,
  size = 28,
  className = "",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src={categoryImageSource(name)}
      width={size}
      height={size}
      unoptimized
      className={`category-image ${className}`}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}
