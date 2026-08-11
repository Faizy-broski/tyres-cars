"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Clock3, CircleDot, User, Search, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { stagger, slideRight } from "./motion-variants";
import { SelectorDialog } from "./SelectorDialog";
import { toastError, toastWarning } from "@/lib/toast";
import {
  POPULAR_MAKES,
  TYRE_WIDTHS,
  POPULAR_WIDTHS,
  PROFILES,
  POPULAR_PROFILES,
  RIM_DIAMETERS,
  POPULAR_RIMS,
} from "./hero-data";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Variant {
  vehicle_id: string;
  variant: string | null;
  series: string | null;
  body_type: string | null;
}

function variantLabel(v: Variant): string {
  return [v.variant, v.series, v.body_type].filter(Boolean).join(" · ") || "Standard";
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const vehicleSchema = z.object({
  make: z.string().min(1),
  model: z.string().min(1),
  year: z.string().min(1),
  variant: z.string().min(1),
});

const tyreSizeSchema = z.object({
  width: z.string().min(1),
  profile: z.string().min(1),
  rim: z.string().min(1),
});

type VehicleFormData = z.infer<typeof vehicleSchema>;
type TyreSizeFormData = z.infer<typeof tyreSizeSchema>;
type ActiveDialog =
  | "make"
  | "model"
  | "year"
  | "variant"
  | "width"
  | "profile"
  | "rim"
  | null;

// ─── Static ───────────────────────────────────────────────────────────────────

const stats = [
  {
    value: "24HR",
    label: "Fast Delivery",
    icon: <Clock3 className="h-5 w-5 stroke-[1.5]" />,
  },
  {
    value: "500+",
    label: "Tyre Options",
    icon: <CircleDot className="h-5 w-5 stroke-[1.5]" />,
    offset: "mr-20",
  },
  {
    value: "4.9★",
    label: "Customer Rating",
    icon: <User className="h-5 w-5 stroke-[1.5]" />,
    offset: "mr-4",
  },
];

// ─── TriggerField ─────────────────────────────────────────────────────────────

interface TriggerFieldProps {
  label: string;
  placeholder: string;
  value?: string;
  disabled?: boolean;
  onClick: () => void;
}

function TriggerField({
  label,
  placeholder,
  value,
  disabled,
  onClick,
}: TriggerFieldProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={
        value ? `${label}: ${value}. Click to change` : `Select ${label}`
      }
      className={cn(
        "w-full rounded-[26px] border text-left transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d9a407]/40",
        disabled
          ? "cursor-not-allowed border-gray-200 bg-gray-50 opacity-50"
          : value
            ? "cursor-pointer border-amber-400/40 bg-white hover:border-amber-400/60 hover:bg-amber-50/40 active:scale-[0.99]"
            : "cursor-pointer border-gray-300/80 bg-white hover:border-gray-400/90 hover:bg-gray-50/70 active:scale-[0.99]",
      )}
    >
      <div className="flex items-center justify-between px-4 pb-3 pt-3.5 sm:px-6 sm:pb-4 sm:pt-5">
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-[9px] font-black uppercase tracking-[0.24em] text-black/80 sm:mb-2 sm:text-[11px] sm:tracking-[0.32em]">
            {label}
          </p>
          <p
            className={cn(
              "truncate text-sm font-semibold sm:text-[17px]",
              value ? "text-zinc-900" : "text-zinc-800",
            )}
          >
            {value || placeholder}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "ml-2 h-4 w-4 shrink-0 transition-colors",
            disabled
              ? "text-gray-300"
              : value
                ? "text-[#d9a407]"
                : "text-gray-400",
          )}
        />
      </div>
    </button>
  );
}

// ─── HeroSection ──────────────────────────────────────────────────────────────

export default function HeroSection() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"vehicle" | "size">("vehicle");
  const [openDialog, setOpenDialog] = useState<ActiveDialog>(null);
  const [searching, setSearching] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState<Record<string, boolean>>({
    make: false,
    model: false,
    year: false,
    variant: false,
  });

  // ── Dynamic vehicle data ───────────────────────────────────────────────────

  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [years, setYears] = useState<string[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [variantId, setVariantId] = useState("");
  // label → vehicle_id lookup built when variants load
  const [variantLabelMap, setVariantLabelMap] = useState(
    new Map<string, string>(),
  );

  // ── Forms ──────────────────────────────────────────────────────────────────

  const vehicleForm = useForm<VehicleFormData>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: { make: "", model: "", year: "", variant: "" },
  });
  const v = vehicleForm.watch();

  const sizeForm = useForm<TyreSizeFormData>({
    resolver: zodResolver(tyreSizeSchema),
    defaultValues: { width: "", profile: "", rim: "" },
  });
  const s = sizeForm.watch();

  // ── Vehicle data fetching ──────────────────────────────────────────────────

  useEffect(() => {
    setLoadingOptions((prev) => ({ ...prev, make: true }));
    fetch(`${API}/api/vehicles/makes`)
      .then((r) => r.json())
      .then(setMakes)
      .catch(() => {})
      .finally(() => setLoadingOptions((prev) => ({ ...prev, make: false })));
  }, []);

  useEffect(() => {
    if (!v.make) {
      setModels([]);
      return;
    }
    setLoadingOptions((prev) => ({ ...prev, model: true }));
    fetch(`${API}/api/vehicles/models?make=${encodeURIComponent(v.make)}`)
      .then((r) => r.json())
      .then(setModels)
      .catch(() => {})
      .finally(() => setLoadingOptions((prev) => ({ ...prev, model: false })));
  }, [v.make]);

  useEffect(() => {
    if (!v.make || !v.model) {
      setYears([]);
      return;
    }
    setLoadingOptions((prev) => ({ ...prev, year: true }));
    fetch(
      `${API}/api/vehicles/years?make=${encodeURIComponent(v.make)}&model=${encodeURIComponent(v.model)}`,
    )
      .then((r) => r.json())
      .then((data: number[]) => setYears(data.map(String)))
      .catch(() => {})
      .finally(() => setLoadingOptions((prev) => ({ ...prev, year: false })));
  }, [v.make, v.model]);

  useEffect(() => {
    if (!v.make || !v.model || !v.year) {
      setVariants([]);
      setVariantLabelMap(new Map());
      return;
    }
    setLoadingOptions((prev) => ({ ...prev, variant: true }));
    fetch(
      `${API}/api/vehicles/variants?make=${encodeURIComponent(v.make)}&model=${encodeURIComponent(v.model)}&year=${v.year}`,
    )
      .then((r) => r.json())
      .then((data: Variant[]) => {
        setVariants(data);
        const map = new Map<string, string>();
        for (const variant of data) map.set(variantLabel(variant), variant.vehicle_id);
        setVariantLabelMap(map);
      })
      .catch(() => {})
      .finally(() => setLoadingOptions((prev) => ({ ...prev, variant: false })));
  }, [v.make, v.model, v.year]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const variantDisplayLabels = variants.map(variantLabel);
  const vehicleComplete = !!(v.make && v.model && v.year && v.variant);
  const sizeComplete = !!(s.width && s.profile && s.rim);
  const canSearch = activeTab === "vehicle" ? vehicleComplete : sizeComplete;

  // ── Tab switching ──────────────────────────────────────────────────────────

  const handleTabSwitch = (tab: "vehicle" | "size") => {
    if (tab === activeTab) return;
    if (activeTab === "vehicle") vehicleForm.reset();
    else sizeForm.reset();
    setActiveTab(tab);
    setOpenDialog(null);
  };

  // ── Vehicle handlers ───────────────────────────────────────────────────────

  const handleMakeSelect = useCallback(
    (value: string) => {
      if (vehicleForm.getValues("make") !== value) {
        vehicleForm.setValue("make", value);
        vehicleForm.setValue("model", "");
        vehicleForm.setValue("year", "");
        vehicleForm.setValue("variant", "");
        setVariantId("");
      }
      setOpenDialog("model");
    },
    [vehicleForm],
  );

  const handleModelSelect = useCallback(
    (value: string) => {
      if (vehicleForm.getValues("model") !== value) {
        vehicleForm.setValue("model", value);
        vehicleForm.setValue("year", "");
        vehicleForm.setValue("variant", "");
        setVariantId("");
      }
      setOpenDialog("year");
    },
    [vehicleForm],
  );

  const handleYearSelect = useCallback(
    (value: string) => {
      if (vehicleForm.getValues("year") !== value) {
        vehicleForm.setValue("year", value);
        vehicleForm.setValue("variant", "");
        setVariantId("");
      }
      setOpenDialog("variant");
    },
    [vehicleForm],
  );

  const handleVariantSelect = useCallback(
    (label: string) => {
      vehicleForm.setValue("variant", label);
      setVariantId(variantLabelMap.get(label) ?? "");
      setOpenDialog(null);
    },
    [vehicleForm, variantLabelMap],
  );

  // ── Tyre size handlers ─────────────────────────────────────────────────────

  const handleWidthSelect = useCallback(
    (value: string) => {
      if (sizeForm.getValues("width") !== value) {
        sizeForm.setValue("width", value);
        sizeForm.setValue("profile", "");
        sizeForm.setValue("rim", "");
      }
      setOpenDialog("profile");
    },
    [sizeForm],
  );

  const handleProfileSelect = useCallback(
    (value: string) => {
      if (sizeForm.getValues("profile") !== value) {
        sizeForm.setValue("profile", value);
        sizeForm.setValue("rim", "");
      }
      setOpenDialog("rim");
    },
    [sizeForm],
  );

  const handleRimSelect = useCallback(
    (value: string) => {
      sizeForm.setValue("rim", value);
      setOpenDialog(null);
    },
    [sizeForm],
  );

  // ── Search submit ──────────────────────────────────────────────────────────

  const handleSearch = async () => {
    if (!canSearch || searching) return;

    if (activeTab === "size") {
      setSearching(true);
      router.push(`/tyres?width=${s.width}&profile=${s.profile}&rim_size=${s.rim}`);
      return;
    }

    if (!variantId) {
      toastError("Vehicle not found", "Please re-select your variant and try again.");
      return;
    }

    setSearching(true);
    try {
      const res = await fetch(
        `${API}/api/vehicles/fitment?variantId=${variantId}`,
      );

      if (!res.ok) {
        toastError("Could not load fitment data", "Please try again in a moment.");
        setSearching(false);
        return;
      }

      const data = await res.json();

      if (!Array.isArray(data) || !data.length) {
        toastWarning("No tyre fitment found", "We don't have fitment data for this vehicle yet. Try searching by tyre size instead.");
        setSearching(false);
        return;
      }

      const match = (data[0].front_size as string).match(
        /^(\d+)\/(\d+)[rR](\d+)/,
      );
      if (!match) {
        toastError("Invalid fitment data", "The tyre size for this vehicle is not in a recognised format.");
        setSearching(false);
        return;
      }

      const [, width, profile, rim] = match;
      router.push(`/tyres?width=${width}&profile=${profile}&rim_size=${rim}`);
      // searching stays true — component unmounts on navigation, no flash back to "Find Tyres"
    } catch {
      toastError("Search failed", "Could not connect to the server. Please check your connection and try again.");
      setSearching(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────

  return (
    <section className="relative min-h-[420px] overflow-hidden bg-[url('/heroBg.svg')] bg-cover bg-center bg-no-repeat text-white sm:min-h-[480px] md:min-h-[600px]">
      <div className="relative z-10 mx-auto max-w-[1400px] px-4 pb-8 pt-20 sm:px-6 sm:pb-12 sm:pt-24 lg:px-10 lg:pb-14 lg:pt-28">
        <div className="grid items-center gap-8 lg:min-h-[420px] lg:grid-cols-12">
          {/* Heading */}
          <div className="lg:col-span-7">
            <div className="uppercase text-[#f8f4ea]">
              <h1 className="origin-bottom font-oswald font-black leading-[0.85] tracking-[-0.06em] [transform:scaleY(1.15)] text-[60px] sm:text-[80px] md:text-[110px] lg:text-[128px]">
                PERFECT
              </h1>
              <div className="-mt-1 flex items-end gap-3 sm:gap-4 md:-mt-2">
                <h1 className="font-oswald font-black leading-none tracking-[-0.06em] text-[60px] sm:text-[80px] md:text-[110px] lg:text-[128px]">
                  TYRES
                </h1>
                <div className="mb-2 flex flex-col font-oswald font-semibold leading-[0.9] tracking-[-0.04em] text-[18px] sm:text-[24px] md:text-[32px] lg:text-[40px]">
                  <span>FOR</span>
                  <span>EVERY</span>
                  <span>VEHICLE</span>
                </div>
              </div>
            </div>
            <p className="mt-6 max-w-lg text-sm leading-relaxed text-zinc-300 sm:text-base md:text-lg">
              Search by size, vehicle, or brand and get the best deals instantly
              — from the world&apos;s most trusted tyre makers.
            </p>
          </div>

          {/* Stat badges */}
          <motion.div
            className="hidden lg:col-span-5 lg:flex lg:flex-col lg:items-end lg:gap-5 lg:pt-6"
            initial="hidden"
            animate="visible"
            variants={stagger}
          >
            {stats.map((stat) => (
              <motion.div
                key={stat.label}
                variants={slideRight}
                className={`flex w-56 items-center justify-between rounded-full border border-white/10 bg-black/40 px-5 py-2.5 backdrop-blur-md transition-all duration-200 hover:scale-105 hover:border-white/20 hover:bg-black/55 ${stat.offset ?? ""}`}
              >
                <div>
                  <p className="text-2xl font-black tracking-tight text-white">
                    {stat.value}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    {stat.label}
                  </p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-400">
                  {stat.icon}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* ── Search widget ────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-[20px] border border-black/8 bg-[#F8F4EA] shadow-[0_12px_40px_rgba(0,0,0,0.3)] backdrop-blur-2xl sm:rounded-[34px] sm:shadow-[0_20px_80px_rgba(0,0,0,0.35)]"
        >
          {/* Tab switcher */}
          <div className="grid grid-cols-2 bg-[#EFEBE2] p-1.5 sm:p-2">
            <button
              onClick={() => handleTabSwitch("size")}
              className={cn(
                "relative h-10 rounded-full text-xs font-bold transition-all duration-300 sm:h-[64px] sm:text-lg",
                activeTab === "size"
                  ? "bg-[#d9a407] text-white shadow-lg"
                  : "text-gray-600 hover:text-black",
              )}
            >
              Search By Tyre Size
            </button>
            <button
              onClick={() => handleTabSwitch("vehicle")}
              className={cn(
                "relative h-10 rounded-full text-xs font-bold transition-all duration-300 sm:h-[64px] sm:text-lg",
                activeTab === "vehicle"
                  ? "bg-[#d9a407] text-white shadow-lg"
                  : "text-gray-600 hover:text-black",
              )}
            >
              Search By Vehicle
            </button>
          </div>

          {/* Fields */}
          <AnimatePresence mode="wait">
            {activeTab === "vehicle" ? (
              <motion.div
                key="vehicle"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
                className="grid grid-cols-2 gap-2 p-3 sm:gap-4 sm:p-6 lg:grid-cols-[1fr_1fr_1fr_1fr_220px]"
              >
                <TriggerField
                  label="Make"
                  placeholder="Select Make"
                  value={v.make}
                  onClick={() => setOpenDialog("make")}
                />
                <TriggerField
                  label="Model"
                  placeholder="Select Model"
                  value={v.model}
                  disabled={!v.make}
                  onClick={() => setOpenDialog("model")}
                />
                <TriggerField
                  label="Year"
                  placeholder="Select Year"
                  value={v.year}
                  disabled={!v.model}
                  onClick={() => setOpenDialog("year")}
                />
                <TriggerField
                  label="Variant"
                  placeholder="Select Variant"
                  value={v.variant}
                  disabled={!v.year}
                  onClick={() => setOpenDialog("variant")}
                />
                <Button
                  type="button"
                  onClick={handleSearch}
                  disabled={!vehicleComplete || searching}
                  className={cn(
                    "col-span-2 h-12 w-full rounded-[20px] text-sm font-bold transition-all duration-300 sm:h-full sm:min-h-[96px] sm:rounded-[26px] sm:text-lg lg:col-span-1 lg:w-auto",
                    vehicleComplete && !searching
                      ? "bg-[#d9a407] text-white hover:scale-[1.02] hover:bg-[#c89907] active:scale-[0.98]"
                      : "cursor-not-allowed bg-gray-300 text-black",
                  )}
                >
                  {searching ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <Search className="mr-2 h-5 w-5" />
                  )}
                  {searching ? "Searching..." : "Find Tyres"}
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="size"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
                className="grid grid-cols-2 gap-2 p-3 sm:gap-4 sm:p-6 lg:grid-cols-[1fr_1fr_1fr_220px]"
              >
                <TriggerField
                  label="Width"
                  placeholder="Select Width"
                  value={s.width ? `${s.width}mm` : ""}
                  onClick={() => setOpenDialog("width")}
                />
                <TriggerField
                  label="Profile"
                  placeholder="Select Profile"
                  value={s.profile ? `${s.profile}%` : ""}
                  disabled={!s.width}
                  onClick={() => setOpenDialog("profile")}
                />
                <TriggerField
                  label="Rim Diameter"
                  placeholder="Select Rim"
                  value={s.rim ? `${s.rim}"` : ""}
                  disabled={!s.profile}
                  onClick={() => setOpenDialog("rim")}
                />
                <Button
                  type="button"
                  onClick={handleSearch}
                  disabled={!sizeComplete}
                  className={cn(
                    "col-span-2 h-12 w-full rounded-[20px] text-sm font-bold transition-all duration-300 sm:h-full sm:min-h-[96px] sm:rounded-[26px] sm:text-lg lg:col-span-1 lg:w-auto",
                    sizeComplete
                      ? "bg-[#d9a407] text-white hover:scale-[1.02] hover:bg-[#c89907] active:scale-[0.98]"
                      : "cursor-not-allowed bg-gray-300 text-black",
                  )}
                >
                  <Search className="mr-2 h-5 w-5" />
                  Find Tyres
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* ── Vehicle dialogs ──────────────────────────────────────────────────── */}

      <SelectorDialog
        open={openDialog === "make"}
        onClose={() => setOpenDialog(null)}
        step="Step 1 of 4"
        title="Select Make"
        subtitle="Choose your vehicle manufacturer"
        options={makes}
        popularOptions={POPULAR_MAKES.filter((m) => makes.includes(m))}
        selected={v.make}
        onSelect={handleMakeSelect}
        isLoading={loadingOptions.make}
      />
      <SelectorDialog
        open={openDialog === "model"}
        onClose={() => setOpenDialog(null)}
        step="Step 2 of 4"
        title="Select Model"
        subtitle={
          v.make ? `Choose your ${v.make} model` : "Choose your vehicle model"
        }
        options={models}
        selected={v.model}
        onSelect={handleModelSelect}
        isLoading={loadingOptions.model}
      />
      <SelectorDialog
        open={openDialog === "year"}
        onClose={() => setOpenDialog(null)}
        step="Step 3 of 4"
        title="Select Year"
        subtitle="Choose the model year"
        options={years}
        selected={v.year}
        onSelect={handleYearSelect}
        isLoading={loadingOptions.year}
      />
      <SelectorDialog
        open={openDialog === "variant"}
        onClose={() => setOpenDialog(null)}
        step="Step 4 of 4"
        title="Select Variant"
        subtitle="Choose the vehicle specification"
        options={variantDisplayLabels}
        selected={v.variant}
        onSelect={handleVariantSelect}
        isLoading={loadingOptions.variant}
      />

      {/* ── Tyre size dialogs ─────────────────────────────────────────────────── */}

      <SelectorDialog
        open={openDialog === "width"}
        onClose={() => setOpenDialog(null)}
        step="Step 1 of 3"
        title="Select Width"
        subtitle="Section width in millimeters (e.g. 225)"
        options={TYRE_WIDTHS}
        popularOptions={POPULAR_WIDTHS}
        selected={s.width}
        onSelect={handleWidthSelect}
      />
      <SelectorDialog
        open={openDialog === "profile"}
        onClose={() => setOpenDialog(null)}
        step="Step 2 of 3"
        title="Select Profile"
        subtitle="Aspect ratio as a percentage (e.g. 45)"
        options={PROFILES}
        popularOptions={POPULAR_PROFILES}
        selected={s.profile}
        onSelect={handleProfileSelect}
      />
      <SelectorDialog
        open={openDialog === "rim"}
        onClose={() => setOpenDialog(null)}
        step="Step 3 of 3"
        title="Select Rim Diameter"
        subtitle="Wheel diameter in inches (e.g. 18)"
        options={RIM_DIAMETERS}
        popularOptions={POPULAR_RIMS}
        selected={s.rim}
        onSelect={handleRimSelect}
      />
    </section>
  );
}

