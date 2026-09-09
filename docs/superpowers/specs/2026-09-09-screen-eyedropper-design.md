# Screen Eyedropper Design

## Goal

Replace the unreliable native WebView2 colour-picker eyedropper with a Rainmeter-native screen picker that applies a selected colour to either shared calendar theme colour.

## Chosen approach

Use the external MIT-licensed YourPicker Rainmeter plugin in its `-mp` magnifier mode. Each colour swatch opens one shared custom popup with a saturation/brightness palette, hue slider, internal eyedropper, preview, and editable R/G/B inputs. No separate eyedropper is shown on the settings rows. Use exactly one plugin measure because YourPicker shares static state across instances. On completion, a parameterless callback reads the freshly updated measure through `ReplaceVariables`; never interpolate the measure value into `OnFinishAction`, because YourPicker expands it during configuration loading.

## Behaviour

- Background and foreground swatches open the same accessible popup; its internal eyedropper fills R/G/B and immediately applies the selected colour. Direct RGB input accepts integers from 0 to 255.
- A selected `#RRGGBB` replaces only the requested field; opacity and the other colour are preserved.
- Escape/cancel leaves the saved theme unchanged.
- If YourPicker is absent, ordinary colour controls and HEX fields keep working; the page reports that the screen picker needs the plugin.
- The package documents YourPicker as an optional dependency and never bundles its DLL or user settings.

## Boundaries

- `calendar-theme-ui.mjs` owns accepting a picked HEX colour and persistence.
- `calendar-color-picker.mjs` owns popup state, RGB/HSV conversion, the native bridge, and stale-result protection; `calendar.js` connects its callback to the theme controller.
- `GoogleCalendar.ini` owns the single YourPicker measure and its parameterless callback action.
- Documentation owns installation and troubleshooting.

## Testing

Unit coverage proves the controller changes only its requested colour, fills RGB from the post-selection measure value, and ignores invalid or stale picker output. UI and Rainmeter integration contracts prove the popup, internal button, bridge command, parameterless callback, and single measure remain wired. The full Node suite verifies packaging/public-file boundaries. Browser preview tests simulate the native bridge; they are not a substitute for actual native screen sampling.
