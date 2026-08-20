# Fleet Floor Control — Shared Web App

A live classroom discussion queue for **15 spaceship crews**.

## What it does

- Instructor opens `/instructor.html` on the classroom computer/projector.
- Instructor opens a room (default room code: `FLEET15`).
- Instructor can rename all 15 ships.
- Students open `/crew.html` on a phone.
- Each crew enters the room code, selects its ship, and taps **REQUEST FLOOR**.
- The instructor screen updates live.
- Requested ships turn yellow and enter a numbered queue.
- The instructor clicks **Recognize** and that ship turns green.
- Crew phones also update to show when they have been recognized.

## Run it locally

You need Node.js 20 or newer.

```bash
npm install
npm start
```

Then open:

- Instructor: `http://localhost:3000/instructor.html`
- Crew: `http://localhost:3000/crew.html`

Default instructor PIN: `captain`

For real use, set a private PIN before launching:

macOS/Linux:
```bash
INSTRUCTOR_PIN=my-secret-pin npm start
```

Windows PowerShell:
```powershell
$env:INSTRUCTOR_PIN="my-secret-pin"
npm start
```

## Easiest deployment: Render

1. Put these files in a GitHub repository.
2. Sign in to Render.
3. Create a **Web Service** from the GitHub repository.
4. Render can read `render.yaml`, or configure:
   - Build command: `npm install`
   - Start command: `npm start`
5. Add an environment variable:
   - Key: `INSTRUCTOR_PIN`
   - Value: a PIN only you know.
6. Deploy.
7. Render will give you an `https://...onrender.com` address.
8. Open `https://YOUR-APP.onrender.com/instructor.html` on the classroom computer.
9. Give students `https://YOUR-APP.onrender.com/crew.html?room=FLEET15`.

## Important classroom note

The app keeps the current room state **in server memory**. That is ideal for a live class session, but if the web service restarts, the ship names and queue reset. Keep a copy of the 15 ship names somewhere convenient.

On Render's free service tier, an inactive service can spin down. Open the instructor page a few minutes before class and keep it open during the activity.

## Suggested classroom workflow

1. Before class, open the instructor page and create room `FLEET15`.
2. Enter the 15 ship names.
3. Put the crew URL on your LMS, slide, or QR-code generator.
4. Each group chooses its assigned ship on one phone.
5. Project the instructor screen full-screen.
6. Students request recognition from their crew phone.
7. Use the queue to call on ships.

## Files

- `server.js` — Express + Socket.IO live server.
- `public/instructor.html` — projector/instructor interface.
- `public/crew.html` — student phone interface.
- `public/style.css` — visual design.
- `render.yaml` — optional Render deployment config.
