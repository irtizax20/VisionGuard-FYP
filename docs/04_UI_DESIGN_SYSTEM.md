# 🎨 Vision Guard — UI Design System

The premium feel comes from **consistency**. This doc documents every design decision
so your screens all look like part of the same app.

---

## 🎨 Color Palette

### Brand colors (gradients)
| Name | Start | End | When to use |
|---|---|---|---|
| Primary | `#6366F1` (indigo) | `#8B5CF6` (violet) | Main brand, primary buttons, hero |
| Accent | `#06B6D4` (cyan) | `#3B82F6` (blue) | Eye-themed UI, scan effects |
| Hero | `#6366F1` → `#8B5CF6` → `#EC4899` | (3-stop) | Landing screen, lock screen |

### Health states
| State | Color | Meaning |
|---|---|---|
| Good | `#10B981` (green) | All healthy, low fatigue, good distance |
| Warning | `#F59E0B` (amber) | Mild concern — take a break soon |
| Bad | `#EF4444` (red) | Action needed — too close, high fatigue |

### Surfaces (dark mode — default)
- `bg`: `#0B0F1A` — page background
- `surface`: `#151B2C` — cards, sheets
- `surfaceElevated`: `#1E2540` — raised cards, modals
- `border`: `#252B45` — dividers

### Surfaces (light mode)
- `bg`: `#FAFAFE`
- `surface`: `#FFFFFF`
- `border`: `#E5E7EB`

---

## 📏 Spacing Scale

Use these tokens, never raw pixel values:

| Token | Pixels | Use for |
|---|---|---|
| `xs` | 4 | Icon-text gap |
| `sm` | 8 | Tight inline spacing |
| `md` | 12 | Default padding |
| `lg` | 16 | Card padding |
| `xl` | 24 | Section gap |
| `xxl` | 32 | Big section break |
| `xxxl` | 48 | Page top/bottom padding |

---

## 🔤 Typography

| Style | Size | Weight | Use |
|---|---|---|---|
| `displayLg` | 40 | 800 | Landing hero ("Vision Guard") |
| `displayMd` | 32 | 700 | Page title |
| `h1` | 28 | 700 | Section heading |
| `h2` | 22 | 700 | Card title |
| `h3` | 18 | 600 | Sub-heading |
| `body` | 16 | 400 | Default text |
| `bodySm` | 14 | 400 | Captions, sub-text |
| `bodyBold` | 16 | 600 | Button labels |
| `caption` | 12 | 500 | Tiny labels |
| `captionUpper` | 11 | 700 (uppercase) | Section labels |
| `statLg` | 48 | 800 | Big numbers ("187 blinks") |
| `statMd` | 32 | 700 | Medium numbers |

---

## 🔘 Border Radius

| Token | Pixels | Use |
|---|---|---|
| `sm` | 8 | Chips, tags |
| `md` | 12 | Small buttons |
| `lg` | 16 | Cards, large buttons |
| `xl` | 24 | Hero cards |
| `pill` | 999 | Status badges, FABs |

---

## 🌟 Shadows / Glows

| Token | Use |
|---|---|
| `sm` | Subtle elevation, list items |
| `md` | Cards, default |
| `lg` | Modals, important cards |
| `glowPurple` | Hero CTAs |
| `glowCyan` | Eye/vision UI |

---

## ✨ Animation Tokens

| Token | Duration | Use |
|---|---|---|
| `fast` | 150ms | Button press |
| `normal` | 250ms | Tab switch, modal open |
| `slow` | 400ms | Page transitions |
| `spring` | (damping 14, stiffness 120) | Natural bounce |

---

## 🧩 Component Library

### `GradientCard`
Premium card with gradient background.
```tsx
<GradientCard gradient="primary" glow="purple" onPress={...}>
  <Text>Content</Text>
</GradientCard>
```

Props:
- `gradient`: 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'hero' | 'card' | 'darkBg'
- `glow`: 'purple' | 'cyan' | 'none'
- `onPress` (optional — makes it tappable)
- `padding`, `borderRadius` (defaults match design system)

### `AnimatedButton`
Spring-animated button with haptics.
```tsx
<AnimatedButton
  title="Start Test"
  variant="primary"
  size="lg"
  icon={<Ionicons name="play" size={20} color="#fff" />}
  onPress={...}
/>
```

Variants: `primary | accent | success | danger | ghost`
Sizes: `sm | md | lg`

### `EyeIcon`
Animated brand eye logo (no SVG dependency).
```tsx
<EyeIcon size={80} glowing blinking />
```

### `SmartNotification`
In-app toast notification.
```tsx
const notifRef = useRef<SmartNotificationHandle>(null);

<SmartNotification ref={notifRef} />

// later:
notifRef.current?.show({
  title: 'Look 20 feet away',
  message: 'Take a 20 second break',
  type: 'info',
});
```

---

## 📱 Screen Templates

### Standard screen structure
```tsx
<View style={{ flex: 1 }}>
  <LinearGradient colors={Gradients.darkBg} style={StyleSheet.absoluteFill} />
  <SafeAreaView style={{ flex: 1 }}>
    <ScreenHeader title="..." />
    <ScrollView contentContainerStyle={{ padding: Spacing.lg }}>
      {/* content */}
    </ScrollView>
  </SafeAreaView>
</View>
```

### Hero card structure
```tsx
<GradientCard gradient="hero" glow="purple">
  <Text style={Typography.captionUpper}>SECTION LABEL</Text>
  <Text style={Typography.statLg}>{bigNumber}</Text>
  <Text style={{ color: 'white', opacity: 0.85 }}>Description text</Text>
</GradientCard>
```

### Stat row (3-up)
```tsx
<View style={{ flexDirection: 'row', gap: Spacing.sm }}>
  <GradientCard gradient="primary" style={{ flex: 1 }}>...</GradientCard>
  <GradientCard gradient="accent" style={{ flex: 1 }}>...</GradientCard>
  <GradientCard gradient="warning" style={{ flex: 1 }}>...</GradientCard>
</View>
```

### Feature tile grid (2x2)
See `app/index.tsx` for `FeatureTile` example.

---

## ✅ Design Checklist (before showing your panel)

- [ ] Every screen uses `LinearGradient` background (no plain backgrounds)
- [ ] All buttons use `AnimatedButton` (no raw `<Button>` or `<TouchableOpacity>` with text)
- [ ] All cards use `GradientCard` (no raw `<View>` with backgroundColor)
- [ ] Brand `EyeIcon` appears on home + splash + lock screens
- [ ] Spacing uses tokens (`Spacing.lg`), never raw numbers
- [ ] Typography uses tokens (`Typography.h1`), never raw `fontSize`
- [ ] Status colors used correctly: green = good, amber = warning, red = bad
- [ ] At least one screen has a "wow" animation (scan line, breathing eye, etc.)
- [ ] Haptic feedback on all CTAs
- [ ] Dark mode looks just as good as light mode

---

## 🎯 Premium Design Principles (steal these for any future app)

1. **Gradient > flat color** for important surfaces. Flat is for backgrounds only.
2. **Glow shadows** on key CTAs make the app feel "alive."
3. **Animations should reinforce meaning** — eye breathes when calm, pulses when alert, scans when working.
4. **Never use the default system font** — but for FYP, system bold IS premium when used at the right sizes.
5. **One signature element** per app — Vision Guard's is the animated eye icon.
6. **Numbers should be HUGE** — stat values at 32–48pt look more impactful than 24pt.
7. **Tight letter-spacing** on big text (`letterSpacing: -1`) feels modern.
8. **Spring animations** > linear timing. Always.
