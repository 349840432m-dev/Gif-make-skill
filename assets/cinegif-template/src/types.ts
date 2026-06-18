export type MotionId = 'zoom' | 'float' | 'pulse' | 'sway' | 'orbit' | 'parallax'

export type AspectRatioId = 'original' | '16:9' | '4:3' | '1:1' | '9:16'

export type AppMode = 'single' | 'multi' | 'video'

export type TransitionId = 'none' | 'fade' | 'slide'

export interface MotionPreset {
  id: MotionId
  name: string
  description: string
}

export interface AnimationSettings {
  motion: MotionId
  duration: number
  fps: number
  intensity: number
  speed: number
  loop: boolean
  aspectRatio: AspectRatioId
  outputWidth: number
}

export interface SlideshowSettings {
  holdDuration: number
  transitionDuration: number
  transition: TransitionId
  fps: number
  loop: boolean
  aspectRatio: AspectRatioId
  outputWidth: number
}

export interface VideoSettings {
  startTime: number
  endTime: number
  fps: number
  playbackSpeed: number
  loop: boolean
  aspectRatio: AspectRatioId
  outputWidth: number
}

export interface CanvasSize {
  width: number
  height: number
}

export interface FrameTransform {
  scale: number
  rotation: number
  x: number
  y: number
}

export interface ExportProgress {
  phase: 'idle' | 'rendering' | 'encoding' | 'done' | 'error' | 'cancelled'
  progress: number
  message: string
}

export const MOTION_PRESETS: MotionPreset[] = [
  { id: 'zoom', name: '电影推进', description: '缓慢拉近画面，营造电影感' },
  { id: 'float', name: '轻盈漂浮', description: '柔和上下浮动' },
  { id: 'pulse', name: '呼吸脉动', description: '细腻缩放，像呼吸一样' },
  { id: 'sway', name: '左右摇曳', description: '舒缓的横向摆动' },
  { id: 'orbit', name: '环绕镜头', description: '轻微旋转与环形位移' },
  { id: 'parallax', name: '景深视差', description: '斜向移动，模拟空间层次' },
]

export const DEFAULT_SETTINGS: AnimationSettings = {
  motion: 'zoom',
  duration: 3,
  fps: 12,
  intensity: 60,
  speed: 1,
  loop: true,
  aspectRatio: 'original',
  outputWidth: 1280,
}

export const DEFAULT_SLIDESHOW_SETTINGS: SlideshowSettings = {
  holdDuration: 1.5,
  transitionDuration: 0.4,
  transition: 'fade',
  fps: 12,
  loop: true,
  aspectRatio: 'original',
  outputWidth: 1280,
}

export const DEFAULT_VIDEO_SETTINGS: VideoSettings = {
  startTime: 0,
  endTime: 3,
  fps: 12,
  playbackSpeed: 1,
  loop: true,
  aspectRatio: 'original',
  outputWidth: 1280,
}
