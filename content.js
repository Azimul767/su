/* TER Quick Fill: works with standard radio-button forms and table-based TER lists. */
const normalize = (value) => (value || '').replace(/\s+/g, ' ').trim().toLowerCase();

function labelTextFor(input) {
  if (input.labels?.length) return [...input.labels].map((label) => label.innerText).join(' ');
  if (input.id) {
    const label = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
    if (label) return label.innerText;
  }
  return input.parentElement?.innerText || '';
}

function findRatingInput(inputs, wantedRating) {
  return inputs.find((input) => {
    const text = [input.value, input.getAttribute('aria-label'), input.title, labelTextFor(input)]
      .map(normalize).join(' ');
    return text.includes(wantedRating);
  });
}

function fillForm(wantedRating) {
  const radios = [...document.querySelectorAll('input[type="radio"]')].filter((radio) => !radio.disabled);
  if (!radios.length) return { message: 'No rating buttons found on this page.' };

  const groups = new Map();
  for (const radio of radios) {
    const key = radio.name || `ungrouped-${radio.closest('tr, fieldset, .form-group, div')?.outerHTML.slice(0, 80)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(radio);
  }

  let filled = 0;
  let skipped = 0;
  for (const group of groups.values()) {
    const choice = findRatingInput(group, wantedRating);
    if (!choice) { skipped++; continue; }
    if (!choice.checked) choice.click();
    filled++;
  }
  const suffix = skipped ? ` (${skipped} group${skipped === 1 ? '' : 's'} not matched)` : '';
  return { message: `Filled ${filled} rating group${filled === 1 ? '' : 's'}${suffix}. Review, then submit on the site.` };
}

function openNextPendingTer() {
  const candidates = [...document.querySelectorAll('button, input[type="button"], input[type="submit"], a')];
  const next = candidates.find((element) => {
    const text = normalize(element.innerText || element.value || element.getAttribute('aria-label'));
    return text === 'submit ter' && !element.disabled && element.offsetParent !== null;
  });
  if (!next) return { message: 'No pending “Submit TER” button found.' };
  next.scrollIntoView({ behavior: 'smooth', block: 'center' });
  next.click();
  return { message: 'Opened the next pending TER. Wait for its form, then click Fill form.' };
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.type === 'fill') sendResponse(fillForm(normalize(request.rating)));
  if (request.type === 'next') sendResponse(openNextPendingTer());
});
