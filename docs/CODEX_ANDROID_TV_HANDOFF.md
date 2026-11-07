# MotionPlay Android TV — Codex 编译与验证交接

分支：`feature/android-tv-motion`（不要合并或修改 main，除非用户确认）。

## 范围
- `public/tv-motion/index.html`：电视游戏大厅
- `public/tv-motion/tv.html`：Jump Duck，遥控器与手机动作、碰撞判定、逐步加速
- `public/tv-motion/air-drums.html`：Air Drums，本地歌曲、自动起音检测、三轨谱面、难度、偏移校准、计分与结算
- `public/tv-motion/phone-camera.html`：手机 MediaPipe Pose 姿态识别与配对
- `tools/tv-motion/server.mjs`：WebSocket 配对服务
- `android-tv/`：Android TV WebView 壳
- `.github/workflows/android-tv-motion.yml`：编译工作流

## 编译前检查
1. 检查 Gradle、JDK、Android SDK 版本与 GitHub Actions 兼容性；仅在分支内修复。
2. 确认 WebView 的页面地址与本地 HTTP 服务地址一致；检查 Android TV 网络权限、HTTP 明文访问策略。
3. 检查电视遥控器焦点导航、文件选择器（WebChromeClient.onShowFileChooser）能否打开音频文件。若无法选歌，优先修复 Android TV 壳。
4. 手机摄像头要求 HTTPS 安全上下文；配对服务要使用 WSS（localhost 例外）。测试手机与电视是否访问同一 relay。
5. 先运行现有 relay 测试与页面 JS 语法检查，再编译 APK。

## 实机验收
- Jump Duck：遥控器 OK 启动；上下键跳跃/下蹲；不同分辨率碰撞一致；手机断连暂停。
- Air Drums：电视选本地 MP3/WAV，成功解码、自动生成节奏点；简单/标准/困难谱面密度不同；三轨音符可见；击鼓仅匹配对应轨道；PERFECT/GOOD/MISS、漏击与结算准确率正确；重复播放成绩重置；停止播放不继续发声。
- 判定偏移 -150ms 至 +150ms 可用；观察蓝牙音频、手机摄像头、WebSocket 延迟。
- 长时间播放检查卡顿、内存、音频资源释放、遥控器焦点。

## 已知限制
- 自动谱面为轻量级能量起音 + 简单低/高频特征分轨，并非成熟音乐源分离或专业节拍跟踪；复杂音乐可能产生不合理谱面。
- 手机 Pose 只有 LEFT/RIGHT/JUMP/DUCK 四类动作，尚未实现双手独立击鼓。
- 本分支尚未经过真实 Android TV APK 构建与设备端到端验证。
- 歌曲从本地选择，不上传音频；请使用有权使用的音频进行测试。

## Codex 指令
在 `feature/android-tv-motion` 上执行静态检查、测试、Android TV APK 编译与实机兼容性修复；保持最小修改，明确记录测试结果与 APK 构建产物，不要将未验证项标为通过。