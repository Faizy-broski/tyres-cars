import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export interface CartItem {
  id:    string
  sku:   string
  name:  string
  size:  string
  price: number
  image: string | null
  stock: number
}

export type AddItemError = 'out_of_stock' | 'insufficient_stock' | 'api_error'

interface CartStore {
  items:           CartItem[]
  qty:             Record<string, number>
  isOpen:          boolean

  addItem:              (item: CartItem, quantity?: number) => Promise<{ error: AddItemError | null; available?: number }>
  removeItem:           (id: string) => void
  updateQuantity:       (id: string, qty: number) => void
  clearCart:            () => void
  openCart:             () => void
  closeCart:            () => void
  refreshPrices:        () => Promise<void>

  itemCount:    () => number
  subtotal:     () => number
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      qty:   {},
      isOpen: false,

      async addItem(item, quantity = 1) {
        const currentQty = get().qty[item.id] ?? 0
        const desiredQty = currentQty + quantity

        try {
          const res = await fetch(`${API}/api/cart/validate`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ items: [{ sku_id: item.id, qty: desiredQty }] }),
          })
          if (res.ok) {
            const body = await res.json()
            if (!body.valid && body.errors?.length) {
              const err = body.errors[0] as { sku_id: string; available: number }
              if (err.available === 0) return { error: 'out_of_stock' as AddItemError, available: 0 }
              const canAdd = err.available - currentQty
              if (canAdd <= 0) return { error: 'insufficient_stock' as AddItemError, available: err.available }
              set(state => {
                const existing = state.items.find(i => i.id === item.id)
                return {
                  items:  existing ? state.items : [...state.items, item],
                  qty:    { ...state.qty, [item.id]: err.available },
                  isOpen: true,
                }
              })
              return { error: 'insufficient_stock' as AddItemError, available: err.available }
            }
          }
        } catch { /* offline — optimistic add */ }

        set(state => {
          const existing = state.items.find(i => i.id === item.id)
          return {
            items:  existing ? state.items : [...state.items, item],
            qty:    { ...state.qty, [item.id]: desiredQty },
            isOpen: true,
          }
        })
        return { error: null }
      },

      removeItem(id) {
        set(state => {
          const { [id]: _removed, ...restQty } = state.qty
          return {
            items: state.items.filter(i => i.id !== id),
            qty:   restQty,
          }
        })
      },

      updateQuantity(id, newQty) {
        set(state => {
          if (newQty <= 0) {
            const { [id]: _removed, ...restQty } = state.qty
            return { items: state.items.filter(i => i.id !== id), qty: restQty }
          }
          const item   = state.items.find(i => i.id === id)
          const capped = item ? Math.min(newQty, item.stock) : newQty
          return { qty: { ...state.qty, [id]: capped } }
        })
      },

      clearCart() { set({ items: [], qty: {}, isOpen: false }) },
      openCart()  { set({ isOpen: true  }) },
      closeCart() { set({ isOpen: false }) },

      // Refreshes cart line prices from the server-authoritative /api/cart/prices
      // endpoint (never trust client-cached prices at checkout time).
      async refreshPrices() {
        const items = get().items
        if (!items.length) return
        try {
          const res = await fetch(`${API}/api/cart/prices`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ items: items.map(i => ({ product_id: i.id })) }),
          })
          if (!res.ok) return
          const body = await res.json() as { prices: Record<string, number> }
          set(state => ({
            items: state.items.map(i =>
              body.prices[i.id] != null ? { ...i, price: body.prices[i.id] } : i
            ),
          }))
        } catch { /* best-effort — keep last known prices offline */ }
      },

      itemCount() { return Object.values(get().qty).reduce((s, q) => s + q, 0) },

      subtotal() {
        const { items, qty } = get()
        return items.reduce((s, i) => s + i.price * (qty[i.id] ?? 0), 0)
      },
    }),
    {
      name: 'tyrevault-cart-v2',
      partialize: (state) => ({
        items: state.items,
        qty:   state.qty,
      }),
    }
  )
)
