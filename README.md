# Realestate Station App

国土交通省「不動産価格（取引価格・相場情報）取得API」等のオープンデータ（またはCSV）をもとに、駅ごとのマンション相場リスクを診断するアプリケーションです。

## Features

- **駅別リスク診断**: 取引件数、価格乖離、短期上昇率からリスク（Safe / Caution / Risky）を自動判定。
- **根拠の提示**: 判定に至った具体的なルール（例：「取引件数が少なく信頼性が低い」など）を明示。
- **Premium UI**: モダンで信頼感のあるダークテーマUI。

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: CSS Modules / Custom CSS Variables (Tailwind-like utility approach)

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Prepare Data

`data_raw/mlit.csv` をもとに、APIが参照する `data/stations.json` を生成します。

```bash
# 生成スクリプト実行（npx tsx を使用）
npx tsx scripts/buildStationsJson.ts
```

> **Note**: `data/stations.json` が存在しない状態でサーバーを起動すると、APIはデータを返せません。

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Deployment

Vercel へのデプロイを推奨します。

1. リポジトリをGitHub等へプッシュ。
2. Vercelで新規プロジェクトを作成し、リポジトリをインポート。
3. Build Settingsはデフォルト（`next build`）でOK。
4. **重要**: `data/stations.json` もリポジトリに含めるか、ビルドコマンド内で生成する必要があります。
   - 方法A: `data/stations.json` を git commit する（簡単）。
   - 方法B: Build Commandを `npx tsx scripts/buildStationsJson.ts && next build` に変更し、`data_raw/mlit.csv` をリポジトリに含める。

## Project Structure

- `app/api/diagnose`: 診断ロジックAPI
- `components`: UIコンポーネント (`SearchForm`, `DiagnosisResult`)
- `data_raw`: 元データ (CSV)
- `data`: 変換後データ (JSON)
- `scripts`: データ変換・検証用スクリプト

## License

MIT
