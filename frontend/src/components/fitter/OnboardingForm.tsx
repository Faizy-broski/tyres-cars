"use client";

import { useState } from "react";
import { useForm, useFormContext, Controller } from "react-hook-form";
import Link from "next/link";
import Image from "next/image";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Check,
  ChevronDown,
  CheckCircle2,
  User,
  Building2,
  Wrench,
  Palette,
  BadgeDollarSign,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Form } from "@/components/ui/form";
import { toastSuccess, toastError } from "@/lib/toast";
import {
  onboardingSchema,
  type OnboardingFormData,
  STEP1_FIELDS,
  STEP2_FIELDS,
  STEP3_FIELDS,
  normalizePhone,
  normalizeBusinessNumber,
} from "@/lib/onboarding-schemas";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// ── Types ─────────────────────────────────────────────────────────────────────

interface WorkingHour {
  day: string;
  label: string;
  isClosed: boolean;
  openTime: string;
  closeTime: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_HOURS: WorkingHour[] = [
  {
    day: "mon_fri",
    label: "Monday – Friday",
    isClosed: false,
    openTime: "08:00",
    closeTime: "17:00",
  },
  {
    day: "saturday",
    label: "Saturday",
    isClosed: true,
    openTime: "08:00",
    closeTime: "17:00",
  },
  {
    day: "sunday",
    label: "Sunday",
    isClosed: true,
    openTime: "08:00",
    closeTime: "17:00",
  },
];

const DEFAULT_VALUES: OnboardingFormData = {
  fullName: "",
  email: "",
  contactPerson: "",
  contactEmail: "",
  address: "",
  addressConfirmed: false,
  mobileNumber: "",
  mobileConfirmed: false,
  businessNumber: "",
  businessConfirmed: false,
  fitsPassengerSuv: null,
  fitsWheelPackages: null,
  fitsTruck: null,
  wheelAlignmentAvailable: false,
  wheelAlignmentPrice: "",
  mobileFittingAvailable: false,
  workingHours: DEFAULT_HOURS,
};

const TIME_OPTIONS = Array.from({ length: 32 }, (_, i) => {
  const totalMins = 360 + i * 30;
  const h = Math.floor(totalMins / 60)
    .toString()
    .padStart(2, "0");
  const m = (totalMins % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
});

// ── Shared presentational components ─────────────────────────────────────────

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5 mb-6">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-colors ${i < step ? "bg-primary" : "bg-zinc-200"}`}
        />
      ))}
    </div>
  );
}

function FieldLabel({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-medium text-zinc-700 mb-1.5">
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

function InlineError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs font-medium text-red-500 mt-1">{message}</p>;
}

// ── ConfirmField ──────────────────────────────────────────────────────────────

type ConfirmableField = "address" | "mobileNumber" | "businessNumber";
type ConfirmedField =
  | "addressConfirmed"
  | "mobileConfirmed"
  | "businessConfirmed";

function ConfirmField({
  fieldName,
  confirmedName,
  label,
  placeholder,
  type = "text",
}: {
  fieldName: ConfirmableField;
  confirmedName: ConfirmedField;
  label: string;
  placeholder?: string;
  type?: string;
}) {
  const {
    watch,
    trigger,
    setValue,
    formState: { errors },
  } = useFormContext<OnboardingFormData>();

  const value = (watch(fieldName) as string) ?? "";
  const confirmed = (watch(confirmedName) as boolean) ?? false;

  const fieldError = errors[fieldName]?.message as string | undefined;
  const confirmedError = errors[confirmedName]?.message as string | undefined;

  async function handleConfirm() {
    const valid = await trigger(fieldName);
    if (valid)
      setValue(confirmedName, true, {
        shouldValidate: true,
        shouldDirty: true,
      });
  }

  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="relative">
        <Controller
          name={fieldName}
          render={({ field }) => (
            <Input
              {...field}
              type={type}
              placeholder={placeholder}
              className={`w-full rounded-lg pr-24 h-auto px-4 py-2.5 text-sm placeholder:text-zinc-400 transition-colors ${
                fieldError
                  ? "border-red-400 focus-visible:border-red-400 focus-visible:ring-red-400/20"
                  : confirmed
                    ? "border-green-400 bg-green-50 focus-visible:border-green-400 focus-visible:ring-green-400/20"
                    : "border-zinc-300 focus-visible:ring-primary/30 focus-visible:border-primary"
              }`}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                field.onChange(e);
                if (confirmed)
                  setValue(confirmedName, false, { shouldValidate: false });
              }}
            />
          )}
        />
        {confirmed ? (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs font-medium text-green-600">
            <Check className="w-3.5 h-3.5" />
            Confirmed
          </span>
        ) : (
          <Button
            type="button"
            variant="ghost"
            onClick={handleConfirm}
            disabled={!value.trim()}
            className="absolute right-3 top-1/2 -translate-y-1/2 h-auto p-0 text-xs font-semibold text-primary hover:text-primary/80 hover:bg-transparent disabled:text-zinc-400 disabled:opacity-100 transition-colors"
          >
            CONFIRM?
          </Button>
        )}
      </div>
      <InlineError message={fieldError} />
      {!fieldError && <InlineError message={confirmedError} />}
    </div>
  );
}

// ── YesNoField ────────────────────────────────────────────────────────────────

function YesNoField({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  const radioValue = value === null ? "" : value ? "yes" : "no";

  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-zinc-100 last:border-0">
      <span className="text-sm text-zinc-700 leading-snug">{label}</span>
      <RadioGroup
        value={radioValue}
        onValueChange={(v) => onChange(v === "yes")}
        className="shrink-0"
      >
        {(["yes", "no"] as const).map((opt) => (
          <div key={opt} className="flex items-center gap-1.5">
            <RadioGroupItem value={opt} id={`${name}-${opt}`} />
            <Label
              htmlFor={`${name}-${opt}`}
              className="text-sm text-zinc-600 cursor-pointer font-normal"
            >
              {opt === "yes" ? "Yes" : "No"}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}

// ── InfoPanel ─────────────────────────────────────────────────────────────────

function InfoPanel() {
  const [open, setOpen] = useState<string | null>(null);

  const items = [
    {
      id: "process",
      Icon: Palette,
      label: "Process",
      content:
        "Submit your application, our team reviews it within 2 business days, and we'll contact you to complete setup and training before going live.",
    },
    {
      id: "pricing",
      Icon: BadgeDollarSign,
      label: "Pricing Structure",
      content:
        "You set your own labour rates per service. Tyres & Car Valeting charges a small platform fee on completed jobs. No monthly subscription — you only pay when you earn.",
    },
    {
      id: "requirements",
      Icon: ClipboardList,
      label: "Requirements",
      content:
        "Valid ABN, public liability insurance, mobile or fixed fitting location, and ability to fulfil same/next-day fitting appointments in your area.",
    },
  ];

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <h2 className="text-base font-semibold text-zinc-900 mb-1">
        Important Information
      </h2>
      <p className="text-xs text-zinc-500 mb-4">
        Please review before proceeding
      </p>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="rounded-lg border border-zinc-100">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(open === item.id ? null : item.id)}
              className="w-full flex items-center justify-between px-3 py-2.5 h-auto rounded-lg hover:bg-zinc-50"
            >
              <div className="flex items-center gap-2">
                <item.Icon className="w-4 h-4 text-zinc-500 shrink-0" />
                <span className="text-sm font-medium text-zinc-700">
                  {item.label}
                </span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-zinc-400 transition-transform shrink-0 ${open === item.id ? "rotate-180" : ""}`}
              />
            </Button>
            {open === item.id && (
              <div className="px-3 pb-3 text-xs text-zinc-500 leading-relaxed border-t border-zinc-100 pt-2">
                {item.content}
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-zinc-400 mt-4 leading-relaxed">
        By continuing, you acknowledge that you have read and agree to our
        terms.
      </p>
    </div>
  );
}

// ── Step 1: Name & Email ──────────────────────────────────────────────────────

function Step1({ onNext }: { onNext: () => void }) {
  const {
    register,
    trigger,
    formState: { errors },
  } = useFormContext<OnboardingFormData>();

  async function handleNext() {
    const valid = await trigger([...STEP1_FIELDS]);
    if (valid) onNext();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleNext();
      }}
      className="space-y-4"
    >
      <ProgressBar step={1} total={4} />
      <p className="text-xs font-semibold text-yellow-500 uppercase tracking-wide">
        Step 1/4
      </p>
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-900">
          Let's start with your name and email
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Let's get you set up. It only takes a minute.
        </p>
      </div>

      <div className="pt-2 space-y-4">
        <div>
          <FieldLabel required>Full Name</FieldLabel>
          <Input
            {...register("fullName")}
            placeholder="Your full name"
            className={`w-full rounded-lg h-auto px-4 py-2.5 text-sm placeholder:text-zinc-400 transition-colors ${
              errors.fullName
                ? "border-red-400 focus-visible:border-red-400"
                : "border-zinc-300 focus-visible:ring-primary/30 focus-visible:border-primary"
            }`}
          />
          <InlineError message={errors.fullName?.message} />
        </div>
        <div>
          <FieldLabel required>Email</FieldLabel>
          <Input
            {...register("email")}
            type="email"
            placeholder="your@email.com"
            className={`w-full rounded-lg h-auto px-4 py-2.5 text-sm placeholder:text-zinc-400 transition-colors ${
              errors.email
                ? "border-red-400 focus-visible:border-red-400"
                : "border-zinc-300 focus-visible:ring-primary/30 focus-visible:border-primary"
            }`}
          />
          <InlineError message={errors.email?.message} />
        </div>
      </div>

      <Button
        type="submit"
        className="w-full rounded-xl bg-primary h-auto py-3 text-sm font-bold text-zinc-900 hover:bg-primary/90 mt-2"
      >
        Continue
      </Button>
    </form>
  );
}

// ── Step 2: Business Details ──────────────────────────────────────────────────

function Step2({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const {
    register,
    trigger,
    formState: { errors },
  } = useFormContext<OnboardingFormData>();

  async function handleNext() {
    const valid = await trigger([...STEP2_FIELDS]);
    if (valid) onNext();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleNext();
      }}
      className="space-y-4"
    >
      <ProgressBar step={2} total={4} />
      <p className="text-xs font-semibold text-yellow-500 uppercase tracking-wide">
        Step 2/4
      </p>
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-900">
          Business Details
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Let's get you set up. It only takes a minute.
        </p>
      </div>

      <div className="pt-2 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel>Fitment Contact Person</FieldLabel>
            <Input
              {...register("contactPerson")}
              placeholder="Contact person name"
              className={`w-full rounded-lg h-auto px-4 py-2.5 text-sm placeholder:text-zinc-400 transition-colors ${
                errors.contactPerson
                  ? "border-red-400 focus-visible:border-red-400"
                  : "border-zinc-300 focus-visible:ring-primary/30 focus-visible:border-primary"
              }`}
            />
            <InlineError message={errors.contactPerson?.message} />
          </div>
          <div>
            <FieldLabel>Fitment Contact Email</FieldLabel>
            <Input
              {...register("contactEmail")}
              type="email"
              placeholder="contact@yourbusiness.com"
              className={`w-full rounded-lg h-auto px-4 py-2.5 text-sm placeholder:text-zinc-400 transition-colors ${
                errors.contactEmail
                  ? "border-red-400 focus-visible:border-red-400"
                  : "border-zinc-300 focus-visible:ring-primary/30 focus-visible:border-primary"
              }`}
            />
            <InlineError message={errors.contactEmail?.message} />
          </div>
        </div>

        <ConfirmField
          fieldName="address"
          confirmedName="addressConfirmed"
          label="Confirm Your Address"
          placeholder="e.g. 41 Musgrave Rd, Coopers Plains"
        />
        <ConfirmField
          fieldName="mobileNumber"
          confirmedName="mobileConfirmed"
          label="Mobile No: (Must be Mobile Number)"
          placeholder="04XX XXX XXX"
          type="tel"
        />
        <ConfirmField
          fieldName="businessNumber"
          confirmedName="businessConfirmed"
          label="Business Number"
          placeholder="ABN (11 digits) or ACN (9 digits)"
        />
      </div>

      <div className="flex gap-3 pt-1">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="flex-1 rounded-xl border-zinc-300 h-auto py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Back
        </Button>
        <Button
          type="submit"
          className="flex-[2] rounded-xl bg-primary h-auto py-3 text-sm font-bold text-zinc-900 hover:bg-primary/90"
        >
          Continue
        </Button>
      </div>
    </form>
  );
}

// ── Step 3: Services & Hours ──────────────────────────────────────────────────

function Step3({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const {
    watch,
    trigger,
    setValue,
    formState: { errors },
  } = useFormContext<OnboardingFormData>();

  const workingHours = watch("workingHours");
  const wheelAlignmentAvailable = watch("wheelAlignmentAvailable");
  const mobileFittingAvailable = watch("mobileFittingAvailable");
  const wheelAlignmentPrice = watch("wheelAlignmentPrice");
  const fitsPassengerSuv = watch("fitsPassengerSuv");
  const fitsWheelPackages = watch("fitsWheelPackages");
  const fitsTruck = watch("fitsTruck");

  function updateHour(idx: number, patch: Partial<WorkingHour>) {
    const updated = workingHours.map((h, i) =>
      i === idx ? { ...h, ...patch } : h,
    );
    setValue("workingHours", updated, { shouldDirty: true });
  }

  async function handleNext() {
    const valid = await trigger([...STEP3_FIELDS]);
    if (valid) onNext();
  }

  const fittingError = errors.fitsPassengerSuv?.message as string | undefined;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleNext();
      }}
      className="space-y-5"
    >
      <ProgressBar step={3} total={4} />
      <p className="text-xs font-semibold text-yellow-500 uppercase tracking-wide">
        Step 3/4
      </p>
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-900">
          Services Capabilities &amp; Hours
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Select the services you offer and your operating hours.
        </p>
      </div>

      {/* Fitting Options */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
          Fitting Options
        </p>
        <YesNoField
          label="Can you fit Passenger car/4x4/SUV Tyres?"
          name="fitsPassengerSuv"
          value={fitsPassengerSuv}
          onChange={(v) =>
            setValue("fitsPassengerSuv", v, { shouldDirty: true })
          }
        />
        <YesNoField
          label="Can You Install tyres and wheel packages?"
          name="fitsWheelPackages"
          value={fitsWheelPackages}
          onChange={(v) =>
            setValue("fitsWheelPackages", v, { shouldDirty: true })
          }
        />
        <YesNoField
          label="Truck tyres fittings?"
          name="fitsTruck"
          value={fitsTruck}
          onChange={(v) => setValue("fitsTruck", v, { shouldDirty: true })}
        />
        <InlineError message={fittingError} />
      </div>

      {/* Additional Services */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-3">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
          Additional Services
        </p>

        {/* Wheel Alignment */}
        <div
          className={`rounded-lg border p-3 transition-colors ${wheelAlignmentAvailable ? "border-yellow-300 bg-primary" : "border-zinc-100"}`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-800">
                Wheel Alignment Available
              </p>
              <p className="text-xs text-zinc-500">
                Professional wheel alignment service
              </p>
              {wheelAlignmentAvailable && (
                <div className="mt-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-600 shrink-0">
                      Pricing
                    </span>
                    <div
                      className={`flex items-center border rounded-lg overflow-hidden bg-white focus-within:ring-2 focus-within:border-yellow-400 w-28 ${
                        errors.wheelAlignmentPrice
                          ? "border-red-400 focus-within:ring-red-400/30"
                          : "border-zinc-300 focus-within:ring-yellow-400/30"
                      }`}
                    >
                      <span className="px-2 text-sm text-zinc-400 select-none">
                        $
                      </span>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={wheelAlignmentPrice}
                        onChange={(e) =>
                          setValue("wheelAlignmentPrice", e.target.value, {
                            shouldDirty: true,
                          })
                        }
                        placeholder="0.00"
                        className="flex-1 w-0 py-1.5 pr-2 text-sm text-zinc-900 bg-white border-0 shadow-none outline-none ring-0 focus-visible:ring-0 focus-visible:border-0 placeholder:text-zinc-400 h-auto rounded-none"
                      />
                    </div>
                  </div>
                  <InlineError message={errors.wheelAlignmentPrice?.message} />
                </div>
              )}
            </div>
            <Switch
              checked={wheelAlignmentAvailable}
              onCheckedChange={(v) => {
                setValue("wheelAlignmentAvailable", v, { shouldDirty: true });
                if (!v)
                  setValue("wheelAlignmentPrice", "", { shouldDirty: true });
              }}
              className="shrink-0 data-[state=checked]:bg-zinc-800"
            />
          </div>
        </div>

        {/* Mobile Fitting */}
        <div
          className={`rounded-lg border p-3 transition-colors ${mobileFittingAvailable ? "border-yellow-300 bg-primary" : "border-zinc-100"}`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-800">
                Mobile Fitting Available
              </p>
              <p className="text-xs text-zinc-500">
                We come to you for fitting
              </p>
            </div>
            <Switch
              checked={mobileFittingAvailable}
              onCheckedChange={(v) =>
                setValue("mobileFittingAvailable", v, { shouldDirty: true })
              }
              className="shrink-0 data-[state=checked]:bg-zinc-800"
            />
          </div>
        </div>
      </div>

      {/* Working Hours */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">
          Working Days &amp; Timings
        </p>
        <div className="space-y-3">
          {workingHours.map((h, idx) => {
            const closeTimeError = (
              errors.workingHours as
                | Record<number, { closeTime?: { message?: string } }>
                | undefined
            )?.[idx]?.closeTime?.message;

            return (
              <div key={h.day} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-zinc-700">
                    {h.label}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Checkbox
                      id={`closed-${h.day}`}
                      checked={h.isClosed}
                      onCheckedChange={(checked) =>
                        updateHour(idx, { isClosed: !!checked })
                      }
                      className="size-3.5"
                    />
                    <Label
                      htmlFor={`closed-${h.day}`}
                      className="text-xs text-zinc-500 font-normal cursor-pointer"
                    >
                      Closed
                    </Label>
                  </div>
                </div>
                {!h.isClosed && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 pl-0 sm:pl-2">
                      <span className="text-xs text-zinc-400 w-8 shrink-0">
                        From
                      </span>
                      <Select
                        value={h.openTime}
                        onValueChange={(v) => updateHour(idx, { openTime: v })}
                      >
                        <SelectTrigger className="flex-1 h-8 text-xs rounded-lg border-zinc-300 focus:ring-yellow-400/30">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent position="popper">
                          {TIME_OPTIONS.map((t) => (
                            <SelectItem key={t} value={t} className="text-xs">
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-xs text-zinc-400 shrink-0">to</span>
                      <Select
                        value={h.closeTime}
                        onValueChange={(v) => updateHour(idx, { closeTime: v })}
                      >
                        <SelectTrigger
                          className={`flex-1 h-8 text-xs rounded-lg ${
                            closeTimeError
                              ? "border-red-400"
                              : "border-zinc-300 focus:ring-yellow-400/30"
                          }`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent position="popper">
                          {TIME_OPTIONS.map((t) => (
                            <SelectItem key={t} value={t} className="text-xs">
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <InlineError message={closeTimeError} />
                  </div>
                )}
                {h.isClosed && (
                  <p className="text-xs text-zinc-400 pl-0 sm:pl-2">
                    Closed all day
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-3 pt-1">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="flex-1 rounded-xl border-zinc-300 h-auto py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Back
        </Button>
        <Button
          type="submit"
          className="flex-[2] rounded-xl bg-primary h-auto py-3 text-sm font-bold text-zinc-900 hover:bg-primary/90"
        >
          Continue
        </Button>
      </div>
    </form>
  );
}

// ── Step 4: Review & Submit ───────────────────────────────────────────────────

function ReviewRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-sm font-medium text-zinc-800 mt-0.5 break-words">
        {value || "—"}
      </p>
    </div>
  );
}

function Step4({
  data,
  onBack,
  onSubmit,
  submitting,
}: {
  data: OnboardingFormData;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const alignmentPrice =
    data.wheelAlignmentAvailable && data.wheelAlignmentPrice
      ? `$${parseFloat(data.wheelAlignmentPrice).toFixed(2)}`
      : null;

  return (
    <div className="space-y-5">
      <ProgressBar step={4} total={4} />
      <p className="text-xs font-semibold text-yellow-500 uppercase tracking-wide">
        Step 4/4
      </p>
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-900">
          Review &amp; Submit
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Please review your details before submitting.
        </p>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-3">
            <User className="w-4 h-4 text-zinc-500" />
            <p className="text-sm font-semibold text-zinc-800">
              Contact Information
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-dashed border-zinc-100 pt-3">
            <ReviewRow label="Name" value={data.fullName} />
            <ReviewRow label="Email" value={data.email} />
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-4 h-4 text-zinc-500" />
            <p className="text-sm font-semibold text-zinc-800">
              Business Details
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-dashed border-zinc-100 pt-3">
            <ReviewRow
              label="Fitment Contact Person"
              value={data.contactPerson}
            />
            <ReviewRow label="Contact Email" value={data.contactEmail} />
            <ReviewRow label="Mobile Number" value={data.mobileNumber} />
            <ReviewRow label="Business Number" value={data.businessNumber} />
            <div className="sm:col-span-2">
              <ReviewRow label="Business Address" value={data.address} />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-3">
            <Wrench className="w-4 h-4 text-zinc-500" />
            <p className="text-sm font-semibold text-zinc-800">
              Services &amp; Hours
            </p>
          </div>
          <div className="border-t border-dashed border-zinc-100 pt-3 space-y-4">
            {/* Fitting capabilities */}
            <div>
              <p className="text-xs text-zinc-500 mb-1.5">
                Fitting Capabilities
              </p>
              <div className="flex flex-wrap gap-1.5">
                {data.fitsPassengerSuv && (
                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
                    Passenger / 4x4 / SUV
                  </span>
                )}
                {data.fitsWheelPackages && (
                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
                    Wheel Packages
                  </span>
                )}
                {data.fitsTruck && (
                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
                    Truck Tyres
                  </span>
                )}
                {!data.fitsPassengerSuv &&
                  !data.fitsWheelPackages &&
                  !data.fitsTruck && (
                    <span className="text-xs text-zinc-400">None selected</span>
                  )}
              </div>
            </div>

            {/* Additional services */}
            <div>
              <p className="text-xs text-zinc-500 mb-1.5">
                Additional Services
              </p>
              {!data.wheelAlignmentAvailable && !data.mobileFittingAvailable ? (
                <p className="text-xs text-zinc-400">None selected</p>
              ) : (
                <div className="space-y-1.5">
                  {data.wheelAlignmentAvailable && (
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-yellow-800">
                        Wheel Alignment
                      </span>
                      <span className="text-xs font-medium text-zinc-700">
                        {alignmentPrice ?? "—"}
                      </span>
                    </div>
                  )}
                  {data.mobileFittingAvailable && (
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-yellow-800">
                        Mobile Fitting
                      </span>
                      <span className="text-xs text-zinc-400">Included</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Working hours — every day */}
            <div>
              <p className="text-xs text-zinc-500 mb-1.5">Working Hours</p>
              <div className="space-y-1">
                {data.workingHours.map((h) => (
                  <div
                    key={h.day}
                    className="flex items-center justify-between py-0.5"
                  >
                    <span className="text-xs font-medium text-zinc-700 w-32 shrink-0">
                      {h.label}
                    </span>
                    {h.isClosed ? (
                      <span className="text-xs text-zinc-400 italic">
                        Closed
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-600 tabular-nums">
                        {h.openTime} – {h.closeTime}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-1">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="flex-1 rounded-xl border-zinc-300 h-auto py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Back
        </Button>
        <Button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="flex-[2] rounded-xl bg-primary h-auto py-3 text-sm font-bold text-zinc-900 hover:bg-primary/90 disabled:opacity-60"
        >
          {submitting ? "Submitting..." : "Submit Application"}
        </Button>
      </div>
    </div>
  );
}

// ── Success screen ────────────────────────────────────────────────────────────

function SuccessScreen() {
  return (
    <div className="text-center py-8 space-y-4">
      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
        <CheckCircle2 className="w-8 h-8 text-green-600" />
      </div>
      <h2 className="text-2xl font-bold text-zinc-900">
        Application Submitted!
      </h2>
      <p className="text-sm text-zinc-500 max-w-sm mx-auto">
        Thank you for applying to join the Tyres & Car Valeting Fitter Network. Our team
        will review your application and reach out within 2 business days.
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OnboardingForm() {
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: DEFAULT_VALUES,
    mode: "onTouched",
  });

  function goToStep2() {
    const values = form.getValues();
    if (!values.contactPerson) form.setValue("contactPerson", values.fullName);
    if (!values.contactEmail) form.setValue("contactEmail", values.email);
    setStep(2);
  }

  async function handleSubmit() {
    const valid = await form.trigger();
    if (!valid) return;

    const data = form.getValues();
    setSubmitting(true);

    try {
      const payload = {
        fullName: data.fullName.trim(),
        email: data.email.trim().toLowerCase(),
        contactPerson: data.contactPerson?.trim() || undefined,
        contactEmail: data.contactEmail?.trim().toLowerCase() || undefined,
        address: data.address.trim(),
        mobileNumber: normalizePhone(data.mobileNumber),
        businessNumber: normalizeBusinessNumber(data.businessNumber),
        fitsPassengerSuv: data.fitsPassengerSuv ?? false,
        fitsWheelPackages: data.fitsWheelPackages ?? false,
        fitsTruck: data.fitsTruck ?? false,
        wheelAlignmentAvailable: data.wheelAlignmentAvailable,
        wheelAlignmentPrice: data.wheelAlignmentPrice
          ? parseFloat(data.wheelAlignmentPrice)
          : undefined,
        mobileFittingAvailable: data.mobileFittingAvailable,
        workingHours: data.workingHours.map((h) => ({
          day: h.day,
          is_closed: h.isClosed,
          open_time: h.openTime,
          close_time: h.closeTime,
        })),
      };

      const res = await fetch(`${API}/api/fitter/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toastError("Submission failed", json.message ?? "Please try again.");
        return;
      }

      setSubmitted(true);
      toastSuccess(
        "Application submitted!",
        "We'll be in touch within 2 business days.",
      );
    } catch {
      toastError(
        "Network error",
        "Please check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <div className="min-h-screen bg-zinc-100 flex flex-col">
        {/* Header */}
        <header className="shadow-sm bg-white border-b border-zinc-200 px-4 sm:px-6 lg:px-10 py-2">
          <Link href="/">
            <Image src="/logo_dark.svg" width={200} height={200} alt="Logo" />
          </Link>
        </header>

        <main className="flex-1 px-4 sm:px-6 lg:px-10 py-8 lg:py-12">
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 mb-6 lg:mb-8">
            Tyres & Car Valeting Onboarding
          </h1>

          <div className="flex flex-col lg:grid lg:grid-cols-[340px_1fr] gap-6">
            <div className="lg:self-start lg:sticky lg:top-8">
              <InfoPanel />
            </div>

            <div className="bg-white rounded-xl border border-zinc-200 p-5 sm:p-8">
              {submitted ? (
                <SuccessScreen />
              ) : step === 1 ? (
                <Step1 onNext={goToStep2} />
              ) : step === 2 ? (
                <Step2 onNext={() => setStep(3)} onBack={() => setStep(1)} />
              ) : step === 3 ? (
                <Step3 onNext={() => setStep(4)} onBack={() => setStep(2)} />
              ) : (
                <Step4
                  data={form.getValues()}
                  onBack={() => setStep(3)}
                  onSubmit={handleSubmit}
                  submitting={submitting}
                />
              )}
            </div>
          </div>
        </main>
      </div>
    </Form>
  );
}

