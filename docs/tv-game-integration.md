# MotionPlay 原版游戏接入说明

## 当前完成度

已提交通用同源 iframe 键盘事件桥接原型：`/tv-motion/game-bridge.html?game=/实际游戏路径`。

**尚未验证原版游戏路由、键盘监听及真实玩法兼容性。** GitHub 代码搜索未返回相关文件，不能据此猜测原版路由或声称完成整合。

## 运行与验证

1. 运行原版 Next.js Web 服务。
2. 启动 `tools/tv-motion` 中的 WebSocket relay（`npm install && npm start`）。
3. 电视浏览器访问 `/tv-motion/game-bridge.html?game=%2F实际游戏路径`。
4. 手机访问 `/tv-motion/phone-camera.html`，输入配对码和可访问的 WSS 地址。
5. 验证每种动作是否触发原游戏行为。

手机摄像头页面必须处于 HTTPS 安全上下文；在 HTTPS 页面上连接不安全的 ws:// 通常会被阻止。开发时应为 relay 配置 TLS 反向代理。TV 页与游戏页面必须同源，才能直接访问 iframe DOM。

## 已知限制

- 原版游戏可能不监听键盘事件。若如此，应在原游戏输入层新增明确的 `MotionAction` 适配器，而不是模拟 DOM 键盘事件。
- 部分游戏只监听 window 或只处理按住按键；当前桥接原型发出连续的 keydown/keyup，不能保证兼容。
- iframe 内如果存在跨域导航或 CSP/X-Frame-Options 限制，桥接会失败。
- 现有手机动作规则仅是演示性启发式，不具备实际跳跃与下蹲动作识别的可靠性。
- TV APK 仍是 WebView 壳，需要可访问的 Web 服务；不是离线 APK。
- 尚未执行 GitHub Actions 构建、手机摄像头和 Android TV 真机测试。

## 下一阶段需要完成的源码审计

定位实际游戏路由、姿态检测模块、游戏状态更新、碰撞判断和输入入口；将 `MotionAction` 作为明确输入源接入各游戏，移除 iframe 键盘桥接的临时依赖；补齐单元测试和端到端验收。
