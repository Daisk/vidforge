# VidForge 开发会话总结

> 题目：使用 AI 写一个视频格式转换器（考察 AI 工程能力，限时三天）
> 本文档按题目要求记录：会话总结、开发者的决策选择与反馈调整。

## 一、需求解读（开工前对题目的翻译与界定）

| 条目 | 我的理解 |
| --- | --- |
| 1. 加载视频信息 + 缩略图 | 必须真实解析媒体（ffprobe），缩略图不是文件图标 |
| 2. ffmpeg 命令行 | 允许 spawn CLI，重点考察对命令行工具的工程化封装 |
| 3. 自己做优化 | 自由发挥，体现产品与工程判断 |
| 4. 会话总结 md | 决策与反馈要有据可查（即本文档） |
| 6. 界面必须像"客户端" | 交付物必须是可安装/可运行的桌面软件形态，而非网页 demo 或 CLI 脚本 |
| 7. 给人用且自己要测 | 必须真实跑通全流程，最好有可复现的测试证据 |

## 二、关键决策记录

### D1 · 技术栈：Electron + React + TypeScript（而非纯 Web / Python-Tkinter）

- **备选**：纯命令行（秒拒：违反第 6 条）；Python+Tkinter（界面质感差）；PySide6（可行但 UI 投入产出比低）；**Tauri**（需 Rust 工具链，环境成本高）。
- **选择理由**：第 6 条是"审核优先看"的一项。Electron 能以最高效率产出接近商业桌面软件的界面（无边框窗口、暗色主题、拖拽、自绘标题栏），且 Node 的 `child_process` 封装 FFmpeg CLI 非常顺手。
- **代价与对策**：包体积大 → 提供便携版与安装包；"网页感" → 用桌面软件的交互范式规避（自绘标题栏、全局拖拽、快捷键、任务队列）。

### D2 · FFmpeg 获取策略：探测顺序 `FFMPEG_PATH 环境变量 → 打包 resources/bin → 项目 bin/ → 系统 PATH`

打包后把 `ffmpeg.exe/ffprobe.exe` 放进 `bin/` 随应用分发，评审机器无需预装 FFmpeg。

### D3 · 缩略图方案：海报帧用 `thumbnail` 滤镜选"最具代表性帧"，胶片条用 `fps+scale+tile` 单次出图

- 海报帧跳过片头 12%（避开黑场），从 90 个候选帧里按直方图多样性挑一张——比"取第一帧"质量明显更好。
- 胶片条一次 ffmpeg 调用生成一张 10 帧拼图，渲染端 `background-position` 切片：1 次进程、1 个请求、10 个预览位。
- 结果按内容哈希缓存，二次打开零开销。

### D4 · 硬件加速：不信任编码器列表，做真实试编码

`ffmpeg -encoders` 列出 nvenc ≠ 你的显卡驱动能跑。启动时对每个候选（nvenc/qsv/amf/videotoolbox）用 0.2s 合成源实测，结果缓存 24h。转换失败且 stderr 命中硬件特征时，自动用软件编码重试并在 UI 标注"已降级"。

### D5 · 进度：`-progress pipe:1` 而非解析 stderr 的 `-stats`

结构化 `key=value`，解析 `out_time_us / speed / fps / total_size`，ETA 由剩余时长 ÷ 实测速度计算，120ms 节流推送渲染层。

### D6 · 队列：串行 + 可取消

转码是 CPU/GPU 大户，默认串行避免资源争抢；取消在 Windows 用 `taskkill /T /F` 杀进程树并清理半成品文件。

### D7 · 安全模型：不关 webSecurity 的前提下播放本地视频

注册自定义 `vf://` 协议（`protocol.handle`），手写 HTTP Range 支持以支持视频 seek；渲染进程 `contextIsolation` 开启，IPC 白名单暴露，无 nodeIntegration。

## 三、会话中的问题与修复（反馈调整记录）

| # | 现象 | 根因 | 修复 |
| --- | --- | --- | --- |
| 1 | Electron 二进制未下载（`dist/electron.exe` 缺失） | npm 镜像环境 postinstall 未生效 | 手动执行 `node node_modules/electron/install.js` + npmmirror 镜像 |
| 2 | `Property 'get' does not exist on type 'ConversionService'`（tsc 编译期错误） | 重构时删除了 `get(id)` 方法但自测脚本仍调用 | 补回 `ConversionService.get()`。**教训：这是编译错误而非运行时错误，"打印 instanceof Map"之类的排查方向完全错误** |
| 3 | 截图黑屏 `Cannot access 'startConvert' before initialization` | `useEffect(fn, [startConvert])` 的依赖数组在组件体执行到该行时立即求值，而它排在 `startConvert` 的 `useCallback` 之前 → TDZ | 将该 effect 移到定义之后。**教训：hooks 依赖数组是立即求值的表达式** |
| 4 | 顶部显示 `FFmpeg 7.0.2-full_build-www.gyan.dev` | 版本字符串未截断 | 正则提取 `\d+\.\d+(\.\d+)?` |
| 5 | MP4 文件的容器显示为 `mov` | ffprobe 返回格式组 `mov,mp4,m4a,...`，取了第一个别名 | 优先采用文件扩展名（当其属于该格式组），并维护别名表 |
| 6 | VP9 预设下显示 x264 的"编码速度"下拉 | 下拉可见性只判断了"有视频流" | 仅 x264/x265 显示；VP9/AV1 的速度参数在命令构建器内固定 |

## 四、测试证据

- `electron . --selftest`：无头端到端（probe → 缩略图 → 4 预设转换），结果见 `test-results.json`。
  - mp4-h264-720p：done，1.6s
  - gif（调色板）：done，2.1s
  - audio-mp3：done，0.3s
  - webm-vp9-480p：done，7.0s
- 界面截图 `screenshots/app.png`：真实应用渲染（非 mock），底部队列为正在执行的 VP9 任务（13% · 1.46x · 剩余 6s）。

## 五、如果继续做（下一步计划）

1. 打包产物接入自动更新（electron-updater）
2. 输出预设支持"保存为我的预设"
3. 剪辑轻参数（起止时间、裁剪）——FFmpeg `-ss/-t` 已具备能力
4. 多语言
5. CI：GitHub Actions 跑 `--selftest` + 三平台打包
