/* Accept the site's native success alert while full auto-submit is active. */

const autoDialogTabs = new Set();

function attachDialogHandler(tabId, sendResponse) {
  if (autoDialogTabs.has(tabId)) {
    sendResponse({ ok: true });
    return;
  }

  chrome.debugger.attach({ tabId }, '1.3', () => {
    if (chrome.runtime.lastError) {
      sendResponse({
        ok: false,
        message: chrome.runtime.lastError.message,
      });
      return;
    }

    autoDialogTabs.add(tabId);
    sendResponse({ ok: true });
  });
}

function detachDialogHandler(tabId) {
  if (!autoDialogTabs.has(tabId)) return;

  autoDialogTabs.delete(tabId);
  chrome.debugger.detach({ tabId }, () => {
    // The tab may already have navigated or been closed.
    void chrome.runtime.lastError;
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id;

  if (!tabId) return;

  if (message?.type === 'enableFullAutoDialogHandler') {
    attachDialogHandler(tabId, sendResponse);
    return true;
  }

  if (message?.type === 'disableFullAutoDialogHandler') {
    detachDialogHandler(tabId);
    sendResponse({ ok: true });
  }
});

chrome.debugger.onEvent.addListener((source, method) => {
  if (
    method !== 'Page.javascriptDialogOpening' ||
    !autoDialogTabs.has(source.tabId)
  ) {
    return;
  }

  chrome.debugger.sendCommand(
    source,
    'Page.handleJavaScriptDialog',
    { accept: true },
    () => {
      // Ignore a dialog that was already dismissed by the page or browser.
      void chrome.runtime.lastError;
    }
  );
});

chrome.debugger.onDetach.addListener((source) => {
  autoDialogTabs.delete(source.tabId);
});
