# 身体复位提醒器：Agent 工作约定

这份文档是本项目后续迭代的默认工作流程。除非用户在当前任务中明确给出不同要求，否则按这里的约定执行。

## 项目结构

- `body-reset-electron/` 是当前唯一的桌面版源码目录，技术栈是 Electron + Vue 3 + Vite + TypeScript。
- `body-reset-electron/electron/main.cjs` 是 Electron 主进程，负责文件、设置、统计、托盘、窗口、系统电源/锁屏事件和 IPC。
- `body-reset-electron/electron/preload.cjs` 是渲染进程可用的安全 IPC 桥。
- `body-reset-electron/src/App.vue` 是主界面、专注计时器和普通/睡眠复位窗口的主要实现。
- `body-reset-electron/src/global.d.ts` 保存渲染进程 IPC 和数据结构类型。
- `body-reset-electron/src/main.ts` 包含 UI 预览环境的 mock 数据和 mock IPC。
- `便携版/` 是构建后的 Windows 免安装交付目录，不在 Git 中跟踪。用户数据、视频和统计文件都放在这里，不要把它们提交到仓库。
- `手机产品/` 是独立的移动端原型，修改桌面版时不要顺手改变移动端，除非用户明确要求同步。

## 不可误解的产品意图

- 睡眠提醒不是普通的“温和提示”，它的目的就是阻止用户继续工作、推动用户离开电脑；因此必须保持严格模式。
- 睡眠提醒的首次间隔最多 5 分钟，后续提醒应加紧到 1 分钟一次。不能把 5 分钟误当成下限，也不能沿用普通提醒的“最低间隔”思路。
- 睡眠提醒全屏出现时，主界面的专注倒计时必须停止；用户紧急退出睡眠提醒后，倒计时仍保持停止，不能因为普通暂停自动恢复机制而继续工作。
- “电脑从睡眠恢复后启动”与“开机启动”是两个不同需求：开机启动使用登录/启动逻辑；睡眠恢复启动必须使用 Windows 的系统事件触发机制。Electron 的 `powerMonitor` 只能处理程序仍在运行时的恢复事件，不能唤醒一个已经退出的程序。
- 对“越来越短”“自动启动”“提醒”等会改变产品约束的表述，不要套用普通计时器经验自行猜测；如果上下文不足，先向用户确认，并把确认后的产品规则补充到本节。

## 每次迭代的默认流程

1. 先读取 `git status -sb`、当前分支、远端和最近提交，确认工作区中哪些修改属于当前任务。
2. 如果用户要求新分支，使用 `codex/<简短描述>` 命名。创建前先确认不会覆盖已有分支；如果当前工作区有用户的无关修改，不要擅自暂存或提交。
3. 修改功能时同步维护：
   - `main.cjs` 中的默认值、规范化和主进程逻辑；
   - `App.vue` 中的默认值、界面和交互；
   - `global.d.ts` 和 `main.ts` 中的类型/mock；
   - `使用说明.md`、`README.md` 或 `开发文档.md` 中对应的行为说明。
4. 完成功能后至少运行：
   - `npm run build`；
   - `node --check electron/main.cjs`；
   - `node --check electron/preload.cjs`；
   - `git diff --check`。
5. 需要交付 Windows 文件夹版时，在 `body-reset-electron/` 运行 `npm run dist:folder`。构建输出位于 `body-reset-electron/release/win-unpacked/`。
6. 更新 `便携版/` 时只替换程序文件和 `resources/`、`locales/` 等构建内容，必须保留 `data/`、`videos/`、`sleep-reminders/` 和使用说明。若旧 EXE 正在运行，先提示用户退出；清理旧版时优先使用 Windows 回收站，避免误删用户数据。
7. 用户明确要求上传 GitHub 时：
   - 先确认远端使用 SSH，而不是 HTTPS；
   - 本项目远端是 `git@github.com:DJDJDJ-Jessie/Body-repositioner.git`；
   - 通过本地 Git 创建分支、暂存、提交和推送，不把访问令牌写入文件或命令；
   - 默认推送：`git push -u origin <当前分支>`；
   - 除非用户明确要求，不自动创建 PR；
   - 最终报告分支名、提交短哈希、推送目标和验证结果。

## Git 提交范围

- 只暂存当前任务相关的源码、文档和配置文件，优先使用明确文件路径，不要在混合工作区中无条件使用 `git add -A`。
- 构建产物、`node_modules/`、`dist/`、`release/`、便携版目录、EXE/DLL/ASAR 等文件不应提交。
- 不使用 `git reset --hard`、`git checkout --` 覆盖用户修改。
- 不重写远端历史，不强制推送，除非用户明确授权。

## 功能实现注意事项

- 普通专注计时和睡眠提醒是两条不同流程。普通复位可以增加可配置的提前返回，但睡眠提醒必须继续保持严格模式。
- Windows 锁屏/解锁逻辑通过 Electron `powerMonitor` 的 `lock-screen`、`unlock-screen` 事件实现；启动时可通过当前系统锁定状态补充判断。
- Windows 睡眠恢复时，程序仍在运行可由 Electron `powerMonitor` 接收恢复事件；程序已退出时必须由 Windows 任务计划程序的 `ONEVENT` 任务监听 `System` 日志中的 `Microsoft-Windows-Power-Troubleshooter` 恢复事件，并以 `--resume-from-sleep` 重新启动程序。
- 任何新增设置都必须有：主进程默认值、校验/归一化、Vue 类型、预览 mock、界面入口、持久化和使用说明。
- 计时统计必须按实际运行/复位时长写入内部日志；外部日志同步是可选镜像，不能阻断核心功能。
- 复位窗口的完成条件要同时在界面和主进程校验，不能只依赖按钮的 `disabled` 状态。

## 交付说明

最终回复应说明：完成了什么、修改了哪些核心位置、运行了哪些检查、是否生成了新的便携版，以及 Git 分支/提交/推送状态。若有旧版清理，应明确说明是否进入回收站、是否保留了 `data/` 和视频文件。
