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

chrome.storage.sync.get({ terRating: 'strongly agree' }, ({ terRating }) => {
  rating.value = terRating;
});

rating.addEventListener('change', () => chrome.storage.sync.set({ terRating: rating.value }));
document.querySelector('#fill').addEventListener('click', () => updateStatus('fill'));
document.querySelector('#next').addEventListener('click', () => updateStatus('next'));
