# video-m3u8

A small Chrome (Manifest V3) extension that captures every `.m3u8` HLS stream URL a page requests and, on right-click, shows you a ready-to-run `ffmpeg` command for each one.

![icon](icon128.png)

## What it does

- Watches all network requests the active tab makes and remembers every URL containing `.m3u8`.
- Adds a **video-m3u8** entry to the right-click menu on any page.
- On click, injects a draggable overlay (Shadow DOM, so it can't clash with the page's CSS) listing every captured stream.
- Each row shows the full ffmpeg command, with the output filename derived from the `.m3u8` basename:

  ```
  ffmpeg -protocol_whitelist file,http,https,tcp,tls,crypto \
         -i "<the .m3u8 url>" \
         -c copy <basename>.mp4
  ```

- A per-row **Copy** button puts that command on your clipboard. Paste into a terminal to download.
- URLs whose path contains `video.m3u8` are listed first (master playlists with that name tend to be what you actually want).

## Install

This extension isn't on the Chrome Web Store. Install it as an unpacked extension:

1. Clone or download this repo.

   ```bash
   git clone git@github.com:aleko205/video-m3u8.git
   # or
   git clone https://github.com/aleko205/video-m3u8.git
   ```

2. Open `chrome://extensions` in Chrome.
3. Toggle **Developer mode** ON (top-right corner of the page).
4. Click **Load unpacked** and select the cloned `video-m3u8` folder (the one containing `manifest.json`).
5. Open the puzzle-piece icon in the toolbar and pin **video-m3u8** so the icon stays visible.

## Use

1. Visit a page with an HLS video player.
2. Start playback (the extension can only see network requests made after it was enabled, so playback must actually start).
3. Right-click anywhere on the page → **video-m3u8**.
4. Copy the ffmpeg command for the stream you want and paste it into your terminal.

## Permissions

- `contextMenus` — to add the right-click entry
- `webRequest` — to observe outgoing requests for `.m3u8` URLs (read-only; nothing is blocked or modified)
- `scripting` — to inject the overlay into the active tab
- `host_permissions: <all_urls>` — required for `webRequest` to see requests across sites

The extension does not phone home, store anything on disk, or share any data. All state lives in memory for the lifetime of each tab.

## Files

```
manifest.json     — MV3 manifest
background.js     — service worker + injected overlay function
icon16.png        — toolbar icon
icon48.png        — extensions page icon
icon128.png       — store-style icon, also used in the overlay header
```

## Caveats

- Chrome won't let you install a `.crx` from outside the Web Store on a normal profile, even with Developer mode on. "Load unpacked" is the supported path for self-built extensions like this one.
- The overlay can't be injected on a few privileged URLs: `chrome://*`, the Chrome Web Store, and the New Tab page.
- Pages with very strict CSP `style-src` policies may block the overlay's inline styles. Open the service worker console (`chrome://extensions` → video-m3u8 → "service worker") to see any injection errors.

## License

MIT
