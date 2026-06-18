# CineGIF

让图片或短视频在浏览器中动起来，并导出为 GIF。图片处理、视频抽帧和 GIF 编码全部在本地完成，不会上传服务器。

## 功能

- 上传 JPG、PNG、WebP 图片（单文件最大 20 MB）
- 多图轮播支持 2-10 张图片、排序、删除、追加
- 视频转 GIF 支持本地 MP4、WebM、MOV 文件（默认最大 100 MB），使用原生 `video` + Canvas 抽帧
- 六种动效：电影推进、轻盈漂浮、呼吸脉动、左右摇曳、环绕镜头、景深视差
- 三种多图转场：直接切换、淡入淡出、横向滑动
- 调节时长、帧率、速度、强度、画布比例、输出尺寸、循环方式和视频片段范围
- Canvas 实时预览、播放和暂停
- GIF 编码进度、取消、下载和错误反馈

## 本地运行

```bash
npm install
npm run dev
```

## 验证

```bash
npm run test
npm run typecheck
npm run lint
npm run build
```

## 隐私

图片和视频通过浏览器的本地文件 API 读取，动画帧与视频帧由 Canvas 生成，GIF 在当前页面内编码。项目不包含上传接口、分析脚本、账号系统或云存储；不引入 `ffmpeg.wasm`，也不把素材发送到远程转码服务。
