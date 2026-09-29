import {
  AlertTriangle,
  ArrowUpRight,
  Calendar,
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
  ShieldCheck,
  Sparkles,
  Trash2,
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
