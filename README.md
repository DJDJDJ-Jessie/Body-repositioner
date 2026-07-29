# Body Repositioner

身体复位提醒器是一个免安装 Windows 桌面工具，工作方式类似番茄钟：用户开始专注倒计时，到点后进入沉浸式复位窗口，播放本地身体复位视频；视频播放完成后才能回到工作。

## 功能

- 专注倒计时：开始、暂停、继续、重置、立即复位。
- 沉浸式复位：全屏置顶播放本地视频，覆盖 Windows 任务栏。
- 视频轮播：自动选择不同视频，轮完后再进入下一轮。
- 按星期选视频：支持 `周一到周五`、`周末`、`周一` 到 `周日` 等文件夹。
- 可视化设置：专注时长、视频文件夹、开机启动、托盘运行、严格模式、紧急退出。
- 今日节奏：显示今日工作时长、运动休息次数和复位总时长。
- 身体账本：查看本周、本月数据表，并自动生成 `data/daily-stats.csv`。

## 技术栈

- Electron
- Vue 3
- Vite
- TypeScript
- Tailwind CSS
- lucide icons

## 开发

```bash
cd body-reset-electron
npm install
npm run dev
```

## 构建

```bash
cd body-reset-electron
npm install
npm run dist:folder
```

默认交付方式是免安装文件夹版，而不是单文件 portable exe。单文件 portable 会自解压，双击启动会更慢。

## 交付说明

最终交付时复制整个 `便携版` 文件夹：

```text
便携版/
  身体复位提醒器.exe
  videos/
  data/
  使用说明.md
```

`便携版/`、视频和数据不提交到代码仓库。exe 体积较大，适合通过 GitHub Releases 或其他附件方式发布。
