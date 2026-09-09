# Screen Eyedropper Design

## Goal

Replace the unreliable native WebView2 colour-picker eyedropper with a Rainmeter-native screen picker that applies a selected colour to either shared calendar theme colour.

## Chosen approach

Use the external MIT-licensed YourPicker Rainmeter plugin in its `-mp` magnifier mode. The settings panel will have one compact eyedropper button next to each colour field. The page asks the Rainmeter bridge to start the matching picker measure; after a successful choice, the measure sends its `#RRGGBB` result back to a narrow page callback. The existing theme controller normalizes, persists, and renders the new colour.

## Behaviour

- Background and foreground fields each have an accessible screen-colour picker button.
- A selected `#RRGGBB` replaces only the requested field; opacity and the other colour are preserved.
- Escape/cancel leaves the saved theme unchanged.
- If YourPicker is absent, ordinary colour controls and HEX fields keep working; the page reports that the screen picker needs the plugin.
- The package documents YourPicker as an optional dependency and never bundles its DLL or user settings.

## Boundaries

- `calendar-theme-ui.mjs` owns accepting a picked HEX colour and persistence.
- `calendar.js` owns the WebView-to-Rainmeter command and the small page callback.
- `GoogleCalendar.ini` owns the two YourPicker measures and their callback actions.
- Documentation owns installation and troubleshooting.

## Testing

Unit coverage proves the controller changes only its requested colour and ignores invalid picker output. UI and Rainmeter integration contracts prove both buttons, bridge commands, callback, and `-mp` measures remain wired. The full Node suite verifies packaging/public-file boundaries.
