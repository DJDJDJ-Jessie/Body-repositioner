# Body Reset Reminder

Modern portable desktop app for the Body Reset Reminder.

## Stack

- Electron portable
- Vue 3
- Vite
- TypeScript
- Tailwind CSS
- lucide icons

## Development

```bash
npm install
npm run dev
```

## Build folder portable

```bash
npm install
npm run dist:folder
```

The build output is created in `release/win-unpacked/`. After packaging, copy the generated files into the root `便携版/` folder for delivery, while preserving `videos/`, `data/`, and `使用说明.md`.

The single-file portable target still exists as `npm run dist`, but it is not the default delivery shape because it self-extracts on launch and starts more slowly.

## Runtime folders

The portable app reads and writes folders next to the EXE:

```text
身体复位提醒器.exe
videos/
  周一到周五/
  周末/
data/
```

Users only need to place reset videos in `videos/`. They can also create weekday folders such as `周一到周五`, `周末`, or day-specific folders such as `周一`, `周二`, etc. The app chooses day-specific folders first, then weekday/weekend folders; videos directly inside the root `videos/` folder are shared and added to the selected subfolder's playlist. If no matching subfolder exists, only the root folder is used.

If the reset video library is empty, the app uses a built-in text rest flow (“喝口水，起来动感一下”) instead of allowing an immediate return. Sleep reminder windows are closed when Windows enters sleep or locks, and the reminder schedule starts a fresh interval after the computer becomes active again.

Settings, playback state, and logs are managed by the app UI.
