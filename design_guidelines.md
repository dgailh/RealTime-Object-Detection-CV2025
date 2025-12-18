# Design Guidelines: Saudi ANPR License Plate Detector

## Design Approach
**Selected System**: Material Design-inspired functional interface
**Rationale**: Utility-focused detection tool requiring clear data visualization, excellent readability, and professional presentation of technical results.

## Layout System

**Container Structure**:
- Main container: `max-w-6xl mx-auto px-4`
- Single-column vertical flow optimized for the upload → detect → results workflow
- Generous vertical spacing between major sections: `space-y-8` to `space-y-12`

**Spacing Primitives** (Tailwind units):
- Primary spacing: 4, 6, 8 for component padding/margins
- Micro spacing: 2, 3 for tight groupings
- Macro spacing: 12, 16, 20 for section separation

## Typography

**Font Stack**: 
- Primary: Inter or Roboto via Google Fonts CDN
- Monospace: 'Roboto Mono' for confidence percentages

**Hierarchy**:
- Page Title (H1): `text-4xl font-bold` - establishes authority
- Section Headers: `text-2xl font-semibold`
- Detection Labels: `text-lg font-medium`
- Body/Results: `text-base`
- Metadata (confidence %): `text-sm font-mono`

## Core Components

**1. Header Section**
- Title "Saudi ANPR – License Plate Detector" prominently displayed
- Subtle subtitle explaining functionality: `text-lg opacity-80`
- Centered alignment with breathing room: `py-8`

**2. Upload Control**
- Large, prominent drop zone with dashed border
- Minimum height: `h-48` for easy targeting
- Clear file type indicators (.jpg, .jpeg, .png, .webp)
- Upload icon from Heroicons (cloud-arrow-up)
- Hover state with subtle background shift
- Image preview replaces upload zone after selection: rounded corners `rounded-lg`, constrained max height `max-h-96`

**3. Detect Button**
- Primary CTA: Large, `px-8 py-4`, `text-lg font-semibold`
- Full width on mobile, auto width centered on desktop
- Disabled state when no image uploaded
- Loading state with spinner icon (Heroicons: arrow-path with animate-spin)

**4. Results Section**
- **Image Comparison Grid**:
  - Desktop: Two-column layout `grid grid-cols-1 md:grid-cols-2 gap-6`
  - Each image in card with subtle border and shadow
  - Labels above each: "Original Image" / "Detected Plates"
  - Images: `rounded-lg w-full h-auto object-contain`

- **Detection List**:
  - Card-based layout with `space-y-4`
  - Each detection card contains:
    - Header row: "Plate #1" (left) + Confidence "93%" (right) in monospace
    - Progress bar: full width, height `h-3`, rounded `rounded-full`
    - Background track with contrasting fill showing confidence level
    - Color coding via fill width (0-100%)

**5. Future Feature Toggle**
- Disabled toggle switch with label "Blur plate numbers (coming soon)"
- Positioned in results header area
- Muted appearance with opacity-50 to indicate disabled state

**6. Empty/Error States**
- Centered message cards with icons (Heroicons: exclamation-triangle for errors, photo for no detections)
- `text-center p-8` with appropriate icon size `w-16 h-16`

## Visual Hierarchy

**Elevation System**:
- Upload zone: Subtle border, no shadow initially
- Active upload zone: Light shadow on hover
- Results cards: Medium shadow `shadow-md`
- Detection cards: Light shadow `shadow-sm` with border

**Borders & Radii**:
- Standard border radius: `rounded-lg` (8px)
- Progress bars: `rounded-full`
- Consistent 1px borders for card separation

## Component Specifications

**Progress Bar (Confidence Meter)**:
- Container: `w-full h-3 rounded-full overflow-hidden`
- Track: Full width background
- Fill: Dynamic width based on confidence (0-100%), `h-full rounded-full transition-all duration-300`

**Loading State**:
- Full-screen overlay with backdrop blur
- Centered spinner with "Detecting plates..." text
- Semi-transparent background for context preservation

**Error Messages**:
- Card format with left-side warning icon
- Clear error text with suggested actions
- Dismissible with small close button (Heroicons: x-mark)

## Accessibility

- All interactive elements: minimum touch target 44x44px
- Form inputs: Clear labels and ARIA attributes
- Progress bars: Include aria-valuenow, aria-valuemin, aria-valuemax
- Loading states: aria-live="polite" announcements
- Image alt text: Descriptive for screen readers
- Keyboard navigation: Full support with visible focus states

## Icons

**Library**: Heroicons (via CDN)
**Usage**:
- cloud-arrow-up: Upload zone
- arrow-path: Loading spinner
- exclamation-triangle: Error states
- photo: Empty state
- x-mark: Dismiss/close buttons

## Responsive Behavior

**Breakpoints**:
- Mobile (base): Single column, full-width buttons
- Tablet (md:): Begin two-column image grid
- Desktop (lg:): Optimal spacing, max-width container

**Mobile Optimizations**:
- Larger touch targets for upload zone
- Stacked image comparison
- Full-width detection cards
- Increased padding for readability

## Performance Considerations

- Lazy load result images
- Optimize uploaded image preview (max dimensions before display)
- Smooth transitions for state changes (300ms standard)
- Debounced interactions where appropriate