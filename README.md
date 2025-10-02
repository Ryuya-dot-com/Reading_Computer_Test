# 語彙サイズ・読解コンピュータ適応型テスト

## 概要
語彙・読解コンピュータ適応型テスト (CAT) は、学習者の語彙力と読解力を効率的に測定するブラウザベースの評価ツールです。語彙四択問題ではIRT 3PLモデルとEAP推定を用いた適応測定を実装し、続く読解セクションでは語彙推定値に応じたレベル別テキストを提示します。すべての操作はフロントエンドのみで完結し、結果は Excel 形式でダウンロードできます。

## 主な機能
- 語彙CAT: 3母数ロジスティックモデル (3PL) による能力推定、最情報量項目の逐次選択、標準誤差に基づく終了判定
- 読解評価: 物語文と説明文の2種類をスクロール完了検知付きで提示し、自由記述を2問ずつ収集
- データ収集: 操作ログ・詳細回答・マウス移動・フォーカスイベントを `DataCollector` が時系列で記録
- 出力機能: SheetJS を用いた Excel 4シート出力を即時ダウンロード
- 受験前アンケート: 氏名確認後に英語資格・3ヶ月以上の留学経験・幼少期の使用状況を任意入力（空欄でも可）
- UI/UX: Bootstrap 5とFont AwesomeによるレスポンシブUI、タッチ端末向け調整、進捗バーと保護メッセージ

## ディレクトリ構成
- `index.html` : アプリ本体、CDNライブラリ読込、ブラウザ互換チェック
- `style.css` : テスト全体のビジュアルデザインとタッチ向け最適化
- `vocab_reading_cat.js` : 語彙CATロジック、読解ステップ、データ収集と出力処理
- `jacet_parameters.csv` : 語彙項目パラメータ (3PL) と選択肢データ
- `reading_texts.csv` : レベル別の読解テキストと自由記述設問
- `Reading_Text.docx` : 元資料 (参照用)

## セットアップ手順
1. `jacet_parameters.csv` と `reading_texts.csv` を UTF-8 (BOM可) で同一ディレクトリに配置します。
2. プロジェクトルートでローカルHTTPサーバーを起動します。例: `python -m http.server 8000` または `npx serve .`。
3. ブラウザで `http://localhost:8000` を開き、トップ画面から氏名などを入力してテストを開始します。続くアンケート項目は任意入力で、空欄のままでもテストを進められます。
4. テスト完了後、画面下部のボタンから Excel / CSV / JSON をダウンロードし保存します。

## 語彙CATロジック
- 能力推定: `catConfig` の事前分布 (平均・分散) を読み込み、能力グリッド上で EAP 推定を実行して `theta` と標準誤差を算出
- 項目選択: `itemInfo3PL` によるフィッシャー情報量の最大化で次項目を決定し、高難度項目の出題数も制御
- 終了条件: 出題数 (`minItems`〜`maxItems`) と `targetSE` を満たすと語彙セクションを終了し、語彙サイズへ変換
- 反応記録: 各項目の正誤・反応時間・能力値推移を `responseDetails` に蓄積し、エクスポート時に利用

## 読解セクション
- レベル決定: 語彙サイズ推定値から `getReadingLevel` が 2K〜7K のレベルを算出
- テキスト提示: `reading_texts.csv` の `type` (`narrative` / `expository`) と `level` に一致するテキストを取得し、スクロール完了を検知して設問へ遷移
- 設問フロー: 各テキストにつき自由記述を2問出題し、回答長や入力開始時刻、設問開始・終了時刻を記録
- チェックポイント: 物語文・説明文の完了時に `DataCollector.saveCheckpoint` がJSONを準備し、途中経過の保存を支援

## データ出力とログ
- **Excel**: `Summary`, `Participant_Survey`, `Vocabulary_Responses`, `Reading_Responses` の4シートを生成し、アンケート回答（未入力の項目は空欄）と主要指標・全回答データを含む
- **CSVサマリー**: 日本語ラベルで概要指標と語彙・読解回答の要約をCSV形式でダウンロード
- **JSON**: セッションメタデータ、語彙応答詳細、読解回答、操作ログ、環境情報を1ファイルにまとめてエクスポート
- **操作ログ**: `DataCollector` が `interactions`, `detailedResponses`, `mouseMovements`, `focusEvents`, `checkpoints` を時系列で保持

## CSVフォーマット
**jacet_parameters.csv**
- 必須列: `Item`, `PartOfSpeech`, `Level`, `CorrectAnswer`, `Distractor_1-3`, `Dscrimination`, `Difficulty`, `Guessing`
- `Level` は整数、3PLパラメータは数値として読み込まれます

**reading_texts.csv**
- 必須列: `level` (数値), `type` (`narrative` / `expository`), `text`, `question1`, `question2`
- 改行は `\n` で記述可能。読み込み時に正規化されます

## 開発・カスタマイズのヒント
- `vocab_reading_cat.js` 内の `catConfig` を調整することで出題数や終了標準誤差を変更できます
- 語彙サイズ→レベル換算式 (`getReadingLevel`, `vocabFromTheta`) を差し替えれば独自のレベル設定が可能です
- UI 変更は `style.css` と `injectStyles()` 内のテンプレートを更新してください
- 追加のデータ項目を記録したい場合は `DataCollector.logInteraction` / `logDetailedResponse` を呼び出す処理を挿入します

## テストと検証
- CSVパスやCORSエラーが発生した際はブラウザのコンソールログを確認し、HTTPS配信やファイルパスを修正してください
- 読解パネルのスクロール検知は `reading-scroll-progress` を利用しているため、テキスト量が少ない場合はダミーの空行を追加するとスムーズです
- 研究用途で操作ログを分析する場合は、ダウンロードしたJSONを解析スクリプトに入力してください

## 利用ライブラリ
- Bootstrap 5.3 (CDN / jsDelivr)
- Font Awesome 6.4 (CDN)
- Papa Parse 5.4 (CSVパース)
- SheetJS 0.18 (Excel出力)
