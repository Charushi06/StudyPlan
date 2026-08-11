const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Theme persistence and toggle behavior', () => {
  // Read index.html
  const htmlPath = path.join(__dirname, '../index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  // Extract head script and body script
  const scriptParts = html.split('<script>');
  
  // The first inline script tag is in <head>
  const headScript = scriptParts[1].split('</script>')[0];
  
  // The second inline script tag is in the <body> settings section
  // Wait, let's see which script index it is.
  // In index.html, we have:
  // scriptParts[0]: before first <script>
  // scriptParts[1]: the head script (until </script>)
  // scriptParts[2]: between first </script> and second <script> (which is <script type="module" src="/js/app.js">)
  // scriptParts[3]: between </script> and third <script> (which is <script src="https://cdn.jsdelivr.net/npm/intro.js/minified/intro.min.js">)
  // scriptParts[4]: between </script> and fourth <script> (the body inline script)
  // Wait! Let's write a robust finder for the scripts rather than hardcoded indices!
  let headScriptCode = '';
  let bodyScriptCode = '';
  
  // Let's parse all inline script tags (i.e. those that don't have src or type)
  // We can locate them by finding <script> (without src/type) in index.html
  const regex = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
  let match;
  const inlineScripts = [];
  while ((match = regex.exec(html)) !== null) {
    const attrs = match[1];
    const content = match[2];
    // Inline script if it doesn't have src attribute
    if (!attrs.includes('src=')) {
      inlineScripts.push(content);
    }
  }

  // The first inline script is in head
  headScriptCode = inlineScripts[0];
  // The second inline script is the settings body script
  bodyScriptCode = inlineScripts[1];

  // Helper to construct a fresh browser mock environment for each test
  const createMockBrowser = () => {
    const store = {};
    const localStorage = {
      getItem: (key) => store[key] || null,
      setItem: (key, value) => { store[key] = String(value); },
      removeItem: (key) => { delete store[key]; },
      clear: () => { for (const k in store) delete store[k]; }
    };

    const attributes = {};
    const documentElement = {
      setAttribute: (name, value) => { attributes[name] = value; },
      getAttribute: (name) => attributes[name] || null
    };

    const bodyClasses = new Set();
    const body = {
      classList: {
        add: (cls) => bodyClasses.add(cls),
        remove: (cls) => bodyClasses.delete(cls),
        contains: (cls) => bodyClasses.has(cls)
      }
    };

    const listeners = {};
    const darkModeToggle = {
      checked: false,
      addEventListener: (event, callback) => {
        listeners[event] = callback;
      },
      dispatchEvent: (event) => {
        if (listeners[event.type]) {
          listeners[event.type](event);
        }
      }
    };

    const compactViewToggle = {
      checked: false,
      addEventListener: () => {}
    };

    const settingsSave = {
      addEventListener: () => {}
    };

    const settingsModal = {
      style: {}
    };

    const defaultElement = {
      addEventListener: () => {},
      style: {},
      classList: {
        add: () => {},
        remove: () => {}
      },
      value: '',
      setAttribute: () => {},
      getAttribute: () => null
    };

    const document = {
      documentElement,
      body,
      getElementById: (id) => {
        if (id === 'dark-mode-toggle') return darkModeToggle;
        if (id === 'compact-view-toggle') return compactViewToggle;
        if (id === 'settings-save') return settingsSave;
        if (id === 'settings-modal') return settingsModal;
        return defaultElement;
      },
      addEventListener: () => {}
    };

    const window = {
      addEventListener: () => {},
      location: { reload: () => {} }
    };

    return {
      window,
      document,
      localStorage,
      attributes,
      bodyClasses,
      darkModeToggle,
      listeners
    };
  };

  // 1. Verify head script applies default light mode when no preference is saved
  {
    const env = createMockBrowser();
    const fn = new Function('window', 'document', 'localStorage', headScriptCode);
    fn(env.window, env.document, env.localStorage);
    assert.equal(env.attributes['data-theme'], 'light');
  }

  // 2. Verify head script applies dark mode when saved in studyplan_theme
  {
    const env = createMockBrowser();
    env.localStorage.setItem('studyplan_theme', 'dark');
    const fn = new Function('window', 'document', 'localStorage', headScriptCode);
    fn(env.window, env.document, env.localStorage);
    assert.equal(env.attributes['data-theme'], 'dark');
  }

  // 3. Verify head script applies light mode when saved in studyplan_theme
  {
    const env = createMockBrowser();
    env.localStorage.setItem('studyplan_theme', 'light');
    const fn = new Function('window', 'document', 'localStorage', headScriptCode);
    fn(env.window, env.document, env.localStorage);
    assert.equal(env.attributes['data-theme'], 'light');
  }

  // 4. Verify head script falls back to studyplan_dark_mode if studyplan_theme is not set
  {
    const env = createMockBrowser();
    env.localStorage.setItem('studyplan_dark_mode', 'true');
    const fn = new Function('window', 'document', 'localStorage', headScriptCode);
    fn(env.window, env.document, env.localStorage);
    assert.equal(env.attributes['data-theme'], 'dark');
  }

  // 5. Verify body preferences initialization and toggle change saving to localStorage
  {
    const env = createMockBrowser();
    env.localStorage.setItem('studyplan_theme', 'dark');
    
    // Run body script to initialize the state and bind event listeners
    const fn = new Function('window', 'document', 'localStorage', bodyScriptCode);
    fn(env.window, env.document, env.localStorage);

    // Verify toggle button state is initialized to correct checked value (true for dark mode)
    assert.equal(env.darkModeToggle.checked, true);

    // Simulate clicking toggle to turn dark mode OFF (setting target.checked to false)
    const mockEvent = {
      type: 'change',
      target: { checked: false }
    };
    env.darkModeToggle.dispatchEvent(mockEvent);

    // Verify attributes and localStorage are updated correctly
    assert.equal(env.attributes['data-theme'], 'light');
    assert.equal(env.localStorage.getItem('studyplan_theme'), 'light');
    assert.equal(env.localStorage.getItem('studyplan_dark_mode'), 'false');

    // Simulate clicking toggle to turn dark mode ON again (setting target.checked to true)
    const mockEventOn = {
      type: 'change',
      target: { checked: true }
    };
    env.darkModeToggle.dispatchEvent(mockEventOn);

    // Verify attributes and localStorage are updated back to dark
    assert.equal(env.attributes['data-theme'], 'dark');
    assert.equal(env.localStorage.getItem('studyplan_theme'), 'dark');
    assert.equal(env.localStorage.getItem('studyplan_dark_mode'), 'true');
  }
});
