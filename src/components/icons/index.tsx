/* Pixelarticons shim (Phosphor-compatible size/weight props). */
"use client";

import {
  createContext,
  createElement,
  type ComponentType,
  type Context,
  type SVGProps,
} from "react";
import {
  Analytics as PixelAnalytics,
  ArrowDown as PixelArrowDown,
  ArrowRight as PixelArrowRight,
  ArrowUp as PixelArrowUp,
  ArrowsHorizontal as PixelArrowsHorizontal,
  AudioWaveform as PixelAudioWaveform,
  AvatarCircleX as PixelAvatarCircleX,
  Blocks as PixelBlocks,
  Briefcase as PixelBriefcase,
  Building as PixelBuilding,
  Calendar as PixelCalendar,
  Car as PixelCar,
  Chart as PixelChart,
  ChartBarBig as PixelChartBarBig,
  ChartLine as PixelChartLine,
  Check as PixelCheck,
  CheckboxOn as PixelCheckboxOn,
  ChevronDown as PixelChevronDown,
  ChevronLeft as PixelChevronLeft,
  ChevronRight as PixelChevronRight,
  CircleInfo as PixelCircleInfo,
  CircleQuestion as PixelCircleQuestion,
  Clock as PixelClock,
  Close as PixelClose,
  Code as PixelCode,
  Coffee as PixelCoffee,
  Coins as PixelCoins,
  Comment as PixelComment,
  CommentText as PixelCommentText,
  CornerDownLeft as PixelCornerDownLeft,
  CornerDownRight as PixelCornerDownRight,
  CornerUpRight as PixelCornerUpRight,
  CreditCard as PixelCreditCard,
  Dog as PixelDog,
  Dollar as PixelDollar,
  Download as PixelDownload,
  ExternalLink as PixelExternalLink,
  Eye as PixelEye,
  EyeOff as PixelEyeOff,
  Flag as PixelFlag,
  Gamepad as PixelGamepad,
  Github as PixelGithub,
  Grid2x22 as PixelGrid2x22,
  Heart as PixelHeart,
  Helicopter as PixelHelicopter,
  Home as PixelHome,
  Image as PixelImage,
  Label as PixelLabel,
  Leaf as PixelLeaf,
  Loader as PixelLoader,
  Mic as PixelMic,
  MicOff as PixelMicOff,
  Minus as PixelMinus,
  Moon as PixelMoon,
  MoreHorizontal as PixelMoreHorizontal,
  Pencil as PixelPencil,
  Percent as PixelPercent,
  PictureInPicture as PixelPictureInPicture,
  Plug as PixelPlug,
  Plus as PixelPlus,
  Pointer as PixelPointer,
  Receipt as PixelReceipt,
  Reload as PixelReload,
  Scale as PixelScale,
  Search as PixelSearch,
  Shield as PixelShield,
  ShoppingBag as PixelShoppingBag,
  SpeedMedium as PixelSpeedMedium,
  SquareAlert as PixelSquareAlert,
  Sun as PixelSun,
  Target as PixelTarget,
  Tea as PixelTea,
  Trash as PixelTrash,
  TrendingUp as PixelTrendingUp,
  Tv as PixelTv,
  Undo as PixelUndo,
  Volume3 as PixelVolume3,
  VolumeX as PixelVolumeX,
  Wallet as PixelWallet,
  WarningDiamond as PixelWarningDiamond,
  Zap as PixelZap,
} from "pixelarticons/react";

export type IconWeight =
  | "thin"
  | "light"
  | "regular"
  | "bold"
  | "fill"
  | "duotone";

export type IconProps = SVGProps<SVGSVGElement> & {
  size?: number | string;
  weight?: IconWeight;
  mirrored?: boolean;
  alt?: string;
};

export type Icon = ComponentType<IconProps>;

export const IconContext: Context<IconProps> = createContext<IconProps>({});

function wrap(PixelIcon: ComponentType<SVGProps<SVGSVGElement>>): Icon {
  function PixelShimIcon({
    size,
    weight: _weight,
    mirrored: _mirrored,
    alt: _alt,
    width,
    height,
    className,
    style,
    ...props
  }: IconProps) {
    const dim = size ?? width ?? height ?? 24;
    return createElement(PixelIcon, {
      width: dim,
      height: dim,
      className: ["pixel-icon", className].filter(Boolean).join(" "),
      style: {
        imageRendering: "pixelated",
        ...style,
      },
      ...props,
    });
  }
  PixelShimIcon.displayName = PixelIcon.displayName || PixelIcon.name;
  return PixelShimIcon;
}

export const Airplane = wrap(PixelHelicopter);
export const Analytics = wrap(PixelAnalytics);
export const ArrowClockwise = wrap(PixelReload);
export const ArrowCounterClockwise = wrap(PixelUndo);
export const ArrowDown = wrap(PixelArrowDown);
export const ArrowDownLeft = wrap(PixelCornerDownLeft);
export const ArrowDownRight = wrap(PixelCornerDownRight);
export const ArrowRight = wrap(PixelArrowRight);
export const ArrowSquareOut = wrap(PixelExternalLink);
export const ArrowUp = wrap(PixelArrowUp);
export const ArrowUpRight = wrap(PixelCornerUpRight);
export const ArrowsClockwise = wrap(PixelReload);
export const ArrowsLeftRight = wrap(PixelArrowsHorizontal);
export const Bag = wrap(PixelShoppingBag);
export const Bank = wrap(PixelBuilding);
export const Briefcase = wrap(PixelBriefcase);
export const CalendarDots = wrap(PixelCalendar);
export const Car = wrap(PixelCar);
export const CaretDown = wrap(PixelChevronDown);
export const CaretLeft = wrap(PixelChevronLeft);
export const CaretRight = wrap(PixelChevronRight);
export const ChartBar = wrap(PixelChartBarBig);
export const ChartDonut = wrap(PixelChart);
export const ChartLine = wrap(PixelChartLine);
export const ChartLineUp = wrap(PixelTrendingUp);
export const ChartPieSlice = wrap(PixelChart);
export const ChatCircle = wrap(PixelComment);
export const ChatText = wrap(PixelCommentText);
export const Check = wrap(PixelCheck);
export const CheckCircle = wrap(PixelCheckboxOn);
export const CircleNotch = wrap(PixelLoader);
export const Clock = wrap(PixelClock);
export const Code = wrap(PixelCode);
export const Coffee = wrap(PixelCoffee);
export const CreditCard = wrap(PixelCreditCard);
export const CurrencyBtc = wrap(PixelCoins);
export const CurrencyDollar = wrap(PixelDollar);
export const DotsThree = wrap(PixelMoreHorizontal);
export const DotsThreeOutline = wrap(PixelMoreHorizontal);
export const DownloadSimple = wrap(PixelDownload);
export const Eye = wrap(PixelEye);
export const EyeSlash = wrap(PixelEyeOff);
export const FirstAid = wrap(PixelPlus);
export const Flag = wrap(PixelFlag);
export const ForkKnife = wrap(PixelTea);
export const GameController = wrap(PixelGamepad);
export const Gauge = wrap(PixelSpeedMedium);
export const GithubLogo = wrap(PixelGithub);
export const HandPointing = wrap(PixelPointer);
export const Heart = wrap(PixelHeart);
export const House = wrap(PixelHome);
export const ImageSquare = wrap(PixelImage);
export const Info = wrap(PixelCircleInfo);
export const Lightning = wrap(PixelZap);
export const MagnifyingGlass = wrap(PixelSearch);
export const Microphone = wrap(PixelMic);
export const MicrophoneSlash = wrap(PixelMicOff);
export const Minus = wrap(PixelMinus);
export const Moon = wrap(PixelMoon);
export const PawPrint = wrap(PixelDog);
export const PencilSimple = wrap(PixelPencil);
export const Percent = wrap(PixelPercent);
export const PictureInPicture = wrap(PixelPictureInPicture);
export const Plant = wrap(PixelLeaf);
export const Plugs = wrap(PixelPlug);
export const Plus = wrap(PixelPlus);
export const Question = wrap(PixelCircleQuestion);
export const Receipt = wrap(PixelReceipt);
export const Scales = wrap(PixelScale);
export const ShieldCheck = wrap(PixelShield);
export const ShoppingBag = wrap(PixelShoppingBag);
export const SpeakerHigh = wrap(PixelVolume3);
export const SpeakerSlash = wrap(PixelVolumeX);
export const SquaresFour = wrap(PixelGrid2x22);
export const Stack = wrap(PixelBlocks);
export const Sun = wrap(PixelSun);
export const Tag = wrap(PixelLabel);
export const Target = wrap(PixelTarget);
export const TelevisionSimple = wrap(PixelTv);
export const Trash = wrap(PixelTrash);
export const Wallet = wrap(PixelWallet);
export const Warning = wrap(PixelWarningDiamond);
export const WarningCircle = wrap(PixelSquareAlert);
export const Waveform = wrap(PixelAudioWaveform);
export const X = wrap(PixelClose);
export const XCircle = wrap(PixelAvatarCircleX);
