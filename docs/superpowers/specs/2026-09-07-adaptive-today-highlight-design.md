# Adaptive today highlight

## Goal

Make the current-day marker consistently visible without losing the translucent glass appearance of the calendar.

## Behavior

When the saved foreground colour is light, the current day uses a dark teal translucent surface, a bright border, and the saved foreground colour for the date number. When the foreground colour is dark, it uses a pale aqua translucent surface, a dark teal border, and the saved foreground colour for the date number.

The selected appearance is recalculated whenever the foreground colour changes, including initial load and reset. The marker remains a 24px circular badge so calendar alignment is unchanged.

## Implementation

`calendar-theme.mjs` exposes a pure helper that maps a normalized foreground colour to today-marker CSS values. `calendar-theme-ui.mjs` writes those values to CSS custom properties alongside the existing foreground and background properties. `calendar.css` consumes them only in `.day.today .day-number`.

## Error handling

Malformed saved colours already normalize to the default foreground colour; the helper receives only normalized values and therefore always returns a complete marker style.

## Tests

Unit tests will cover light and dark foreground inputs. The UI stylesheet contract test will require the current-day rule to consume the adaptive properties, protecting against a return to a background-derived marker.
