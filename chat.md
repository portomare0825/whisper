10:41:26.869 Running build in Washington, D.C., USA (East) – iad1
10:41:26.870 Build machine configuration: 2 cores, 8 GB
10:41:27.111 Cloning github.com/portomare0825/whisper (Branch: main, Commit: fd880a4)
10:41:27.988 Cloning completed: 876.000ms
10:41:29.705 Restored build cache from previous deployment (AjU97J1kVZAaTpZqurPdPDDxp9Z5)
10:41:30.073 Running "vercel build"
10:41:30.099 Vercel CLI 54.11.1
10:41:30.426 Installing dependencies...
10:41:33.369 
10:41:33.369 up to date in 3s
10:41:33.370 
10:41:33.370 155 packages are looking for funding
10:41:33.370   run `npm fund` for details
10:41:33.399 Detected Next.js version: 16.2.6
10:41:33.404 Running "npm run build"
10:41:33.505 
10:41:33.505 > avatarchat-pro@0.1.0 build
10:41:33.505 > next build
10:41:33.505 
10:41:34.197   Applying modifyConfig from Vercel
10:41:34.213 ▲ Next.js 16.2.6 (Turbopack)
10:41:34.213 
10:41:34.253   Creating an optimized production build ...
10:41:48.263 
10:41:48.264 > Build error occurred
10:41:48.268 Error: Turbopack build failed with 1 errors:
10:41:48.268 ./src/app/api/chat/route.ts:519:1
10:41:48.269 'import', and 'export' cannot be used outside of module code
10:41:48.269   517 | // HANDLER PRINCIPAL
10:41:48.269   518 | // ═══════════════════════════════════════════════════════════════════
10:41:48.269 > 519 | export async function POST(req: Request) {
10:41:48.270       | ^^^^^^
10:41:48.270   520 |   try {
10:41:48.270   521 |     const { conversation_id, message, avatar_id, is_regenerate, action, messageIds } = aw...
10:41:48.270   522 |
10:41:48.271 
10:41:48.271 Parsing ecmascript source code failed
10:41:48.271 
10:41:48.271 
10:41:48.272     at <unknown> (./src/app/api/chat/route.ts:519:1)
10:41:48.336 Error: Command "npm run build" exited with 1