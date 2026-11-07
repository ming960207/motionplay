# Android TV 验证报告

## 构建与安装

- 分支：`feature/android-tv-motion`
- 源码提交：`8c85370d8c652afd4bcec6c4fa0fc5ff13113862`
- 构建： [GitHub Actions run 42385901313](https://github.com/ming960207/motionplay/actions/runs/42385901313)，Gradle APK 构建与 artifact 上传均成功。
- APK：`android-tv/app/build/outputs/apk/debug/app-debug.apk`，824,925 字节。
- SHA-256：`6DA75FC92D73B8E9943267CAA812904EBA503BF69CB421633BFFC3DFD4AF9AEE`
- 应用：`com.motionplay.tv`，版本 `0.1.0`，`minSdk 23`、`targetSdk 28`。
- 设备：Xiaomi `MiTV-MFTR0`，Android 14 / API 34，`192.168.31.103`。APK 安装成功。

## 检查结果

| 项目 | 结果 | 验证内容 |
| --- | --- | --- |
| Relay 测试 | 通过 | 配对、动作转发、重放序号拒绝、断开处理：1 项通过。 |
| 静态检查 | 通过 | relay server `node --check`、6 个 TV-motion HTML 内联脚本语法检查、AndroidManifest XML 解析、`git diff --check`。 |
| Android 编译 | 通过 | CI 使用 Gradle 构建 debug APK 并上传 artifact。 |
| 电视本地歌曲选择 | 通过 | 该电视没有可处理 `audio/*` 的系统选择器；新增 MediaStore 回退列表并授予音频读取权限后，可选择测试 WAV。 |
| WebView 解码与播放 | 通过 | 页面显示 `motionplay-test.wav · 10 秒 · 22 个自动节奏点`；试播期间音符轨道推进并记录漏击，歌曲自然结束。 |
| Air Drums 遥控器输入 | 通过 | 左、右、上方向键产生击打反馈，分数、命中数和连击更新。 |
| Jump Duck 遥控器输入 | 通过 | OK 进入遥控器试玩；上键触发跳跃，下键触发下蹲，画面动作可见。 |
| 手机摄像头配对 | 未完成 | 电视能显示配对码并等待连接；仓库声明的 HTTPS 页面和 WSS 中继均返回 404，且没有可替代服务地址，因此无法完成手机摄像头、校准和实时体感端到端验证。 |

歌曲测试使用临时合成的 10 秒 WAV，验证了电视 MediaStore → Android WebView 文件选择回调 → `decodeAudioData` → 节奏分析与播放。测试文件已从电视删除。其他真实歌曲、不同编码格式、USB 存储扫描和长时间播放未在此设备上逐项验证。

测试后清除了应用中的临时局域网服务地址，应用仍安装在电视上；重新打开时会显示服务地址配置框。音频权限会在首次选择歌曲时请求。未发布或部署在线网页与中继服务，也未修改 `main` 分支。
