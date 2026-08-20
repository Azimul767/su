# TER Quick Fill Chrome extension

This Manifest V3 extension speeds up repetitive teaching-evaluation forms. It selects one rating across the visible radio-button questions and can open the next pending TER from the course list.

## Install (developer mode)

1. In Chrome, open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked** and choose this folder: `/Users/mdazimulislam/Tar`.
4. Pin **TER Quick Fill**, open the university TER page, choose the rating, and press **Fill form**.

Review every evaluation and click the website's **Submit TER** button yourself. After the website confirms it, use **Open next pending TER**, then **Fill form** again.

## Privacy

The extension stores only your selected rating in Chrome sync storage. It sends no data anywhere and does not read or store account credentials.

## Site compatibility

It is designed for standard HTML radio controls and visible buttons labelled `Submit TER`. If the university site uses custom controls or different wording, share the rendered HTML for one question and course row (with private details removed) and the selectors can be tailored.

# su
