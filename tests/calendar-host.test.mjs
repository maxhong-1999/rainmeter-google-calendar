import test from 'node:test';
import assert from 'node:assert/strict';

import {
  OPEN_GOOGLE_CALENDAR_ACTION,
  openGoogleCalendar,
  shouldOpenGoogleCalendar,
} from '../@Resources/calendar-host.mjs';

const expectedAction = '[!CommandMeasure MeasureOpenGoogleCalendar "Run"]';

test('opens through the direct Rainmeter API and reports success', () => {
  const actions = [];
  const host = { RainmeterAPI: { Bang: action => actions.push(action) } };

  assert.equal(OPEN_GOOGLE_CALENDAR_ACTION, expectedAction);
  assert.doesNotMatch(expectedAction, /https?:\/\//);
  assert.equal(openGoogleCalendar(host), true);
  assert.deepEqual(actions, [expectedAction]);
});

test('opens through the synchronous WebView fallback and reports success', () => {
  const actions = [];
  const host = {
    chrome: {
      webview: {
        hostObjects: {
          sync: { RainmeterAPI: { Bang: action => actions.push(action) } },
        },
      },
    },
  };

  assert.equal(openGoogleCalendar(host), true);
  assert.deepEqual(actions, [expectedAction]);
});

test('returns false when the Rainmeter API is missing', () => {
  assert.equal(openGoogleCalendar({}), false);
});

test('contains a throwing Rainmeter API getter', () => {
  const host = Object.defineProperty({}, 'RainmeterAPI', {
    get() { throw new Error('host lookup failed'); },
  });

  assert.equal(openGoogleCalendar(host), false);
});

test('contains a throwing Bang call', () => {
  const host = {
    RainmeterAPI: {
      Bang() { throw new Error('host call failed'); },
    },
  };

  assert.equal(openGoogleCalendar(host), false);
});

test('excludes button and link targets while accepting the calendar surface', () => {
  for (const match of ['button', 'a']) {
    const target = {
      closest(selector) {
        assert.equal(selector, 'button, a');
        return { localName: match };
      },
    };
    assert.equal(shouldOpenGoogleCalendar(target), false);
  }

  assert.equal(shouldOpenGoogleCalendar({ closest: () => null }), true);
});
