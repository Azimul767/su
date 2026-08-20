const rating = document.querySelector('#rating');
const status = document.querySelector('#status');

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function send(type) {
  const tab = await activeTab();
  if (!tab?.id) throw new Error('No active tab found.');
  return chrome.tabs.sendMessage(tab.id, { type, rating: rating.value });
}

async function updateStatus(action) {
  try {
    const result = await send(action);
    status.textContent = result?.message || 'Done.';
  } catch (error) {
    status.textContent = 'Open the TER page, then try again.';
  }
}

const autoMode = document.querySelector('#autoMode');

chrome.storage.sync.get({ terRating: 'strongly agree', autoMode: false }, ({ terRating, autoMode: stored }) => {
  rating.value = terRating;
  autoMode.checked = stored;
});

rating.addEventListener('change', () => chrome.storage.sync.set({ terRating: rating.value }));
autoMode.addEventListener('change', () => chrome.storage.sync.set({ autoMode: autoMode.checked }));
document.querySelector('#fill').addEventListener('click', () => updateStatus('fill'));
document.querySelector('#next').addEventListener('click', () => updateStatus('next'));

const fullAutoStatus = document.querySelector('#fullAutoStatus');
const fullAutoLog = document.querySelector('#fullAutoLog');
const fullAutoStartBtn = document.querySelector('#fullAutoStart');
const fullAutoStopBtn = document.querySelector('#fullAutoStop');

async function sendRaw(type) {
  const tab = await activeTab();
  if (!tab?.id) throw new Error('No active tab found.');
  return chrome.tabs.sendMessage(tab.id, { type, rating: rating.value });
}

async function refreshFullAutoStatus() {
  try {
    const result = await sendRaw('fullAutoStatus');
    if (!result) throw new Error('no response');
    fullAutoStatus.textContent = result.running
      ? `Running — ${result.processedCount || 0} TER(s) completed.`
      : 'Ready';
    fullAutoStartBtn.disabled = result.running;
    fullAutoStopBtn.disabled = !result.running;
    fullAutoLog.textContent = result.log?.join('\n') || '(no activity yet)';
  } catch (error) {
    fullAutoStatus.textContent =
      'Reload the extension, then refresh the TER course-list tab.';
    fullAutoStartBtn.disabled = true;
    fullAutoStopBtn.disabled = true;
  }
}

fullAutoStartBtn.addEventListener('click', async () => {
  await sendRaw('fullAutoStart');
  refreshFullAutoStatus();
});
fullAutoStopBtn.addEventListener('click', async () => {
  await sendRaw('fullAutoStop');
  refreshFullAutoStatus();
});

refreshFullAutoStatus();
setInterval(refreshFullAutoStatus, 1500);
