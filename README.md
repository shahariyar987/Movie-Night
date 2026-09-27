# Watch Party — Full User Guide

Sep 27, 2026

## What This Is

Watch Party is the app you're building: it lets two people on completely different networks watch the same video together, at the same time, with live text chat and emoji reactions. It runs from your own computer, and other people join through a link you share with them.

## One-Time Setup

Do this once per computer that will run the server.

**Install Node.js**

1. Go to [nodejs.org](https://nodejs.org) and download the LTS version for Windows.
2. Run the installer with default settings (leave "Add to PATH" checked).
3. Close every open terminal window and open a new one.
4. Run `node -v` and `npm -v` — both should print version numbers.

**Install ngrok**

1. Run `winget install ngrok.ngrok` in a terminal. (If that fails, download the zip from [ngrok.com/download](https://ngrok.com/download), unzip it, and always run commands from inside that folder instead.)
2. Close and reopen your terminal, then run `ngrok -v` to confirm it's found.
3. Sign up free at ngrok.com and copy your authtoken from the dashboard.
4. Run `ngrok config add-authtoken YOUR_TOKEN`.

## Running the Server

1. Open a terminal and `cd` into the server folder, e.g. `D:\Proj\watch-party\watch-party\server`.
2. Run `npm install` — only needed the first time (or if you re-download the project).
3. Run `npm start`. You should see `Watch party server running on http://localhost:3000`.
4. Leave this terminal window open the whole time — closing it stops the app for everyone connected.

## Connecting Two Phones

`localhost` only works on your own computer, so different-network phones need a public tunnel:

1. With the server still running, open a **second** terminal.
2. Run `ngrok http 3000`.
3. Copy the `Forwarding` URL it prints, e.g. `https://retool-carving-french.ngrok-free.dev`. This is the address both phones will use.

Note: on the free ngrok plan, this URL is temporary — every time you stop and restart ngrok, you get a new random one and have to re-share it.

## Joining a Room

1. On each phone's browser, open the ngrok URL from the previous step.
2. The first visit shows an ngrok warning page — tap **Visit Site**.
3. Enter any name, and the **same room code**, on both phones.
4. Tap **Join Room** on each — they're now together in the same room.

## Movie Setup

There are two ways to set what plays: pick from the **Movies on this server** dropdown, or paste a **direct link** to a video file.

### Playing a movie from the server computer

1. Drop any video file you legitimately own into the `movies` folder (a sibling of the `server` folder) — `.mp4`, `.webm`, `.ogg`, `.mov`, or `.m4v`.
2. Refresh the page. It shows up in the "Movies on this server" dropdown for anyone in the room.
3. Pick it and tap **Play This**. Seeking works properly here, since the server streams the file in chunks instead of requiring the whole thing to download first.

### Playing a direct video link

The "Set Video" box needs a link straight to a video file (ending in something like `.mp4`) — not a link to a webpage with a player embedded in it. A streaming site's movie page can't be used this way: the browser's `<video>` tag can only load an actual file, and such sites deliberately hide the real file link behind their own player.

**A confirmed-working test link:**

```
https://www.w3schools.com/html/mov_bbb.mp4
```

Paste this into "Set Video" on either phone to test that sync, chat, and emoji all work end to end.

### About Google Drive links

Technically possible for a small file, using Drive's direct-download link format — but Drive isn't built for streaming. It doesn't reliably support the "range requests" that seeking depends on, and larger files often trigger a "can't scan this file for viruses" warning page that breaks the video tag entirely instead of playing. Fine for a quick small test; the server's own movies folder above is the reliable option for anything you actually want to watch.

## Chat and Emoji

- Type in the chat box on the side and hit **Send** — messages appear instantly for everyone in the room.
- Tap any of the 5 emoji buttons to send a floating reaction that pops up over the video for everyone watching.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `'npm' is not recognized` | Node.js isn't installed. Install it from nodejs.org, then close and reopen your terminal. |
| `'ngrok' is not recognized` | Run `winget install ngrok.ngrok`, then reopen your terminal. If that fails, run ngrok from inside the folder you unzipped it into. |
| Video shows "access denied" | The link points to a private or decommissioned file. Use a working direct link, e.g. the test link in Movie Setup. |
| Black screen / video won't start | Tap the actual play button on the video controls. If someone else already started it, tap "Tap to resume" once — mobile browsers block auto-play until you tap. |

## Limitations and What's Next

- **No host election** — anyone in the room can currently play, pause, or seek, and it syncs everyone.
- **No periodic drift correction** — sync only reacts to play/pause/seek events, not a steady heartbeat, so long movies can drift slightly if the network is flaky.
- **Free ngrok URLs are temporary** — they change on every restart. Deploying the server to a free host like Render or Railway would give a permanent link instead.
- **A phone's own downloaded file still can't stream directly** — movies now play reliably once they're on the server computer (see Movie Setup), but getting a file *from* a phone *onto* the server still means transferring it manually. Letting the host's phone upload straight to the server is the next roadmap step.
- **Further down the line:** packaging the app with Electron or Tauri for a native desktop window, and exploring peer-to-peer streaming via WebRTC.
