# 企鹅王 Penguin King

可爱企鹅主题的 **骷髅王（Skull King）** 线上桌游。规则与原版一致，只是把海盗、鹦鹉、骷髅王换成了企鹅、小鱼、冰山和企鹅王。

## 怎么玩

需要 Node.js 18+。本机如果还没有 `node`，可以用：

```bash
export PATH="$HOME/.local/node/bin:$PATH"
```

然后：

```bash
npm install
npm run dev
```

或直接：

```bash
./dev.sh
```

浏览器打开 [http://localhost:5173](http://localhost:5173)

- **单人**：和 1–5 只人机企鹅同桌
- **线上**：创建房间，把网址和 4 位房间号发给朋友；也可以加人机凑人数。部署到网上之后，不在同一个地方也能一起玩
- 2–6 人，10 轮
- 可选进阶牌：深海巨妖、白鲸、小鱼宝藏

## 线上玩

游戏需要一台一直开着的 Node 服务器（因为线上房间用了实时连接）。把代码推到 GitHub 后，可以免费部署到 [Render](https://render.com)：

1. 打开 [Render Dashboard](https://dashboard.render.com)，用 GitHub 登录
2. **New → Web Service**，选这个仓库
3. Build Command 填 `npm ci && npm run build`
4. Start Command 填 `npx tsx server/index.ts`
5. 环境变量加上 `NODE_ENV=production`
6. 创建之后会得到一个 `https://xxxx.onrender.com` 网址，把这个发给朋友即可

也可以用 Docker：`docker build -t penguin-king . && docker run -p 3001:3001 penguin-king`

本机生产模式：

```bash
npm run build
NODE_ENV=production npm start
```

默认端口 `3001`（云平台会自动设置 `PORT`）。

## 花色对照

| 原版 Skull King | 企鹅王 |
| --- | --- |
| 鹦鹉 / 绿 | 小鱼 |
| 宝箱 / 黄 | 贝壳 |
| 藏宝图 / 紫 | 极光 |
| 骷髅旗 / 黑（王牌） | 冰山 |
| 海盗 | 探险企鹅 |
| 虎女 | 条纹企鹅 |
| 骷髅王 | 企鹅王 |
| 美人鱼 | 人鱼企鹅 |
| 逃跑 | 肚皮滑行 |
| 克拉肯 / 白鲸 / 战利品 | 深海巨妖 / 白鲸 / 小鱼宝藏 |
