# Stitch Design ランディングページ 仕様書

## 概要
- アプリ名: Stitch Design
- 種類: ビデオ制作・編集・マーケティングサービスのランディングページ
- 目的: ユーザーにサービスを紹介し、見積もり依頼（Get a Quote）を促進する

## 対象ユーザー
- 企業やブランドのマーケティング担当者、コンテンツ制作者

## セクション構成
1. **ヒーローセクション**
   - 背景画像: `background.png`
   - キャッチコピー: `Elevate Your Story with Captivating Visuals`
   - サブテキスト: `We craft compelling video content that resonates with your audience and drives results.`
   - ボタン: `Get a Quote`

2. **サービス紹介 (Our Services)**
   - タイトル: `Our Services`
   - 説明: `From concept to delivery, we offer a comprehensive suite of video production services to meet your needs.`
   - カード:
     - Video Production: `High-quality video production for commercials, corporate videos, and more.`
     - Video Editing: `Professional video editing to enhance your footage and create a polished final product.`
     - Video Marketing: `Strategic video marketing to reach your target audience and maximize impact.`

3. **実績紹介 (Featured Work)**
   - タイトル: `Featured Work`
   - 事例カード (Project 1～3):
     - Project 1: `A short film showcasing the beauty of nature.`
     - Project 2: `A promotional video for a new product launch.`
     - Project 3: `A documentary exploring the impact of climate change.`

4. **クライアントの声 (Client Testimonials)**
   - タイトル: `Client Testimonials`
   - テストimonials:
     - Sophia Carter (2 months ago): `"We were impressed with the quality of the video and the seamless production process. Highly recommended!"`
     - Olivia Hayes (4 months ago): `"Visual Storytellers helped us create a video that truly captured our brand's essence. We're thrilled with the results."`

5. **お問い合わせセクション (Call to Action)**
   - キャッチコピー: `Ready to Bring Your Vision to Life?`
   - サブテキスト: `Contact us today to discuss your project and receive a personalized quote.`
   - ボタン: `Get a Quote`

## デザイン・スタイル
- テクノロジー: HTML + Tailwind CSS (CDN 経由で `forms`, `container-queries` プラグインを利用)
- フォント: Google Fonts (Noto Sans, Spline Sans)
- カラー:
  - 背景: `#24200f`
  - アクセント (ボタン、スターアイコン): `#ffd500`
  - セカンダリテキスト: `#cec38d`
- レイアウト: モバイルファースト + コンテナクエリ（`@container`, `@[480px]` でブレークポイント適用）

## アセット
- ローカル画像: ヒーロー背景 (上記ファイル名)
- 外部画像: サービス・実績・テストimonial の背景やアバターに外部ホスティング画像を利用

## ファイル構成
```
/ 
├ index.html
├ background.png
├ README.md
└ docs/
   └ SPECIFICATION.md
```

## 動作対象
- モダンブラウザ (Chrome, Safari, Firefox 等)
- JavaScript 実行不要 (CSS ベースのスタイルのみ)

## 今後の拡張案
- お問い合わせフォームの追加
- 多言語対応 (i18n)
- アニメーションやインタラクション強化