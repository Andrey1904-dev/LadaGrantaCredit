import {
  AlertTriangle,
  BadgeRussianRuble,
  BarChart3,
  Download,
  FileText,
  IdCard,
  ArrowUpRight,
  Battery,
  Bell,
  Calendar,
  ChevronDown,
  ClipboardList,
  Clock,
  Disc3,
  Droplet,
  History,
  CarFront,
  Check,
  ChevronRight,
  CreditCard,
  Fuel,
  Gauge,
  Info,
  LayoutDashboard,
  Lock,
  LogOut,
  Mail,
  MoreHorizontal,
  Pencil,
  Percent,
  Plus,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Snowflake,
  Sparkles,
  Sun,
  Timer,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  Wrench,
  X,
} from 'lucide-react'

export interface IconProps {
  className?: string
  strokeWidth?: number
}

const DEFAULT_STROKE = 1.85
const base = (className?: string) => className ?? 'w-5 h-5'

export const HomeIcon = ({ className, strokeWidth = DEFAULT_STROKE }: IconProps) => (
  <LayoutDashboard className={base(className)} strokeWidth={strokeWidth} aria-hidden="true" />
)

export const CardIcon = ({ className, strokeWidth = DEFAULT_STROKE }: IconProps) => (
  <CreditCard className={base(className)} strokeWidth={strokeWidth} aria-hidden="true" />
)

export const WalletIcon = ({ className, strokeWidth = DEFAULT_STROKE }: IconProps) => (
  <Wallet className={base(className)} strokeWidth={strokeWidth} aria-hidden="true" />
)

export const CarIcon = ({ className, strokeWidth = DEFAULT_STROKE }: IconProps) => (
  <CarFront className={base(className)} strokeWidth={strokeWidth} aria-hidden="true" />
)

export const FuelIcon = ({ className, strokeWidth = DEFAULT_STROKE }: IconProps) => (
  <Fuel className={base(className)} strokeWidth={strokeWidth} aria-hidden="true" />
)

export const WrenchIcon = ({ className, strokeWidth = DEFAULT_STROKE }: IconProps) => (
  <Wrench className={base(className)} strokeWidth={strokeWidth} aria-hidden="true" />
)

export const ShieldIcon = ({ className, strokeWidth = DEFAULT_STROKE }: IconProps) => (
  <ShieldCheck className={base(className)} strokeWidth={strokeWidth} aria-hidden="true" />
)

export const DotsIcon = ({ className, strokeWidth = DEFAULT_STROKE }: IconProps) => (
  <MoreHorizontal className={base(className)} strokeWidth={strokeWidth} aria-hidden="true" />
)

export const PlusIcon = ({ className, strokeWidth = DEFAULT_STROKE }: IconProps) => (
  <Plus className={base(className)} strokeWidth={strokeWidth} aria-hidden="true" />
)

export const CloseIcon = ({ className, strokeWidth = DEFAULT_STROKE }: IconProps) => (
  <X className={base(className)} strokeWidth={strokeWidth} aria-hidden="true" />
)

export const TrashIcon = ({ className, strokeWidth = DEFAULT_STROKE }: IconProps) => (
  <Trash2 className={base(className)} strokeWidth={strokeWidth} aria-hidden="true" />
)

export const EditIcon = ({ className, strokeWidth = DEFAULT_STROKE }: IconProps) => (
  <Pencil className={base(className)} strokeWidth={strokeWidth} aria-hidden="true" />
)

export const RefreshIcon = ({ className, strokeWidth = DEFAULT_STROKE }: IconProps) => (
  <RefreshCw className={base(className)} strokeWidth={strokeWidth} aria-hidden="true" />
)

export const LogoutIcon = ({ className, strokeWidth = DEFAULT_STROKE }: IconProps) => (
  <LogOut className={base(className)} strokeWidth={strokeWidth} aria-hidden="true" />
)

export const CalendarIcon = ({ className, strokeWidth = DEFAULT_STROKE }: IconProps) => (
  <Calendar className={base(className)} strokeWidth={strokeWidth} aria-hidden="true" />
)

export const GaugeIcon = ({ className, strokeWidth = DEFAULT_STROKE }: IconProps) => (
  <Gauge className={base(className)} strokeWidth={strokeWidth} aria-hidden="true" />
)

export const PercentIcon = ({ className, strokeWidth = DEFAULT_STROKE }: IconProps) => (
  <Percent className={base(className)} strokeWidth={strokeWidth} aria-hidden="true" />
)

export const InfoIcon = ({ className, strokeWidth = DEFAULT_STROKE }: IconProps) => (
  <Info className={base(className)} strokeWidth={strokeWidth} aria-hidden="true" />
)

export const AlertIcon = ({ className, strokeWidth = DEFAULT_STROKE }: IconProps) => (
  <AlertTriangle className={base(className)} strokeWidth={strokeWidth} aria-hidden="true" />
)

export const CheckIcon = ({ className, strokeWidth = DEFAULT_STROKE }: IconProps) => (
  <Check className={base(className)} strokeWidth={strokeWidth} aria-hidden="true" />
)

export const ChevronRightIcon = ({ className, strokeWidth = DEFAULT_STROKE }: IconProps) => (
  <ChevronRight className={base(className)} strokeWidth={strokeWidth} aria-hidden="true" />
)

export const ArrowUpRightIcon = ({ className, strokeWidth = DEFAULT_STROKE }: IconProps) => (
  <ArrowUpRight className={base(className)} strokeWidth={strokeWidth} aria-hidden="true" />
)

export const SparklesIcon = ({ className, strokeWidth = DEFAULT_STROKE }: IconProps) => (
  <Sparkles className={base(className)} strokeWidth={strokeWidth} aria-hidden="true" />
)

export const MailIcon = ({ className, strokeWidth = DEFAULT_STROKE }: IconProps) => (
  <Mail className={base(className)} strokeWidth={strokeWidth} aria-hidden="true" />
)

export const LockIcon = ({ className, strokeWidth = DEFAULT_STROKE }: IconProps) => (
  <Lock className={base(className)} strokeWidth={strokeWidth} aria-hidden="true" />
)

export const DropletIcon = ({ className, strokeWidth = DEFAULT_STROKE }: IconProps) => (
  <Droplet className={base(className)} strokeWidth={strokeWidth} aria-hidden="true" />
)

export const TimerIcon = ({ className, strokeWidth = DEFAULT_STROKE }: IconProps) => (
  <Timer className={base(className)} strokeWidth={strokeWidth} aria-hidden="true" />
)

export const ClockIcon = ({ className, strokeWidth = DEFAULT_STROKE }: IconProps) => (
  <Clock className={base(className)} strokeWidth={strokeWidth} aria-hidden="true" />
)

export const ChecklistIcon = ({ className, strokeWidth = DEFAULT_STROKE }: IconProps) => (
  <ClipboardList className={base(className)} strokeWidth={strokeWidth} aria-hidden="true" />
)

export const SnowIcon = ({ className, strokeWidth = DEFAULT_STROKE }: IconProps) => (
  <Snowflake className={base(className)} strokeWidth={strokeWidth} aria-hidden="true" />
)

export const SunIcon = ({ className, strokeWidth = DEFAULT_STROKE }: IconProps) => (
  <Sun className={base(className)} strokeWidth={strokeWidth} aria-hidden="true" />
)

export const BatteryIcon = ({ className, strokeWidth = DEFAULT_STROKE }: IconProps) => (
  <Battery className={base(className)} strokeWidth={strokeWidth} aria-hidden="true" />
)

export const TyreIcon = ({ className, strokeWidth = DEFAULT_STROKE }: IconProps) => (
  <Disc3 className={base(className)} strokeWidth={strokeWidth} aria-hidden="true" />
)

export const TrendIcon = ({ className, strokeWidth = DEFAULT_STROKE }: IconProps) => (
  <TrendingUp className={base(className)} strokeWidth={strokeWidth} aria-hidden="true" />
)

export const SettingsIcon = ({ className, strokeWidth = DEFAULT_STROKE }: IconProps) => (
  <Settings2 className={base(className)} strokeWidth={strokeWidth} aria-hidden="true" />
)

export const ChevronDownIcon = ({ className, strokeWidth = DEFAULT_STROKE }: IconProps) => (
  <ChevronDown className={base(className)} strokeWidth={strokeWidth} aria-hidden="true" />
)

export const BellIcon = ({ className, strokeWidth = DEFAULT_STROKE }: IconProps) => (
  <Bell className={base(className)} strokeWidth={strokeWidth} aria-hidden="true" />
)

export const HistoryIcon = ({ className, strokeWidth = DEFAULT_STROKE }: IconProps) => (
  <History className={base(className)} strokeWidth={strokeWidth} aria-hidden="true" />
)

export const TrendDownIcon = ({ className, strokeWidth = DEFAULT_STROKE }: IconProps) => (
  <TrendingDown className={base(className)} strokeWidth={strokeWidth} />
)

export const ChartIcon = ({ className, strokeWidth = DEFAULT_STROKE }: IconProps) => (
  <BarChart3 className={base(className)} strokeWidth={strokeWidth} />
)

export const DocIcon = ({ className, strokeWidth = DEFAULT_STROKE }: IconProps) => (
  <FileText className={base(className)} strokeWidth={strokeWidth} />
)

export const LicenseIcon = ({ className, strokeWidth = DEFAULT_STROKE }: IconProps) => (
  <IdCard className={base(className)} strokeWidth={strokeWidth} />
)

export const TaxIcon = ({ className, strokeWidth = DEFAULT_STROKE }: IconProps) => (
  <BadgeRussianRuble className={base(className)} strokeWidth={strokeWidth} />
)

export const DownloadIcon = ({ className, strokeWidth = DEFAULT_STROKE }: IconProps) => (
  <Download className={base(className)} strokeWidth={strokeWidth} />
)
