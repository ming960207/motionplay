# Android TV 验证报告

## 构建与设备

- 分支：`feature/android-tv-motion`
- 应用源码提交：`a058fa9109860c0b925be13ef56ed37935c753c7`
- 构建方式：本机 Windows，Temurin 17.0.21、Gradle 8.9、Android SDK Platform 35；`:app:assembleDebug --no-daemon` 成功。
- APK：`android-tv/app/build/outputs/apk/debug/MotionPlay-TV-debug-a058fa9.apk`，10,560,923 字节。
- SHA-256：`2C7253FDBC66373B09239FAFF24D19D368518D693C823DD28E678C7ABD1ADDA7`
- 签名：debug APK，`apksigner verify` 通过。包名 `com.motionplay.tv`，`minSdk 23`、`targetSdk 28`。
- 设备：Xiaomi `MiTV-MFTR0`，Android 14 / API 34，`192.168.31.103`。
- 用户随后要求从电视删除应用；卸载返回 `Success`，`pm list packages com.motionplay.tv` 无结果。临时测试 WAV 也已删除。

## 检查与验收

| 项目 | 结果 | 证据 |
| --- | --- | --- |
| Relay 测试 | 通过 | `node --test tools/tv-motion/test/relay.test.mjs`：配对、动作转发、重放序号拒绝、速率限制、断开处理；1 项通过。GitHub relay workflow run 42391401729 也通过。 |
| 静态检查 | 通过 | relay server、全部游戏页内联 JS 和 vendored MediaPipe JS 的 `node --check`；AndroidManifest XML 解析；`git diff --check`。 |
| 本机 APK 编译 | 通过 | `:app:assembleDebug --no-daemon`，33 项 Gradle action 成功。产物来自本机编译。 |
| APK 内容与签名 | 通过 | APK 含大厅、两款游戏、手机配对页、Pose JS/WASM/lite 模型和本地 CA；`aapt dump badging` 与 `apksigner verify` 通过。 |
| 电视 HTTPS/WSS | 通过 | 安装的本机 APK 连接 `https://192.168.31.218:8443/`；Jump Duck 和 Air Drums 页面可打开，均从 WSS relay 获得 32 位配对码并显示等待手机连接。 |
| Jump Duck 遥控器 | 通过 | 电视端 OK 开始/暂停和方向键操作可用；1080p 页面显示正常。此前实机验证了上键跳跃与下键下蹲。 |
| Air Drums 遥控器与布局 | 通过 | 1080p 下三轨、三击鼓区、控制项和成绩信息均完整；遥控器练习可产生击打反馈并更新分数。 |
| 本地歌曲与解码 | 通过 | MediaStore 列出电视本地 WAV；WebView `decodeAudioData` 成功，10 秒测试 WAV 识别 23 个节奏点。此前同一游戏源码的实机播放到自然结束并显示结算。 |
| Android 手机摄像头端到端 | 未完成 | 手机页面、Pose 运行文件可由局域网 HTTPS 加载，TV 端 WSS 房间已创建；尚未在实体 Android 手机安装 CA、授权摄像头并完成姿态标定和动作转发。 |

手机端 MediaPipe Pose 使用 `@mediapipe/pose@0.5.1675469404` 本地资源，不依赖 CDN；测试确认 HTTPS 服务返回 Pose JS 与 `application/wasm` 文件。音频只在电视本地选择和处理，视频只在手机本地推理，relay 只传动作结果。

GitHub Android 构建 run 42391401764 是分支推送时自动触发并成功；用户提出优先本地编译后，本报告采用本机产物，不使用该 CI APK。临时 LAN HTTPS/WSS 服务已停止。`main` 未修改。
