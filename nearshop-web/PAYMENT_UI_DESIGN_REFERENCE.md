# Payment UI Design Reference & Visual Guide

## 📱 Page Layout Overview

### Desktop View (1200px+)
```
┌─────────────────────────────────────────────────────────┐
│  ← Back  |  SECURE PAYMENT  |                           │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────────────────┐  ┌──────────────────┐    │
│  │                          │  │                  │    │
│  │  SELECT PAYMENT METHOD   │  │  ORDER SUMMARY   │    │
│  │                          │  │                  │    │
│  │  ┌────────────────────┐  │  │ ₹2,499          │    │
│  │  │ 💳 Razorpay        │  │  │                  │    │
│  │  │ Credit/Debit Card  │  │  │ 📦 4 Items      │    │
│  │  │ UPI, Wallets       │  │  │ ✓ Subtotal      │    │
│  │  │                    │  │  │ ✓ Delivery Fee  │    │
│  │  │ → Instant Payment  │  │  │ ✓ Discount      │    │
│  │  └────────────────────┘  │  │                  │    │
│  │                          │  │ 🚀 1-2 Days      │    │
│  │  ┌────────────────────┐  │  │ 💰 Money back    │    │
│  │  │ 📱 PhonePe (β)     │  │  │                  │    │
│  │  │ UPI, Cards, BNPL   │  │  └──────────────────┘    │
│  │  │ Instant Cashback   │  │                          │
│  │  │                    │  │                          │
│  │  │ → Instant Payment  │  │                          │
│  │  └────────────────────┘  │                          │
│  │                          │                          │
│  │  ┌────────────────────┐  │                          │
│  │  │ 💰 Google Pay      │  │                          │
│  │  │ UPI, Cards         │  │                          │
│  │  │ One-tap checkout   │  │                          │
│  │  │                    │  │                          │
│  │  │ → Instant Payment  │  │                          │
│  │  └────────────────────┘  │                          │
│  │                          │                          │
│  │  ┌────────────────────┐  │                          │
│  │  │ 🚚 Cash on Delivery│  │                          │
│  │  │ Pay on delivery    │  │                          │
│  │  │ Risk-free option   │  │                          │
│  │  │                    │  │                          │
│  │  │ → On Delivery      │  │                          │
│  │  └────────────────────┘  │                          │
│  │                          │                          │
│  │  🔒 All payments are    │                          │
│  │     encrypted and secure│                          │
│  │                          │                          │
│  │  [PAY ₹2,499 NOW] ────→ │                          │
│  │                          │                          │
│  └──────────────────────────┘                          │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### Mobile View (375px)
```
┌──────────────────────────┐
│ ← Back     PAYMENT       │
├──────────────────────────┤
│                          │
│ SELECT PAYMENT METHOD    │
│                          │
│ ┌────────────────────┐   │
│ │ 💳 Razorpay        │   │
│ │ Credit/Debit Card  │   │
│ │ UPI, Wallets       │   │
│ │ → Instant Payment  │   │
│ └────────────────────┘   │
│                          │
│ ┌────────────────────┐   │
│ │ 📱 PhonePe (β)     │   │
│ │ UPI, Cards, BNPL   │   │
│ │ → Instant Payment  │   │
│ └────────────────────┘   │
│                          │
│ ┌────────────────────┐   │
│ │ 💰 Google Pay      │   │
│ │ UPI, Cards         │   │
│ │ → Instant Payment  │   │
│ └────────────────────┘   │
│                          │
│ ┌────────────────────┐   │
│ │ 🚚 Cash on Delivery│   │
│ │ Pay on delivery    │   │
│ │ → On Delivery      │   │
│ └────────────────────┘   │
│                          │
│ [PAY ₹2,499 NOW]         │
│                          │
│ ───────────────────────  │
│ ORDER SUMMARY            │
│ ───────────────────────  │
│ ₹2,499                   │
│                          │
│ 🔒 Secure & Encrypted    │
│                          │
└──────────────────────────┘
```

## 💳 Payment Method Card States

### Default State (Unselected)
```
┌─────────────────────────────┐
│ 💳                          │
│ RAZORPAY                    │
│ Credit/Debit Card, UPI...   │
│                             │
│ • Instant Payment           │
│ • Secure                    │
│ • 200+ payment methods      │
│                             │
│ Instant    No Fee           │
└─────────────────────────────┘
```

### Hover State
```
┌─────────────────────────────┐
│ (Shadow increased, slight   │
│  scale up to 1.02)          │
│                             │
│ 💳                          │
│ RAZORPAY                    │
│ Credit/Debit Card, UPI...   │
│                             │
│ • Instant Payment           │
│ • Secure                    │
│ • 200+ payment methods      │
│                             │
│ Instant    No Fee           │
└─────────────────────────────┘
```

### Selected State
```
┌─────────────────────────────┐  <- Gradient background
│ 💳              ✓ (animated) |  (purple-indigo)
│ RAZORPAY              (scale |  
│ Credit/Debit Card, UPI... → |  up to 1.05)
│                             │
│ • Instant Payment           │
│ • Secure                    │
│ • 200+ payment methods      │
│                             │
│ Instant    ➜ (animated)    │
└─────────────────────────────┘
```

## ⏳ Payment Processing Modal

```
┌──────────────────────────────────┐
│ (Dark backdrop with opacity 0.5) │
│                                  │
│  ┌────────────────────────────┐  │
│  │ [Purple gradient header]    │  │
│  │ Processing Payment           │  │
│  │ ₹2,499                       │  │
│  ├────────────────────────────┤  │
│  │                            │  │
│  │ Order: ORD-1234567890      │  │
│  │                            │  │
│  │  🔌 ──→ ⏳                 │  │
│  │ (animated pulse)            │  │
│  │                            │  │
│  │ [████████░░░░░░░░░░░░] 45% │  │
│  │ 45% Completed              │  │
│  │                            │  │
│  │ ⏳ Verifying payment...    │  │
│  │ ⏳ Securing transaction...  │  │
│  │ ✓ Confirming with gateway   │  │
│  │                            │  │
│  │ [Cancel Payment] (grayed)  │  │
│  │                            │  │
│  └────────────────────────────┘  │
│                                  │
│  (Gradient bottom border)        │
│                                  │
└──────────────────────────────────┘
```

## 📊 Order Summary (Collapsed)

```
┌──────────────────────────────┐
│ 💳              ▼             │
│ Order Summary                │
│ ₹2,499                       │
│                              │
│ (Hover background changes)   │
└──────────────────────────────┘
```

## 📊 Order Summary (Expanded)

```
┌──────────────────────────────┐
│ 💳              ▲             │
│ Order Summary                │
│ ₹2,499                       │
├──────────────────────────────┤
│ ITEMS (4)                    │
│ ├─ Item 1 x 2    ₹200       │
│ ├─ Item 2 x 1    ₹100       │
│ └─ Item 3 x 1    ₹150       │
│                              │
│ ┌──────────────────────────┐ │
│ │ 🏷️ Subtotal      ₹450    │ │
│ └──────────────────────────┘ │
│                              │
│ ┌──────────────────────────┐ │
│ │ 🚚 Delivery Fee   ₹40    │ │
│ └──────────────────────────┘ │
│                              │
│ ┌──────────────────────────┐ │
│ │ 📉 Discount       -₹91   │ │ (green, animated bounce)
│ │ SAVE20                    │ │
│ └──────────────────────────┘ │
│                              │
│ ┌──────────────────────────┐ │
│ │ 🎁 Payment Method         │ │
│ │ Razorpay                 │ │
│ └──────────────────────────┘ │
│                              │
│ ┌──────────────────────────┐ │
│ │ Total Amount             │ │
│ │ You pay: ₹2,499          │ │
│ └──────────────────────────┘ │
│                              │
│ ✨ You saved ₹91!            │
└──────────────────────────────┘
```

## 🎨 Color Palette

### Razorpay (Primary)
- Gradient: Purple (#7C3AED) → Indigo (#4F46E5)
- Text: Purple #7C3AED
- Background: bg-purple-50
- Border: border-purple-200

### PhonePe (Secondary)
- Gradient: Blue (#3B82F6) → Cyan (#06B6D4)
- Text: Blue #0284C7
- Background: bg-blue-50
- Border: border-blue-200

### Google Pay (Tertiary)
- Gradient: Light Blue (#60A5FA) → Blue (#0284C7)
- Text: Blue #0284C7
- Background: bg-blue-50
- Border: border-blue-200

### Cash on Delivery (Quaternary)
- Gradient: Green (#10B981) → Emerald (#059669)
- Text: Green #059669
- Background: bg-green-50
- Border: border-green-200

## 🎭 Animation Sequences

### Card Selection Animation
```
Frame 1: scale(1.0)    opacity(1.0)
Frame 2: scale(1.02)   opacity(1.0)
Frame 3: scale(1.05)   opacity(1.0)  ← Final state
Duration: 600ms | Easing: ease-out
```

### Processing Progress Animation
```
Frame 0%:   width(0%)
Frame 50%:  width(40%) with gradient shift
Frame 100%: width(100%)
Duration: 3000ms | Easing: linear-with-variation
```

### Success Animation
```
Frame 0:   scale(0)    opacity(0)
Frame 50%: opacity(1)
Frame 100%: scale(1)   opacity(1)
Duration: 600ms | Easing: cubic-bezier
```

### Discount Pulse Animation
```
Frame 0%:   scale(1.0)
Frame 50%:  scale(1.05)
Frame 100%: scale(1.0)
Duration: 2s | Easing: ease-in-out | Repeat: infinite
```

## 📏 Responsive Breakpoints

### Mobile (<768px)
- Single column layout
- Payment cards: full width with 16px padding
- Sticky header for total amount
- Buttons: 44px minimum touch target
- Font size: 16px for inputs (prevents zoom)

### Tablet (768px-1024px)
- 1.5 column layout
- Payment cards: 2 per row
- Summary stays sticky
- Horizontal padding: 24px

### Desktop (>1024px)
- 2-3 column layout
- Payment cards: 2 per row
- Summary: fixed right column
- Horizontal padding: 32px
- Max-width container: 1200px

## 🎬 User Interaction States

### Button States

**Idle**
```
Background: Gradient purple-pink
Text: White
Shadow: None
Scale: 1.0
```

**Hover**
```
Background: Gradient purple-pink (brighter)
Text: White
Shadow: lg
Scale: 1.05
```

**Active/Pressed**
```
Background: Gradient purple-pink (darker)
Text: White
Shadow: md
Scale: 0.95
```

**Disabled**
```
Background: Gray-100
Text: Gray-400
Shadow: None
Scale: 1.0
Cursor: not-allowed
Opacity: 0.5
```

## 🔐 Security Indicators

### Security Badge
```
┌─────────────────────────────┐
│ 🔒 All payments are secured │
│    and encrypted            │
└─────────────────────────────┘
```

### Payment Method Confidence Signals
- ✓ Icon next to selected method
- Lock icon in payment card header
- "Secure" text in features list
- Blue security information box

## 📱 Touch Targets (Mobile)

All interactive elements:
- Minimum height: 44px (Apple HIG)
- Minimum width: 44px
- Minimum spacing: 8px between targets
- Click areas should be obvious

## ♿ Accessibility

### Keyboard Navigation
- Tab: Move through payment methods
- Enter/Space: Select payment method
- Tab: Move to Pay button
- Enter: Submit payment

### ARIA Labels
- Payment cards: `role="radio"`, `aria-checked`
- Buttons: `aria-label` for icon buttons
- Forms: `label` elements with `htmlFor`

### Focus States
- 3px solid #7c3aed outline
- 2px offset from element
- High contrast for visibility

## 🌓 Dark Mode Support

Payment UI automatically adapts to:
- Dark background: Uses darker card backgrounds
- Light background: Uses lighter colors
- Animations: Maintained in both modes
- Contrast: Always WCAG AA compliant

---

## Visual Performance Tips

1. **Animations are GPU-accelerated** using `transform` and `opacity`
2. **No layout shifts** - all sizes predetermined
3. **Images**: All icons are SVG (no raster images)
4. **Lazy loading**: Payment scripts loaded on demand
5. **Optimized CSS**: Only 300 lines for animations

---

## Implementation Notes

- All colors use Tailwind CSS utility classes
- All spacing uses Tailwind scale (4px increments)
- All animations use CSS only (no JavaScript animations)
- Responsive design: Mobile-first approach
- Accessibility: WCAG 2.1 Level AA compliant

---

**Ready to implement!** 🚀
