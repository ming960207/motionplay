# MotionPlay TV + 手机体感部署说明

## 当前实现

- TV 游戏大厅：`/tv-motion/index.html`
- Jump Duck 原型：`/tv-motion/tv.html`
- Air Drums 原型：`/tv-motion/air-drums.html`
- 手机姿态控制：`/tv-motion/phone-camera.html`
- WebSocket relay：`tools/tv-motion/server.mjs`，默认监听 8787

## 本地服务

在项目根目录按现有 Next.js 工程依赖启动 Web 服务（例如 `pnpm install && pnpm dev --hostname 0.0.0.0`）；在 `tools/tv-motion` 中执行 `npm install && npm start`。

手机摄像头网页必须通过受信任的 HTTPS 域名访问。生产部署中将 `/motion-ws` 反向代理到 `http://127.0.0.1:8787` 并启用 WebSocket Upgrade。建议使用受信任证书及访问控制，不要直接向公网暴露 relay。

示例 Nginx location（须合并到已有 HTTPS server 配置）：

```nginx
location /motion-ws {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 3600s;
}
```

手机打开 `https://YOUR_HOST/tv-motion/phone-camera.html`，填写电视屏幕配对码。默认 WebSocket 地址为 `wss://YOUR_HOST/motion-ws`，也可以手动填写其他 WSS 地址。

电视打开 `https://YOUR_HOST/tv-motion/index.html`。HTTPS 下，电视游戏页和手机摄像头页默认都连接 `wss://YOUR_HOST/motion-ws`，因此反向代理必须把该路径转发到同一个 relay 并启用 WebSocket Upgrade。电视页若通过局域网 HTTP 访问，会默认连接 `ws://HOST:8787`；手机摄像头页仍须通过 HTTPS 打开，并填写指向同一 relay 的 WSS 地址。使用其他 relay 时，在电视游戏地址添加 `?relay=wss%3A%2F%2FYOUR_HOST%2Fmotion-ws`，并在手机页填写同一地址。

## 尚未通过验收

- 原版游戏内部输入接口整合（当前为独立原型及键盘桥接）
- MediaPipe 姿态阈值校准与实际跳跃/下蹲准确率
- HTTPS/WSS 手机 + TV 实测
- Android TV APK 构建与小米电视安装验证

请勿将已提交代码等同于已通过构建或真机验收。
