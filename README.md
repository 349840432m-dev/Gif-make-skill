# GIF Maker Skill / GIF 制作助手

一个自包含、可移植的 Codex Skill，用于创建、运行、维护和扩展本地 GIF 制作应用 **CineGIF**。

A self-contained, portable Codex skill for creating, running, maintaining, and extending the local **CineGIF** application.

仓库内置完整 React 模板，不依赖另一份源码仓库。即使目标电脑上没有现成项目，也可以由 Skill 初始化出可运行的 CineGIF 应用。

The repository bundles a complete React template, so no separate source repository is required. The skill can initialize a runnable CineGIF app on a new computer.

## 功能 / Features

CineGIF 提供三种本地 GIF 制作模式：

CineGIF provides three local GIF creation modes:

- 单图动效：六种运动预设 / Single-image animation with six motion presets
- 多图轮播：2–10 张图片、排序、转场和时长控制 / Multi-image slideshow with ordering, transitions, and timing
- 视频转 GIF：片段范围、播放速度、FPS、尺寸与循环控制 / Video-to-GIF with clip range, playback speed, FPS, size, and loop controls
- Canvas 实时预览、播放与暂停 / Real-time Canvas preview, play, and pause
- GIF 编码进度、取消、下载与错误反馈 / Export progress, cancellation, download, and error feedback
- 中文深色界面 / Chinese dark cinematic interface
- 全程本地处理，不上传图片或视频 / Fully local processing with no image or video uploads

## 技术栈 / Tech stack

- React 19 + TypeScript + Vite
- Canvas rendering and browser-native image/video decoding
- `gifenc` for client-side GIF encoding
- Vitest + ESLint
- Python 3 scripts for project discovery, initialization, environment checks, and portability validation

## 安装 Skill / Install the skill

使用 Skills CLI：

Using the Skills CLI:

```bash
npx skills add 349840432m-dev/Gif-make-skill -g -y
```

或手动克隆到 Codex Skills 目录：

Or clone it manually into the Codex skills directory:

```bash
git clone https://github.com/349840432m-dev/Gif-make-skill.git \
  ~/.codex/skills/gif-maker
```

安装后重启 Codex，使其重新扫描本地 Skills。

Restart Codex after installation so it can rescan local skills.

## 创建 CineGIF 项目 / Create a CineGIF project

进入 Skill 目录后，将内置模板初始化到一个新的或空的目录：

From the skill directory, initialize the bundled template into a new or empty directory:

```bash
python3 scripts/init_project.py --destination "$HOME/CineGIF"
cd "$HOME/CineGIF"
npm ci
npm run typecheck
npm run build
npm run dev
```

初始化脚本不会覆盖非空目录。

The initialization script does not overwrite a non-empty directory.

## 使用 Skill / Use the skill

```text
Use $gif-maker to create and run a self-contained CineGIF project.
```

```text
使用 $gif-maker 创建一个本地运行的 GIF 制作应用，并验证构建结果。
```

Skill 也适用于已有 CineGIF 项目的修改、调试、迁移、UI 优化和功能扩展，例如：

The skill can also modify, debug, migrate, redesign, or extend an existing CineGIF project, including:

- 单图动画与动效参数 / Single-image animation and motion controls
- 多图轮播与转场 / Multi-image slideshows and transitions
- 视频抽帧、时间线和播放速度 / Video frame extraction, timelines, and playback speed
- GIF 尺寸、质量、帧率与下载行为 / GIF sizing, quality, frame rate, and download behavior

## 环境要求 / Requirements

- Codex with local skills support
- Python 3.9+
- Node.js `^20.19.0` or `>=22.12.0`
- npm
- A browser supporting Canvas, Blob URLs, and native video decoding

首次执行 `npm ci` 需要联网下载依赖。

The first `npm ci` run requires network access to download dependencies.

## 常用命令 / Common commands

查找现有项目：

Locate an existing project:

```bash
python3 scripts/find_project.py --start "$PWD"
```

检查运行环境：

Check the environment:

```bash
python3 scripts/check_environment.py --start "/path/to/CineGIF"
```

验证应用：

Validate the app:

```bash
npm run test
npm run typecheck
npm run lint
npm run build
```

验证 Skill 的可移植性：

Validate skill portability:

```bash
python3 scripts/test_portability.py
```

## 仓库结构 / Repository structure

```text
.
├── SKILL.md                    # Skill 工作流、规则与验证要求
├── agents/openai.yaml          # 显示信息与默认提示词
├── assets/cinegif-template/    # 完整 CineGIF React 应用模板
├── references/                 # 项目结构和跨电脑安装说明
└── scripts/                    # 查找、初始化、同步和校验脚本
```

应用模板内部包含产品、UI、技术、数据、接口、阶段计划、验收和变更记录等文档，详见 `assets/cinegif-template/docs/`。

The bundled app includes product, UI, technical, data, API, stage, acceptance, and changelog documentation under `assets/cinegif-template/docs/`.

## 隐私与边界 / Privacy and boundaries

- 图片和视频只通过浏览器本地文件 API 读取。
- 动画帧与视频帧由 Canvas 在本地生成。
- GIF 在当前页面内编码，不包含上传接口、账号系统、分析脚本或云存储。
- 核心流程不依赖服务端编码，也没有引入 `ffmpeg.wasm`。
- 修改某个模式时应保持其他模式行为不变，并让预览与导出规则一致。

- Images and videos are read only through browser-local file APIs.
- Animation and video frames are rendered locally with Canvas.
- GIFs are encoded in the page; there is no upload API, account system, analytics, or cloud storage.
- Core generation does not require server-side encoding or `ffmpeg.wasm`.
- Changes to one mode should preserve the others and keep preview and export behavior aligned.

## Documentation

- [`SKILL.md`](./SKILL.md): complete agent workflow and guardrails
- [`references/portable-setup.md`](./references/portable-setup.md): cross-computer setup and failure boundaries
- [`references/project-reference.md`](./references/project-reference.md): architecture, commands, and module responsibilities
- [`assets/cinegif-template/README.md`](./assets/cinegif-template/README.md): bundled CineGIF app overview

## License

本仓库暂未包含许可证文件。使用或分发前，请确认本项目及其依赖的授权条款。

This repository does not currently include a license file. Confirm the terms of this project and its dependencies before use or redistribution.
