import { Image, type ImageSourcePropType } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import {
  AudioLines,
  Bell,
  Briefcase,
  Calendar,
  Camera,
  Check,
  ChevronRight,
  CircleUser,
  Download,
  Dumbbell,
  FileAudio,
  FileText,
  FlaskConical,
  Folder,
  Gift,
  Heart,
  Home,
  KeyRound,
  Languages,
  Lightbulb,
  Lock,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  Mic,
  Monitor,
  Moon,
  Pause,
  Pencil,
  Play,
  Plus,
  Rocket,
  RotateCcw,
  RotateCw,
  Search,
  Settings2,
  Share,
  Square,
  Star,
  StickyNote,
  Sun,
  TrendingUp,
  Trophy,
  TriangleAlert,
  Video,
  X,
} from 'lucide-react-native';
import { sizes } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';

/**
 * Feature / empty-state art uses 3dicons PNGs.
 * Chrome (nav, lists, controls) prefers Lucide line icons — matches premium banking UIs.
 */
export type AppIconName =
  | 'microphone'
  | 'home-outline'
  | 'star-outline'
  | 'star'
  | 'download-outline'
  | 'account-outline'
  | 'magnify'
  | 'cog-outline'
  | 'check'
  | 'pause'
  | 'play'
  | 'stop'
  | 'close'
  | 'plus'
  | 'chevron-right'
  | 'file-music-outline'
  | 'sine-wave'
  | 'translate'
  | 'share-variant-outline'
  | 'bell-outline'
  | 'white-balance-sunny'
  | 'moon-waning-crescent'
  | 'theme-light-dark'
  | 'alert'
  | 'chat'
  | 'folder'
  | 'heart'
  | 'gift'
  | 'calendar'
  | 'computer'
  | 'bulb'
  | 'pencil'
  | 'camera'
  | 'bag'
  | 'file-text'
  | 'key'
  | 'lock'
  | 'logout'
  | 'chart'
  | 'gym'
  | 'lab'
  | 'mail'
  | 'rocket'
  | 'trophy'
  | 'map-pin'
  | 'rewind-15'
  | 'forward-15'
  | 'video'
  | 'sticky-note';

export type IconVariant = 'auto' | 'line' | '3d';

const ICONS_3D: Partial<Record<AppIconName, ImageSourcePropType>> = {
  microphone: require('../../../assets/icons/3d/mic.png'),
  'home-outline': require('../../../assets/icons/3d/home.png'),
  'star-outline': require('../../../assets/icons/3d/star.png'),
  star: require('../../../assets/icons/3d/star.png'),
  'download-outline': require('../../../assets/icons/3d/folder.png'),
  'account-outline': require('../../../assets/icons/3d/boy.png'),
  magnify: require('../../../assets/icons/3d/zoom.png'),
  'cog-outline': require('../../../assets/icons/3d/setting.png'),
  check: require('../../../assets/icons/3d/tick.png'),
  pause: require('../../../assets/icons/3d/pause.png'),
  play: require('../../../assets/icons/3d/play.png'),
  plus: require('../../../assets/icons/3d/plus.png'),
  'chevron-right': require('../../../assets/icons/3d/forward.png'),
  'file-music-outline': require('../../../assets/icons/3d/music.png'),
  'sine-wave': require('../../../assets/icons/3d/headphone.png'),
  'share-variant-outline': require('../../../assets/icons/3d/link.png'),
  'bell-outline': require('../../../assets/icons/3d/bell.png'),
  alert: require('../../../assets/icons/3d/flash.png'),
  chat: require('../../../assets/icons/3d/chat-bubble.png'),
  folder: require('../../../assets/icons/3d/folder.png'),
  heart: require('../../../assets/icons/3d/heart.png'),
  gift: require('../../../assets/icons/3d/gift.png'),
  calendar: require('../../../assets/icons/3d/calender.png'),
  computer: require('../../../assets/icons/3d/computer.png'),
  bulb: require('../../../assets/icons/3d/bulb.png'),
  pencil: require('../../../assets/icons/3d/pencil.png'),
  camera: require('../../../assets/icons/3d/camera.png'),
  bag: require('../../../assets/icons/3d/bag.png'),
  'file-text': require('../../../assets/icons/3d/file-text.png'),
  key: require('../../../assets/icons/3d/key.png'),
  lock: require('../../../assets/icons/3d/lock.png'),
  chart: require('../../../assets/icons/3d/chart.png'),
  gym: require('../../../assets/icons/3d/gym.png'),
  lab: require('../../../assets/icons/3d/lab.png'),
  mail: require('../../../assets/icons/3d/mail.png'),
  rocket: require('../../../assets/icons/3d/rocket.png'),
  trophy: require('../../../assets/icons/3d/trophy.png'),
  'map-pin': require('../../../assets/icons/3d/map-pin.png'),
};

const LUCIDE: Record<AppIconName, LucideIcon> = {
  microphone: Mic,
  'home-outline': Home,
  'star-outline': Star,
  star: Star,
  'download-outline': Download,
  'account-outline': CircleUser,
  magnify: Search,
  'cog-outline': Settings2,
  check: Check,
  pause: Pause,
  play: Play,
  stop: Square,
  close: X,
  plus: Plus,
  'chevron-right': ChevronRight,
  'file-music-outline': FileAudio,
  'sine-wave': AudioLines,
  translate: Languages,
  'share-variant-outline': Share,
  'bell-outline': Bell,
  'white-balance-sunny': Sun,
  'moon-waning-crescent': Moon,
  'theme-light-dark': Sun,
  alert: TriangleAlert,
  chat: MessageCircle,
  folder: Folder,
  heart: Heart,
  gift: Gift,
  calendar: Calendar,
  computer: Monitor,
  bulb: Lightbulb,
  pencil: Pencil,
  camera: Camera,
  bag: Briefcase,
  'file-text': FileText,
  key: KeyRound,
  lock: Lock,
  logout: LogOut,
  chart: TrendingUp,
  gym: Dumbbell,
  lab: FlaskConical,
  mail: Mail,
  rocket: Rocket,
  trophy: Trophy,
  'map-pin': MapPin,
  'rewind-15': RotateCcw,
  'forward-15': RotateCw,
  video: Video,
  'sticky-note': StickyNote,
};

const FILLED: Partial<Record<AppIconName, boolean>> = {
  star: true,
};

/** Chrome / nav / list controls — always line. */
const CHROME: Set<AppIconName> = new Set([
  'home-outline',
  'file-music-outline',
  'translate',
  'cog-outline',
  'close',
  'chevron-right',
  'plus',
  'stop',
  'check',
  'magnify',
  'bell-outline',
  'white-balance-sunny',
  'moon-waning-crescent',
  'theme-light-dark',
  'share-variant-outline',
  'logout',
  'rewind-15',
  'forward-15',
  'video',
  'sticky-note',
]);

interface IconProps {
  name: AppIconName;
  size?: number;
  color?: string;
  /** `line` = Lucide stroke (premium chrome). `3d` = illustrative PNG. */
  variant?: IconVariant;
}

export function Icon({ name, size = sizes.icon, color, variant = 'auto' }: IconProps) {
  const { colors } = useTheme();
  const png = ICONS_3D[name];
  const use3d =
    Boolean(png) &&
    (variant === '3d' || (variant === 'auto' && !CHROME.has(name)));

  if (use3d && png) {
    return (
      <Image
        source={png}
        accessible={false}
        resizeMode="contain"
        style={{ width: size, height: size }}
      />
    );
  }

  const Glyph = LUCIDE[name];
  const filled = FILLED[name] === true;
  const tint = color ?? colors.ink;

  return (
    <Glyph
      size={size}
      color={tint}
      strokeWidth={1.85}
      fill={filled ? tint : 'none'}
      absoluteStrokeWidth
    />
  );
}
