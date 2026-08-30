"use client";

import { useId, type CSSProperties, type ReactElement } from "react";
import { cn } from "@/lib";
import {
  ICONSAX_GLYPHS,
  ICONSAX_MAP,
  type IconName,
  type IconsaxId,
} from "@/lib/iconsax-glyphs";

export type { IconName };

export type IconProps = {
  className?: string;
  size?: number;
  title?: string;
};

export type AppIcon = (props: IconProps) => ReactElement;

function Glyph({ id, className, size, title }: IconProps & { id: IconsaxId }) {
  const uid = useId().replace(/:/g, "");
  const html = ICONSAX_GLYPHS[id].replace(/clip([0-9_]+)/g, `c${uid}_$1`);
  const style: CSSProperties | undefined = size
    ? { width: size, height: size }
    : undefined;
  return (
    <span
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={cn("inline-flex shrink-0 [&>svg]:block [&>svg]:h-full [&>svg]:w-full", className)}
      style={style}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function Icon({ name, ...props }: IconProps & { name: IconName }) {
  return <Glyph id={ICONSAX_MAP[name]} {...props} />;
}

function named(id: IconsaxId): AppIcon {
  function NamedIcon(props: IconProps) {
    return <Glyph id={id} {...props} />;
  }
  NamedIcon.displayName = id;
  return NamedIcon;
}

export const Activity = named(ICONSAX_MAP.Activity);
export const AlertCircle = named(ICONSAX_MAP.AlertCircle);
export const ArrowLeft = named(ICONSAX_MAP.ArrowLeft);
export const Ban = named(ICONSAX_MAP.Ban);
export const BarChart3 = named(ICONSAX_MAP.BarChart3);
export const Bell = named(ICONSAX_MAP.Bell);
export const Briefcase = named(ICONSAX_MAP.Briefcase);
export const Building2 = named(ICONSAX_MAP.Building2);
export const CalendarClock = named(ICONSAX_MAP.CalendarClock);
export const CalendarDays = named(ICONSAX_MAP.CalendarDays);
export const CalendarPlus = named(ICONSAX_MAP.CalendarPlus);
export const CalendarX2 = named(ICONSAX_MAP.CalendarX2);
export const Check = named(ICONSAX_MAP.Check);
export const CheckCheck = named(ICONSAX_MAP.CheckCheck);
export const CheckCircle2 = named(ICONSAX_MAP.CheckCircle2);
export const ChevronDown = named(ICONSAX_MAP.ChevronDown);
export const ChevronLeft = named(ICONSAX_MAP.ChevronLeft);
export const ChevronRight = named(ICONSAX_MAP.ChevronRight);
export const ChevronUp = named(ICONSAX_MAP.ChevronUp);
export const Clock = named(ICONSAX_MAP.Clock);
export const Contact = named(ICONSAX_MAP.Contact);
export const Copy = named(ICONSAX_MAP.Copy);
export const DoorOpen = named(ICONSAX_MAP.DoorOpen);
export const Download = named(ICONSAX_MAP.Download);
export const ExternalLink = named(ICONSAX_MAP.ExternalLink);
export const History = named(ICONSAX_MAP.History);
export const Hourglass = named(ICONSAX_MAP.Hourglass);
export const Info = named(ICONSAX_MAP.Info);
export const KeyRound = named(ICONSAX_MAP.KeyRound);
export const Layers = named(ICONSAX_MAP.Layers);
export const LayoutDashboard = named(ICONSAX_MAP.LayoutDashboard);
export const LifeBuoy = named(ICONSAX_MAP.LifeBuoy);
export const Loader2 = named(ICONSAX_MAP.Loader2);
export const LogOut = named(ICONSAX_MAP.LogOut);
export const MapPin = named(ICONSAX_MAP.MapPin);
export const Menu = named(ICONSAX_MAP.Menu);
export const MessageCircle = named(ICONSAX_MAP.MessageCircle);
export const Pencil = named(ICONSAX_MAP.Pencil);
export const Phone = named(ICONSAX_MAP.Phone);
export const Play = named(ICONSAX_MAP.Play);
export const PlayCircle = named(ICONSAX_MAP.PlayCircle);
export const Plus = named(ICONSAX_MAP.Plus);
export const Power = named(ICONSAX_MAP.Power);
export const Printer = named(ICONSAX_MAP.Printer);
export const ScrollText = named(ICONSAX_MAP.ScrollText);
export const Search = named(ICONSAX_MAP.Search);
export const Settings = named(ICONSAX_MAP.Settings);
export const Settings2 = named(ICONSAX_MAP.Settings2);
export const Shield = named(ICONSAX_MAP.Shield);
export const ShieldCheck = named(ICONSAX_MAP.ShieldCheck);
export const SlidersHorizontal = named(ICONSAX_MAP.SlidersHorizontal);
export const Sparkles = named(ICONSAX_MAP.Sparkles);
export const Square = named(ICONSAX_MAP.Square);
export const Trash2 = named(ICONSAX_MAP.Trash2);
export const User = named(ICONSAX_MAP.User);
export const UserCheck = named(ICONSAX_MAP.UserCheck);
export const UserCircle = named(ICONSAX_MAP.UserCircle);
export const UserPlus = named(ICONSAX_MAP.UserPlus);
export const UserRound = named(ICONSAX_MAP.UserRound);
export const UserX = named(ICONSAX_MAP.UserX);
export const Users = named(ICONSAX_MAP.Users);
export const UsersRound = named(ICONSAX_MAP.UsersRound);
export const Wrench = named(ICONSAX_MAP.Wrench);
export const X = named(ICONSAX_MAP.X);
export const XCircle = named(ICONSAX_MAP.XCircle);
