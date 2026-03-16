# 運用・メンテナンスガイド (docs/maintenance_guide.md)

このドキュメントは、『あの街の成績表』アプリにおけるデータの更新手順および外部データ連携ロジックの網羅表をまとめたものです。定期的なメンテナンス時に参照してください。

## 1. データ更新フロー概略

アプリのデータ更新は以下の3ステップで行います。

1. **事前準備**: 統計データの年号更新や、`data_raw/` への新規CSV・Shapefileの配置
2. **バッチ実行**: `scripts/update*.ts` 各種スクリプトの実行（`data/cache/diagnosis/` 内の各駅キャッシュを更新）
3. **最終生成**: `npx tsx scripts/generateStaticDiagnosis.ts` の実行（キャッシュを `data/stations/` に反映）

---

## 2. 対象指標・データ更新フロー一覧

| カテゴリ | 指標 / データ名 | データ取得元 (API/統計名) | 更新頻度 | 更新コマンド | 年号自動更新 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **全般** | 不動産取引価格 | 国土交通省API | 年1回 | なし (動的フェッチ/キャッシュ) | **○ (自動)** |
| **資産性** | 空き家率 | e-Stat (住宅・土地統計) | 5年に1回 | `npx tsx scripts/updateVacancyRate.ts` | **○ (自動)** |
| **資産性** | 昼夜間人口比率 | e-Stat (国勢調査) | 5年に1回 | `npx tsx scripts/updateDayNightPopulation.ts` | **○ (自動)** |
| **資産性** | 駅乗降客数推移 | 国土数値情報 / 独自API | 年1回 | `npx tsx scripts/updateStationPassengers.ts` | **△ (要配置)** |
| **資産性** | 事業所数推移 | e-Stat (経済センサス) | 5年に1回 | `npx tsx scripts/updateBusinessEstablishments.ts` | **○ (自動)** |
| **安全性** | 洪水・土砂災害 | 国土地理院タイル | 随時 | なし (動的解析/キャッシュ) | **○ (自動)** |
| **安全性** | 治安・犯罪リスク | e-Stat (警察庁統計) | 年1回 | `npx tsx scripts/updateCrimeAndDowntownRisk.ts` | **○ (自動)** |
| **安全性** | 繁華街リスク | OpenStreetMap (Overpass) | 随時 | `npx tsx scripts/updateCrimeAndDowntownRisk.ts` | **○ (自動)** |
| **安全性** | 交通事故リスク | 警察庁交通統計CSV | 年1回 | `npx tsx scripts/updateTrafficAccidents.ts` | **× (要修正)** |
| **安全性** | 避難所アクセス | 国土数値情報 (P20) | 随時 | `npx tsx scripts/updateEvacuationShelters.ts` | **× (要配置)** |
| **安全性** | 地盤の強さ (ARV) | J-SHIS API | 随時 | `npx tsx scripts/updateGroundStrength.ts` | **○ (自動)** |
| **利便性** | 子育て環境 | e-Stat (社会・人口体系) | 年1回 | `npx tsx scripts/updateChildcareAvailability.ts` | **× (要修正)** |
| **利便性** | 医療機関アクセス | e-Stat (社会・人口体系) | 年1回 | `npx tsx scripts/updateMedicalFacilities.ts` | **× (要修正)** |
| **利便性** | 買い物利便性 | e-Stat (社会・人口体系) | 年1回 | `npx tsx scripts/updateCommercialFacilities.ts` | **× (要修正)** |
| **利便性** | 都市公園面積 | e-Stat (社会・人口体系) | 年1回 | `npx tsx scripts/updateCityParks.ts` | **× (要修正)** |
| **将来性** | 将来人口推計指数 | IPSS (社人研) | 5年に1回 | なし (ファイル参照) | **× (要修正)** |
| **将来性** | 財政力指数 | e-Stat (社会・人口体系) | 年1回 | `npx tsx scripts/updateFinancialCapability.ts` | **× (要修正)** |
| **将来性** | 年少人口増減率 | e-Stat (国勢調査) | 5年に1回 | `npx tsx scripts/updateChildPopulationTrend.ts` | **× (要修正)** |

---

## 3. 運用上の警告・注意点 (要手動修正)

以下の項目は、スクリプト内の定数（`TARGET_TIME` 等）を最新の統計年分に書き換える必要があります。

> [!WARNING]
> **e-Stat「社会・人口統計体系」を使用するスクリプト群**
> 最新データが公開された際は、各スクリプト内の `TARGET_TIME` (例: `'2021100000'`) を新しい年度文字列へ修正してください。
> - `updateFinancialCapability.ts`
> - `updateChildcareAvailability.ts`
> - `updateCityParks.ts`
> - `updateCommercialFacilities.ts`
> - `updateMedicalFacilities.ts`

> [!IMPORTANT]
> **年少人口増減率 (`updateChildPopulationTrend.ts`)**
> `TIME_LATEST` および `TIME_BASE` を、最新の国勢調査年（例: 2020年と2015年）に合わせて修正する必要があります。

> [!IMPORTANT]
> **オフラインデータ依存の項目**
> 以下の項目は `data_raw/` に新しいファイルを配置し、スクリプトを実行する必要があります。
> - **交通事故リスク**: `data_raw/honpyo_2024.csv`（ファイル名が年号を含むため、スクリプト内の `CSV_FILE_PATH` も変更が必要）
> - **避難所アクセス**: `data_raw/evacuation_data/` 内の `.shp` / `.dbf` ファイルの差し替え
> - **将来人口推計**: `data/population_projection.json` そのものの差し替え（5年に1回の大規模更新時）

---

## 4. 詳細なメンテナンス作業手順

### ① データの棚卸しとソースコード修正
- 各 `update*.ts` の冒頭にある定数を確認し、e-Stat等でより新しいデータが公開されている場合は書き換えます。
- 警察庁のCSV等は、最新版をダウンロードして `data_raw/` に配置します。

### ② バッチスクリプトの実行
依存関係はないため、順不同で実行可能です。
```bash
# 例: 財政力指数の更新
npx tsx scripts/updateFinancialCapability.ts
# 全件回す場合は、各 update スクリプトを順次叩きます
```
*※ APIのレートリミット回避のため、各スクリプト内には 1.5秒〜2秒の待機処理が含まれていますが、複数のスクリプトを同時に別プロセスで走らせることは避けてください。*

### ③ 静的データの最終生成 (最重要)
すべての更新が終わったら、以下のコマンドでフロントエンド用の静的ファイルを生成します。
```bash
npx tsx scripts/generateStaticDiagnosis.ts
```
このスクリプトは `data/cache/diagnosis/` 内の最新キャッシュを読み込み、`data/stations/` 内の最終的なJSONファイルへと「焼き込み」を行います。Vercel等へのデプロイ前に必ず実行してください。
