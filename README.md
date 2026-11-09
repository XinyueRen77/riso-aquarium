# Riso Aquarium

一个 AI agent 扮演你（riso 印刷师）：和客人聊天，弄清楚他们想要什么样的水族箱，然后"印"出一张会动的 riso 水族箱，可以反复打样、修改，最后导出 PNG。

- **Agent**（概率部分）：LLM（通过 OpenRouter，默认 Claude Haiku 5.5）只负责对话，并输出一份场景配方（JSON）。
- **印刷机**（确定部分）：校验配方（最多 3 种油墨、只能用目录里的生物），然后搭一个 3D 水族箱。每个像素先算出每种油墨的覆盖量（受光照影响），再把每种油墨做成各自角度的半调网点，套色错位后叠印在纸上。
- 拖动可以转动水族箱，滚轮缩放，点击水面投喂，鱼会游过来吃。

## 文件

| 文件 | 内容 |
|---|---|
| `api/_prompt.js` | System instructions 和 knowledge（**改 agent 行为就改这里**） |
| `api/chat.js` | Vercel 函数：通过 OpenRouter 调用模型，设置模型和 temperature |
| `public/riso.js` | 油墨表 + 校验器 |
| `public/tank3d.js` | 3D 印刷机：three.js 场景 + 生物动画 + riso 半调着色器 |
| `public/app.js` | 聊天、打样记录、press log、导出 |
| `docs/` | System card v1、eval 测试集、system diagram |

## 本地运行

1. 在这个文件夹里新建 `.env.local`，写一行 `OPENROUTER_API_KEY=你的key`（在 openrouter.ai → Keys 创建）（这个文件不会上传到 GitHub）。
2. 运行下面的命令，然后打开 http://localhost:3000

```bash
npm run dev
```

## 部署（GitHub → Vercel）

1. 把这个文件夹推到一个新的 GitHub repo。
2. 在 Vercel 里 Import 这个 repo，Framework 选 **Other**，其他设置保持默认。
3. 在 Settings → Environment Variables 里添加 `OPENROUTER_API_KEY`，然后 Redeploy。
4. 可选：添加 `MODEL`（任意 OpenRouter 模型 id，如 `openai/gpt-5.6-luna`、`google/gemini-3.8-flash`）来换模型，做模型对比的 eval。

API key 不要放进 slides、日志或任何截图里。
