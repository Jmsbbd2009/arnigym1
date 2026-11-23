import type { HTMLAttributes, ReactElement } from 'react';

type IconProps = Omit<HTMLAttributes<HTMLElement>, 'color'> & { size?: number | string; strokeWidth?: number; color?: string };

function makeIcon(name: string) {
  return function BootstrapIcon({ size = 20, strokeWidth: _strokeWidth, color, className = '', style, ...props }: IconProps): ReactElement {
    return <i {...props} aria-hidden={props['aria-label'] ? undefined : true} className={`bi bi-${name}${className ? ` ${className}` : ''}`} style={{ fontSize: size, lineHeight: 1, color, ...style }} />;
  };
}

export const Activity = makeIcon('activity');
export const Apple = makeIcon('apple');
export const ArrowDown = makeIcon('arrow-down');
export const ArrowRight = makeIcon('arrow-right');
export const ArrowUpRight = makeIcon('arrow-up-right');
export const Bell = makeIcon('bell');
export const BellRing = makeIcon('bell-fill');
export const CalendarDays = makeIcon('calendar3');
export const Camera = makeIcon('camera');
export const Check = makeIcon('check2');
export const ChevronRight = makeIcon('chevron-right');
export const CircleAlert = makeIcon('exclamation-circle');
export const CircleUserRound = makeIcon('person-circle');
export const Clock3 = makeIcon('clock');
export const Cookie = makeIcon('cookie');
export const Droplets = makeIcon('droplet-fill');
export function Dumbbell({ size = 20, strokeWidth: _strokeWidth, color, className = '', style, ...props }: IconProps): ReactElement {
  return <i {...props} aria-hidden={props['aria-label'] ? undefined : true} className={`bi bi-dumbbell${className ? ` ${className}` : ''}`} style={{ fontSize: size, lineHeight: 1, color, display: 'inline-flex', ...style }}>
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="1" y="9" width="2.6" height="6" rx="1"/><rect x="4.2" y="6" width="3.4" height="12" rx="1.2"/><rect x="7.6" y="10.8" width="8.8" height="2.4" rx=".8"/><rect x="16.4" y="6" width="3.4" height="12" rx="1.2"/><rect x="20.4" y="9" width="2.6" height="6" rx="1"/></svg>
  </i>;
}
export const Flame = makeIcon('fire');
export const HeartPulse = makeIcon('heart-pulse');
export const Heart = makeIcon('heart');
export const HeartFill = makeIcon('heart-fill');
export const Home = makeIcon('house-door');
export const Image = makeIcon('image');
export const ImagePlus = makeIcon('image');
export const Info = makeIcon('info-circle');
export const Instagram = makeIcon('instagram');
export const LockKeyhole = makeIcon('lock-fill');
export const LogIn = makeIcon('box-arrow-in-right');
export const UserPlus = makeIcon('person-plus');
export const MapPin = makeIcon('geo-alt-fill');
export const Menu = makeIcon('list');
export const Minus = makeIcon('dash');
export const Play = makeIcon('play-fill');
export const Plus = makeIcon('plus-lg');
export const PersonPlus = makeIcon('person-plus');
export const QrCode = makeIcon('qr-code');
export const RotateCcw = makeIcon('arrow-counterclockwise');
export const Search = makeIcon('search');
export const ShieldAlert = makeIcon('shield-exclamation');
export const ShieldCheck = makeIcon('shield-check');
export const Sparkles = makeIcon('stars');
export const Snowflake = makeIcon('snow');
export const Timer = makeIcon('stopwatch-fill');
export const TrendingUp = makeIcon('graph-up-arrow');
export const Trash2 = makeIcon('trash3');
export const Trophy = makeIcon('trophy-fill');
export const Upload = makeIcon('upload');
export const Users = makeIcon('people-fill');
export const Video = makeIcon('camera-video');
export const WalletCards = makeIcon('wallet2');
export const X = makeIcon('x-lg');
export const Megaphone = makeIcon('megaphone');
export const Tag = makeIcon('tags');
export const Pin = makeIcon('pin-angle-fill');
export const BellSlash = makeIcon('bell-slash');
export const WifiOff = makeIcon('wifi-off');
export const ShareIos = makeIcon('box-arrow-up');
export const Download = makeIcon('download');
export const CheckAll = makeIcon('check2-all');
export const Phone = makeIcon('phone');
export const Star = makeIcon('star-fill');
export const ArrowLeft = makeIcon('arrow-left');
export const Pencil = makeIcon('pencil-square');
