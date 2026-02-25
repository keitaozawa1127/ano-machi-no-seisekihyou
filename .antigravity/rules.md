# Antigravity Agent Rules (Mandatory)

## Verification Protocols

### 1. Stabilization Wait (Deep Breath)
- **UI変更後の検証において、ブラウザを開いた直後のスナップショット取得を禁止する。**
- ページロード完了後、必ず **3000ms** の待機時間を設けること。
- 特定のDOM要素（例: `data-testid="loaded"`）の出現をポーリングで待機すること。
- コンソールログ（stdout）を監視し、`Hydration failed` や `Minified React error` が含まれる場合は、画面表示に関わらず**失敗**とみなすこと。

### 2. Negative Visual Assertion
- スクリーンショットを取得した際、画像の「エントロピー」または「ピクセル分布」を評価せよ。
- 画像の95%以上が単色（白 `#FFFFFF` または黒 `#000000`）である場合、それは「正常」ではなく「**ロード失敗**」である。
- 直ちに再試行せよ。

---

## Code Integrity & Performance Standards

### 3. Anti-Deletion Policy (削除禁止)
- 既存のビジネスロジックや計算処理の削除は、いかなる理由（パフォーマンス改善を含む）であっても**厳禁**とする。
- 既存コードを `//... existing code` で置き換える行為は、**機能破壊（Critical Bug）**とみなされる。
- **絶対に行ってはならない。**

### 4. Mandatory Offloading (Web Worker)
- パフォーマンスのボトルネック（ブロッキング処理）を特定した場合、そのロジックを削除または単純化するのではなく、必ず **Web Worker** (`*.worker.ts`) へ移行せよ。
- 以下の手順を厳守すること：
  1. 重い計算関数を特定する。
  2. 新しい Worker ファイルを作成し、ロジックを移動する。
  3. メインスレッドから Worker を呼び出す非同期処理を実装する。
  4. 元のロジックが削除されていないことを、移行後の Worker コードと照合して証明せよ。

---

## Submission Gate

### 5. External Audit Requirement
- タスク完了を報告する前に、必ず `node audit/verify_ui.mjs` を実行せよ。
- スクリプトが **Exit Code 0** を返さない限り、タスク完了を報告することを**禁止**する。
- 失敗した場合は、ログを読み、原因を特定し、修正してから再実行せよ。

### 6. 証拠提出の義務
- 完了報告の際は、必ず `node audit/verify_ui.mjs` の**実行結果（テキストログ全文）**を添付せよ。
- ログなき報告は無効とする。
