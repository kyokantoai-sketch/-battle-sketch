# 描写バトルゲーム

2人で「名前＋短い描写」を入力すると、Geminiの画像生成でキャラクターを作り、画像だけで勝敗判定→バトル物語＋バトル画像を出力するアプリです。

## セットアップ

このリポジトリは `app/` 配下にNext.jsプロジェクトが入っています。以降のコマンドは `app/` で実行してください。

```bash
cd app
```

### 1) Supabase 準備

- Supabaseで新規プロジェクトを作成
- まだテーブルが無い場合: `supabase/schema.sql` をSQL Editorで実行
- すでに tables (rooms / characters / battles) がある場合: `supabase/migrate_existing.sql` を実行
  - 参加枠/観戦機能のために `room_slots` が追加されます
- Storageにバケット `battle-images` を作成（公開に設定）

### 2) 環境変数

`.env.local.example` をコピーして `.env.local` を作り、値を埋めてください。

```
GEMINI_API_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
ROOM_PASSWORD_SALT=...
```

※ `SUPABASE_ANON_KEY` は現状未使用ですが、将来のクライアント接続用に追加しておいてもOKです。

モデルは必要に応じて変更できます:

```
GEMINI_IMAGE_MODEL=gemini-2.5-flash-image
GEMINI_TEXT_MODEL=gemini-2.5-flash
GEMINI_BATTLE_IMAGE_MODEL=gemini-2.5-flash-image
```

### 3) 起動

```bash
npm install
npm run dev
```

`http://localhost:3000` を開くと動きます。

## ルームの流れ

1. ルーム作成（文字数上限・物語文字数を設定）
2. URLとパスワードを共有して入室
3. 各プレイヤーが名前＋描写を入力
4. 画像のみで勝敗判定 → 物語＋バトル画像生成

## 注意

- バトル判定は **画像のみ** をGeminiに渡しています。
- 入力や画像は「小学生でも見られる」範囲になるようプロンプトで制御しています。
- SupabaseのRLSは未設定（サービスロールでのみアクセス）です。公開アクセスが必要ならRLSポリシーを追加してください。
