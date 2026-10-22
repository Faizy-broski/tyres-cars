"use client";
import Image from "next/image";
import Link from "next/link";
import { ShoppingCart, ImageOff, Mail, CalendarCheck } from "lucide-react";
import { useCartStore } from "@/stores/cart.store";
import InquiryModal from "@/components/storefront/InquiryModal";
import { ECOMMERCE_ENABLED } from "@/lib/features";

export interface BestSellerSku {
  product_id:        string;
  sku:               string;
  product_slug:      string | null;
  tyre_size_display: string;
  brand_name:        string;
  pattern_name:      string;
  main_image:        string | null;
  price_inc_gst:     number | null;
  total_available_stock: number;
  xl_reinforced:     boolean;
  runflat:           boolean;
}

function StockBadge({ stock }: { stock: number }) {
  if (stock === 0) return <span className="text-xs font-semibold text-red-500">Out of stock</span>
  if (stock <= 4)  return <span className="text-xs font-semibold text-amber-500">Low stock</span>
  return <span className="text-xs font-semibold text-emerald-500">In stock</span>
}

export default function TyreCard({ item }: { item: BestSellerSku }) {
  const addItem = useCartStore((s) => s.addItem);
  const href    = item.product_slug ? `/tyres/${item.product_slug}` : `/tyres?q=${encodeURIComponent(item.pattern_name)}`;
  const inStock = item.total_available_stock > 0;

  function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    if (!inStock || item.price_inc_gst == null) return;
    addItem({
      id:    item.product_id,
      sku:   item.sku,
      name:  `${item.brand_name} ${item.pattern_name}`,
      size:  item.tyre_size_display,
      price: item.price_inc_gst,
      image: item.main_image && item.main_image.startsWith("http") ? item.main_image : null,
      stock: item.total_available_stock,
    });
  }

  return (
    <div className="group flex bg-white rounded-2xl border border-zinc-100 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-200 overflow-hidden">

      {/* Left — image */}
      <Link href={href} className="relative shrink-0 w-[42%] bg-zinc-50 overflow-hidden">
        {item.main_image && item.main_image.startsWith("http") ? (
          <Image
            src={item.main_image}
            alt={item.pattern_name}
            fill
            className="object-contain p-4 group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 768px) 40vw, 20vw"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="relative flex items-center justify-center w-14 h-14 mb-1.5">
              <div className="absolute inset-0 rounded-full border-[3px] border-dashed border-zinc-200 animate-[spin_20s_linear_infinite]" />
              <div className="absolute inset-3 rounded-full border-2 border-zinc-200/80" />
              <ImageOff className="w-4 h-4 text-zinc-300" />
            </div>
            <span className="text-[8px] font-black text-zinc-300 uppercase tracking-widest">No Image</span>
          </div>
        )}
      </Link>

      {/* Right — details */}
      <div className="flex flex-col flex-1 min-w-0 p-4">
        {/* Brand */}
        <p className="text-[10px] font-black text-primary uppercase tracking-[0.25em] truncate mb-1">
          {item.brand_name}
        </p>

        {/* Name + size */}
        <Link href={href} className="block flex-1">
          <p className="text-base font-black text-zinc-900 leading-tight line-clamp-2 font-oswald uppercase tracking-wide">
            {item.pattern_name}
          </p>
          <p className="text-xs text-zinc-500 font-semibold mt-1">{item.tyre_size_display}</p>
          {(item.runflat || item.xl_reinforced) && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {item.runflat       && <span className="text-[10px] bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-md font-bold">Runflat</span>}
              {item.xl_reinforced && <span className="text-[10px] bg-primary/15 text-zinc-700 px-2 py-0.5 rounded-md font-bold">XL</span>}
            </div>
          )}
        </Link>

        {/* Price */}
        <div className="mt-2">
          {item.price_inc_gst != null ? (
            <p className="leading-none">
              <span className="text-xl font-black text-zinc-900">${item.price_inc_gst.toLocaleString()}</span>
              <span className="text-sm font-semibold text-zinc-400 ml-1">Each</span>
            </p>
          ) : (
            <p className="text-sm text-zinc-400 italic font-medium">Price on request</p>
          )}
          <div className="mt-1">
            <StockBadge stock={item.total_available_stock} />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-1.5 mt-3">
          {!inStock || !ECOMMERCE_ENABLED ? (
            <InquiryModal
              productId={item.product_id}
              sku={item.sku}
              productName={`${item.brand_name} ${item.pattern_name}`}
              tyreSizeDisplay={item.tyre_size_display}
              productUrl={href}
              variant={inStock ? "booking" : "inquiry"}
              trigger={
                <button
                  type="button"
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-primary hover:brightness-110 active:scale-95 transition-all duration-150 py-2.5 text-sm font-bold text-zinc-900"
                >
                  {inStock
                    ? <><CalendarCheck className="w-4 h-4" />Book Now</>
                    : <><Mail className="w-4 h-4" />Send Inquiry</>}
                </button>
              }
            />
          ) : (
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={item.price_inc_gst == null}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-primary hover:brightness-110 active:scale-95 transition-all duration-150 py-2.5 text-sm font-bold text-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ShoppingCart className="w-4 h-4" />
              Add to cart
            </button>
          )}
          <Link
            href={href}
            className="w-full flex items-center justify-center rounded-lg border-2 border-primary py-2 text-sm font-bold text-zinc-900 hover:bg-primary/10 transition-colors"
          >
            View details
          </Link>
        </div>
      </div>
    </div>
  );
}
