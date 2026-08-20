/* =========================================================
   TER QUICK FILL
   Works on real TER pages, dynamic forms, modal forms,
   standard radio-button forms and table-based TER lists.
   Mock-test dependency removed.
   ========================================================= */

const normalize = (value) =>
  (value || '').replace(/\s+/g, ' ').trim().toLowerCase();

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));


/* =========================================================
   LABEL / RADIO HELPERS
   ========================================================= */

function labelTextFor(input) {
  if (input.labels?.length) {
    return [...input.labels]
      .map((label) => label.innerText || label.textContent || '')
      .join(' ');
  }

  if (input.id) {
    try {
      const label = document.querySelector(
        `label[for="${CSS.escape(input.id)}"]`
      );

      if (label) {
        return label.innerText || label.textContent || '';
      }
    } catch (_) {
      // Ignore invalid selector errors.
    }
  }

  return (
    input.parentElement?.innerText ||
    input.parentElement?.textContent ||
    ''
  );
}


function candidateTexts(input) {
  return [
    input.value,
    input.getAttribute('aria-label'),
    input.getAttribute('data-label'),
    input.getAttribute('data-value'),
    input.title,
    labelTextFor(input),
  ]
    .map(normalize)
    .filter(Boolean);
}


function findRatingInput(inputs, wantedRating) {
  const wanted = normalize(wantedRating);

  if (!wanted) return null;

  // Exact match first.
  const exact = inputs.find((input) =>
    candidateTexts(input).some((text) => text === wanted)
  );

  if (exact) return exact;

  // Partial match second.
  return inputs.find((input) =>
    candidateTexts(input).some((text) => text.includes(wanted))
  );
}


/* =========================================================
   RADIO VISIBILITY
   ========================================================= */

function isElementVisible(element) {
  if (!element) return false;
  if (element.disabled) return false;

  const style = window.getComputedStyle(element);

  if (
    style.display === 'none' ||
    style.visibility === 'hidden' ||
    style.opacity === '0'
  ) {
    return false;
  }

  const rect = element.getBoundingClientRect();

  return (
    rect.width > 0 &&
    rect.height > 0
  );
}


function getEnabledRadios() {
  return [...document.querySelectorAll('input[type="radio"]')]
    .filter((radio) => !radio.disabled);
}


function getVisibleRadios() {
  return getEnabledRadios()
    .filter((radio) => isElementVisible(radio));
}


/* =========================================================
   FILL FORM
   ========================================================= */

function fillForm(wantedRating, { includeStyledRadios = false } = {}) {
  const radios = includeStyledRadios
    ? getEnabledRadios()
    : getVisibleRadios();

  if (!radios.length) {
    return {
      filled: 0,
      groups: 0,
      message: 'No rating buttons found on this page.',
    };
  }

  const groups = new Map();

  for (const radio of radios) {
    let key = radio.name;

    /*
     * Some TER pages do not provide radio name.
     * Create a stable-ish group key from the nearest container.
     */
    if (!key) {
      const container =
        radio.closest(
          'tr, fieldset, .form-group, .question, .form-control, li, td, div'
        );

      key = container
        ? normalize(
            container.innerText ||
            container.textContent ||
            ''
          ).slice(0, 250)
        : `ungrouped-${groups.size}`;
    }

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key).push(radio);
  }

  let filled = 0;
  let skipped = 0;

  for (const group of groups.values()) {
    const choice = findRatingInput(group, wantedRating);

    if (!choice) {
      skipped++;
      continue;
    }

    if (!choice.checked) {
      choice.click();
    }

    /*
     * Some frameworks listen for change/input events
     * instead of only the click event.
     */
    try {
      choice.dispatchEvent(
        new Event('input', {
          bubbles: true,
        })
      );

      choice.dispatchEvent(
        new Event('change', {
          bubbles: true,
        })
      );
    } catch (_) {}

    filled++;
  }

  const suffix = skipped
    ? ` (${skipped} group${skipped === 1 ? '' : 's'} not matched)`
    : '';

  return {
    filled,
    groups: groups.size,
    message:
      `Filled ${filled} rating group${filled === 1 ? '' : 's'}${suffix}.`,
  };
}


/* =========================================================
   SUBMIT TER DETECTION
   ========================================================= */

function getElementText(element) {
  if (!element) return '';

  return normalize(
    element.innerText ||
    element.value ||
    element.getAttribute('aria-label') ||
    element.getAttribute('title') ||
    element.textContent ||
    ''
  );
}


function isSubmitTerButton(element) {
  if (!element) return false;
  if (element.disabled) return false;
  if (!isElementVisible(element)) return false;

  const text = getElementText(element);

  return text === 'submit ter';
}


function allSubmitTerCandidates() {
  return [
    ...document.querySelectorAll(
      'button, input[type="button"], input[type="submit"], a'
    ),
  ];
}


/*
 * Row-level buttons:
 * These usually open a TER/course form from a table.
 */
function rowSubmitButtons() {
  return allSubmitTerCandidates().filter((element) => {
    return (
      isSubmitTerButton(element) &&
      !!element.closest('table')
    );
  });
}


/*
 * Final form submit:
 * This is normally outside the course table.
 */
function finalSubmitButton() {
  /* The TER site uses this input for the final form submission. */
  const terSubmitInput = document.querySelector(
    'input#button_color[type="submit"]'
  );

  if (terSubmitInput && !terSubmitInput.disabled) {
    return terSubmitInput;
  }

  const candidates = allSubmitTerCandidates();

  return (
    candidates.find((element) => {
      return (
        isSubmitTerButton(element) &&
        !element.closest('table')
      );
    }) || null
  );
}


/* =========================================================
   OPEN NEXT TER
   ========================================================= */

function openNextPendingTer() {
  const next = rowSubmitButtons()[0];

  if (!next) {
    return {
      opened: false,
      message: 'No pending “Submit TER” button found.',
    };
  }

  next.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
  });

  /*
   * Small delay makes this more reliable on pages
   * with Bootstrap/React/Vue event handling.
   */
  setTimeout(() => {
    try {
      next.click();
    } catch (_) {}
  }, 100);

  return {
    opened: true,
    message:
      'Opened the next pending TER. Wait for its form, then click Fill form.',
  };
}


/* =========================================================
   MESSAGE HANDLER
   ========================================================= */

chrome.runtime.onMessage.addListener(
  (request, _sender, sendResponse) => {
    if (!request || !request.type) return;

    if (request.type === 'fill') {
      sendResponse(
        fillForm(normalize(request.rating))
      );
      return true;
    }

    if (request.type === 'next') {
      sendResponse(
        openNextPendingTer()
      );
      return true;
    }

    if (request.type === 'fullAutoStart') {
      startFullAuto(
        normalize(request.rating)
      );

      sendResponse({
        ok: true,
      });

      return true;
    }

    if (request.type === 'fullAutoStop') {
      stopFullAuto();

      sendResponse({
        ok: true,
      });

      return true;
    }

    if (request.type === 'fullAutoStatus') {
      sendResponse(
        fullAutoStatus()
      );

      return true;
    }
  }
);


/* =========================================================
   MANUAL SUBMIT -> AUTO ADVANCE
   ========================================================= */

let autoMode = false;

chrome.storage.sync.get(
  {
    autoMode: false,
  },
  ({ autoMode: stored }) => {
    autoMode = Boolean(stored);
  }
);


chrome.storage.onChanged.addListener(
  (changes) => {
    if (changes.autoMode) {
      autoMode = Boolean(
        changes.autoMode.newValue
      );
    }
  }
);


/*
 * This does NOT automatically click the final Submit TER.
 *
 * It only reacts after the USER clicks the site's
 * own final Submit TER button.
 */
document.addEventListener(
  'click',
  (event) => {
    if (autoMode || fullAuto.running) {
      if (!autoMode || fullAuto.running) {
        return;
      }
    }

    const target =
      event.target?.closest?.(
        'button, input[type="submit"], input[type="button"], a'
      );

    if (!target) return;

    const text = getElementText(target);

    /*
     * Ignore table buttons.
     * Those are course-opening buttons.
     */
    if (
      text !== 'submit ter' ||
      target.closest('table')
    ) {
      return;
    }

    setTimeout(() => {
      chrome.storage.sync.get(
        {
          terRating: 'strongly agree',
        },
        ({ terRating }) => {
          const result =
            openNextPendingTer();

          if (result.opened) {
            setTimeout(() => {
              const fillResult =
                fillForm(
                  normalize(terRating)
                );

              console.log(
                '[TER Quick Fill]',
                fillResult.message
              );
            }, 1000);
          }
        }
      );
    }, 1500);
  },
  true
);


/* =========================================================
   FULL AUTO CONFIG
   ========================================================= */

const DEFAULT_FULL_AUTO_CONFIG = {
  pollIntervalMs: 250,

  /*
   * How long to wait for TER form/rating panel.
   */
  panelTimeoutMs: 10000,

  /*
   * How long to wait after final Submit TER.
   */
  submitConfirmTimeoutMs: 10000,

  /*
   * Number of submission attempts.
   */
  maxRetries: 3,

  /*
   * Delay before opening next course.
   */
  betweenCoursesDelayMs: 700,

  /*
   * Safety limit.
   */
  maxIterations: 200,
};


/* =========================================================
   FULL AUTO STATE
   ========================================================= */

const fullAuto = {
  running: false,
  stopRequested: false,
  processed: new Set(),
  log: [],
};

const FULL_AUTO_RUN_KEY = 'terQuickFillFullAutoRun';

function getSavedFullAutoRun() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ [FULL_AUTO_RUN_KEY]: null }, (items) => {
      resolve(items[FULL_AUTO_RUN_KEY]);
    });
  });
}

function saveFullAutoRun(run) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [FULL_AUTO_RUN_KEY]: run }, resolve);
  });
}

function clearSavedFullAutoRun() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(FULL_AUTO_RUN_KEY, resolve);
  });
}

function enableFullAutoDialogHandler() {
  chrome.runtime.sendMessage(
    { type: 'enableFullAutoDialogHandler' },
    () => void chrome.runtime.lastError
  );
}

function disableFullAutoDialogHandler() {
  chrome.runtime.sendMessage(
    { type: 'disableFullAutoDialogHandler' },
    () => void chrome.runtime.lastError
  );
}


/* =========================================================
   LOGGING
   ========================================================= */

function logFullAuto(message) {
  const line =
    `[${new Date().toLocaleTimeString()}] ${message}`;

  fullAuto.log.push(line);

  if (fullAuto.log.length > 200) {
    fullAuto.log.shift();
  }

  console.log(
    '[TER Quick Fill]',
    message
  );
}


/* =========================================================
   CONFIG
   ========================================================= */

function getFullAutoConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      {
        fullAutoConfig:
          DEFAULT_FULL_AUTO_CONFIG,
      },
      ({ fullAutoConfig }) => {
        resolve({
          ...DEFAULT_FULL_AUTO_CONFIG,
          ...(fullAutoConfig || {}),
        });
      }
    );
  });
}


/* =========================================================
   WAIT HELPER
   ========================================================= */

async function waitFor(
  predicate,
  {
    timeoutMs,
    pollIntervalMs,
  }
) {
  const start = Date.now();

  while (
    Date.now() - start <
    timeoutMs
  ) {
    if (fullAuto.stopRequested) {
      return null;
    }

    try {
      const value = predicate();

      if (value) {
        return value;
      }
    } catch (_) {
      // DOM may change during SPA transitions.
    }

    await sleep(pollIntervalMs);
  }

  return null;
}


/* =========================================================
   ROW IDENTITY
   ========================================================= */

function rowIdentity(button) {
  const row = button?.closest('tr');

  if (row) {
    const text =
      row.innerText ||
      row.textContent ||
      '';

    const cleaned =
      normalize(text)
        .replace(/submit ter/g, '')
        .trim();

    /*
     * If the row has text, use it.
     */
    if (cleaned) {
      return cleaned;
    }

    /*
     * Otherwise use row HTML.
     */
    return normalize(
      row.outerHTML.slice(0, 500)
    );
  }

  return normalize(
    button?.outerHTML?.slice(0, 200) ||
    ''
  );
}


/* =========================================================
   FIND NEXT UNPROCESSED ROW
   ========================================================= */

function findUnprocessedRowButton() {
  const buttons =
    rowSubmitButtons();

  return (
    buttons.find(
      (btn) =>
        !fullAuto.processed.has(
          rowIdentity(btn)
        )
    ) || null
  );
}


/* =========================================================
   RADIO GROUP DETECTION
   ========================================================= */

function hasVisibleRadioGroups() {
  return (
    getVisibleRadios().length > 0
  );
}


/* =========================================================
   CHECK WHETHER ROW STILL EXISTS
   ========================================================= */

function rowStillPending(rowId) {
  return rowSubmitButtons().some(
    (btn) =>
      rowIdentity(btn) === rowId
  );
}


/* =========================================================
   WAIT FOR FORM
   ========================================================= */

async function waitForTerForm(config) {
  /*
   * First try visible radios.
   */
  const radioResult =
    await waitFor(
      () => {
        const radios =
          getEnabledRadios();

        return radios.length
          ? radios
          : null;
      },
      {
        timeoutMs:
          config.panelTimeoutMs,
        pollIntervalMs:
          config.pollIntervalMs,
      }
    );

  if (radioResult) {
    return true;
  }

  return false;
}


/* =========================================================
   SUBMIT WITH RETRY
   ========================================================= */

async function submitWithRetry(
  rowId,
  config
) {
  for (
    let attempt = 1;
    attempt <= config.maxRetries;
    attempt++
  ) {
    if (fullAuto.stopRequested) {
      return false;
    }

    /*
     * Wait until final Submit TER becomes visible.
     */
    const button =
      await waitFor(
        () => finalSubmitButton(),
        {
          timeoutMs:
            config.panelTimeoutMs,
          pollIntervalMs:
            config.pollIntervalMs,
        }
      );

    if (!button) {
      logFullAuto(
        `No final Submit TER button found for ${rowId} (attempt ${attempt}).`
      );

      continue;
    }

    button.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });

    await sleep(150);

    /*
     * Click final submit.
     */
    try {
      button.click();
    } catch (error) {
      logFullAuto(
        `Error clicking Submit TER for ${rowId}: ${error?.message || error}`
      );

      continue;
    }

    logFullAuto(
      `Clicked Submit TER for ${rowId} (attempt ${attempt}).`
    );


    /*
     * IMPORTANT:
     *
     * We don't assume that "button disabled"
     * means success.
     *
     * Success = row disappears from pending list.
     *
     * Retry = same row is still pending and
     * final Submit TER becomes available again.
     */
    const outcome =
      await waitFor(
        () => {
          /*
           * If row disappeared, submission succeeded.
           */
          if (!rowStillPending(rowId)) {
            return 'success';
          }

          /*
           * Same row still exists and final button
           * is available again -> retry.
           */
          if (finalSubmitButton()) {
            return 'retry';
          }

          return null;
        },
        {
          timeoutMs:
            config.submitConfirmTimeoutMs,
          pollIntervalMs:
            config.pollIntervalMs,
        }
      );


    if (outcome === 'success') {
      return true;
    }


    if (outcome === 'retry') {
      logFullAuto(
        `Submit attempt ${attempt} for ${rowId} did not go through; retrying.`
      );
    } else {
      logFullAuto(
        `Timed out waiting for confirmation on ${rowId} (attempt ${attempt}); retrying.`
      );
    }

    await sleep(
      config.pollIntervalMs
    );
  }

  return false;
}


/* =========================================================
   FULL AUTO LOOP
   ========================================================= */

async function runFullAutoLoop(
  rating,
  processed = []
) {
  if (fullAuto.running) {
    return {
      started: false,
      message:
        'A full auto-submit run is already in progress.',
    };
  }

  fullAuto.running = true;
  fullAuto.stopRequested = false;
  fullAuto.processed = new Set(processed);
  fullAuto.log = [];

  logFullAuto(
    'Full auto-submit loop started.'
  );

  const config =
    await getFullAutoConfig();

  let iterations = 0;


  try {
    while (
      !fullAuto.stopRequested &&
      iterations <
        config.maxIterations
    ) {
      iterations++;


      /*
       * Find next pending TER.
       */
      const rowBtn =
        findUnprocessedRowButton();

      if (!rowBtn) {
        logFullAuto(
          'No more pending courses. Loop complete.'
        );

        break;
      }


      const rowId =
        rowIdentity(rowBtn);


      logFullAuto(
        `Opening course: ${rowId || '(unnamed row)'}`
      );


      /*
       * Open course.
       */
      rowBtn.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });

      await sleep(150);


      try {
        rowBtn.click();
      } catch (error) {
        logFullAuto(
          `Could not open ${rowId}: ${error?.message || error}`
        );

        fullAuto.processed.add(
          rowId
        );

        continue;
      }


      /*
       * Wait for actual TER rating form.
       */
      const panelReady =
        await waitForTerForm(
          config
        );


      if (!panelReady) {
        logFullAuto(
          `Timed out waiting for the rating panel for ${rowId}. Skipping.`
        );

        fullAuto.processed.add(
          rowId
        );

        continue;
      }


      /*
       * Fill ratings.
       */
      const fillResult =
        fillForm(rating, { includeStyledRadios: true });


      logFullAuto(
        `${fillResult.message} (${rowId})`
      );


      /*
       * If nothing was filled, don't blindly submit.
       */
      if (fillResult.filled === 0) {
        logFullAuto(
          `No matching rating found for ${rowId}. Skipping submission.`
        );

        fullAuto.processed.add(
          rowId
        );

        continue;
      }


      /*
       * Submit.
       */
      const submitted =
        await submitWithRetry(
          rowId,
          config
        );


      fullAuto.processed.add(
        rowId
      );


      if (!submitted) {
        logFullAuto(
          `Giving up on ${rowId} after ${config.maxRetries} attempt(s).`
        );

        continue;
      }


      logFullAuto(
        `Confirmed submitted: ${rowId}.`
      );


      /*
       * Give the website time to update the table.
       */
      await sleep(
        config.betweenCoursesDelayMs
      );
    }


    if (fullAuto.stopRequested) {
      logFullAuto(
        'Loop stopped by user.'
      );
    }


    if (
      iterations >=
      config.maxIterations
    ) {
      logFullAuto(
        'Stopped: reached max iteration safety limit.'
      );
    }

  } catch (error) {
    logFullAuto(
      `Full auto error: ${error?.message || error}`
    );
  }


  fullAuto.running = false;

  await clearSavedFullAutoRun();
  disableFullAutoDialogHandler();


  return {
    started: true,
    message:
      'Full auto-submit loop finished. See log.',
  };
}


/* =========================================================
   START / STOP
   ========================================================= */

function startFullAuto(rating) {
  if (fullAuto.running) {
    logFullAuto(
      'Full auto-submit is already running.'
    );

    return;
  }

  enableFullAutoDialogHandler();

  saveFullAutoRun({
    rating,
    processed: [],
  })
    .then(() => runFullAutoLoop(rating))
    .then((result) => {
      if (!result.started) {
        logFullAuto(
          result.message
        );
      }
    })
    .catch((error) => {
      fullAuto.running = false;

      logFullAuto(
        `Unexpected error: ${error?.message || error}`
      );
    });
}


function stopFullAuto() {
  if (fullAuto.running) {
    fullAuto.stopRequested = true;

    logFullAuto(
      'Stop requested by user.'
    );
  }

  clearSavedFullAutoRun();
  disableFullAutoDialogHandler();
}


/*
 * Some TER sites navigate to a separate form page after a row button is
 * clicked. A content script is recreated after that navigation, so resume
 * the saved run and finish the form automatically.
 */
async function resumeFullAutoAfterNavigation() {
  const savedRun = await getSavedFullAutoRun();

  if (!savedRun || fullAuto.running) {
    return;
  }

  const rating = normalize(savedRun.rating);
  const processed = Array.isArray(savedRun.processed)
    ? savedRun.processed
    : [];

  if (rowSubmitButtons().length) {
    runFullAutoLoop(rating, processed);
    return;
  }

  fullAuto.running = true;
  fullAuto.stopRequested = false;
  fullAuto.processed = new Set(processed);
  fullAuto.log = [];
  logFullAuto('Resumed full auto-submit on the TER form.');

  const config = await getFullAutoConfig();
  const panelReady = await waitForTerForm(config);

  if (!panelReady) {
    fullAuto.running = false;
    logFullAuto('Could not find TER rating questions after navigation.');
    await clearSavedFullAutoRun();
    return;
  }

  const fillResult = fillForm(rating, { includeStyledRadios: true });
  logFullAuto(fillResult.message);

  if (!fillResult.filled) {
    fullAuto.running = false;
    await clearSavedFullAutoRun();
    return;
  }

  const submitButton = await waitFor(
    () => finalSubmitButton(),
    {
      timeoutMs: config.panelTimeoutMs,
      pollIntervalMs: config.pollIntervalMs,
    }
  );

  if (!submitButton) {
    fullAuto.running = false;
    logFullAuto('Could not find the final Submit TER button.');
    await clearSavedFullAutoRun();
    return;
  }

  try {
    submitButton.click();
    logFullAuto('Clicked Submit TER after filling the form.');
  } catch (error) {
    fullAuto.running = false;
    logFullAuto(`Error clicking Submit TER: ${error?.message || error}`);
    await clearSavedFullAutoRun();
    return;
  }

  /* If the site returns to the list without a navigation, continue here. */
  const listReady = await waitFor(
    () => rowSubmitButtons().length > 0,
    {
      timeoutMs: config.submitConfirmTimeoutMs,
      pollIntervalMs: config.pollIntervalMs,
    }
  );

  if (listReady) {
    fullAuto.running = false;
    runFullAutoLoop(rating, processed);
  }
}


/* =========================================================
   STATUS
   ========================================================= */

function fullAutoStatus() {
  return {
    running:
      fullAuto.running,

    processedCount:
      fullAuto.processed.size,

    log:
      fullAuto.log.slice(-20),
  };
}


/* =========================================================
   OPTIONAL DEBUG API
   =========================================================
   You can run these from DevTools if needed:

   fillForm('strongly agree')
   rowSubmitButtons()
   finalSubmitButton()
   fullAutoStatus()
   ========================================================= */

console.log(
  '[TER Quick Fill] Content script loaded on:',
  location.href
);

resumeFullAutoAfterNavigation();
