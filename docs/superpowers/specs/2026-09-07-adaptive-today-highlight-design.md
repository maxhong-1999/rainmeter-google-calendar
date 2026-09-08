# Adaptive today highlight

## Goal

Make the current-day marker consistently visible without losing the translucent glass appearance of the calendar.

## Behavior

The current-day badge uses the configured background colour at the configured background opacity for its surface. Its 2px inset border uses the configured foreground colour at high opacity, and its soft outer glow uses that same foreground colour at lower opacity. The date number continues to use the configured foreground colour.

Because the CSS values reference the existing theme properties, every background, foreground, opacity, initial-load, edit, and reset change updates the marker automatically. The marker remains a 24px circular badge so calendar alignment is unchanged.

## Implementation

`calendar.css` consumes the existing background and foreground theme properties only in `.day.today .day-number`. The previous foreground-luminance helper and controller-generated today-marker properties are removed because no independent accent palette is needed.

## Error handling

Malformed saved colours already normalize to default theme values before CSS reads them, so the current-day marker retains a complete surface and border.

## Tests

Theme tests will no longer require a separate today-marker helper. The UI stylesheet contract test will require the current-day rule to consume the existing background colour, background opacity, and foreground colour properties directly.
