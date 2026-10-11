# KACHIO ARCHIVE

GitHub Pages用の創作作品資料集。特別なインストールやビルドは不要です。
トップ、作品一覧、作品詳細、人物図鑑、人物詳細、世界観、作者紹介を収録しています。
「██記録室」は含めていません。

## 最初に確認する

解凍したフォルダーの `index.html` をダブルクリックすると、手元でサイトを確認できます。
公開プロフィールから確認した25作品、38件の人物プロフィール、10件の舞台・組織資料を収録しています。
zeta 24件、Chacha 8件、Plaitoon 2件の作品URLを、同じ作品ごとにまとめています。
実際の掲載表紙と人物画像を同梱し、紹介文は投稿元の公開紹介をもとに短くまとめました。
「貴女だけの神様。」の名称は投稿先を問わず統一しています。
蓑島真之の原作版と日常版は、設定が混ざらないよう別の人物資料として扱います。
`plot-urls.txt` に全34件の投稿先URLを収録しています。確認日は2026年10月11日です。
掲載内容と作者紹介を見直し、画面を確認してから公開してください。

## GitHubへ入れる

https://github.com/ochikatakachio/kachio-archive を開きます。
「Add file」→「Upload files」を選びます。
解凍したフォルダーの**中身**をアップロード欄へドラッグします。
フォルダーを一段上から入れず、リポジトリを開いた直下に `index.html` が置かれるようにしてください。
`assets` と `images` のフォルダーもまとめて入れます。ZIPファイルのままアップロードしてもサイトにはなりません。
「Commit changes」で保存します。既存のREADME.mdがある場合は、この説明ファイルに置き換えて構いません。
`.nojekyll` は同梱していますが、隠しファイルが見えずアップロードしなくても、この構成では基本的に表示できます。

## 公開設定

リポジトリの「Settings」→「Pages」を開きます。
「Build and deployment」の「Source」で「Deploy from a branch」を選びます。
「Branch」は `main`、フォルダーは `/(root)` を選び、「Save」を押します。
公開後はPages画面の「Visit site」で確認します。反映には数分、最大10分程度かかることがあります。
公開先は通常 https://ochikatakachio.github.io/kachio-archive/ です。
このファイルを作った時点では、GitHubへのアップロードと公開設定は行っていません。

公式手順: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
公開元設定: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## 作品の文章と表紙を変える

`assets/content.js` が作品と人物の公開用データです。
タイトルは `title`、短い紹介は `summary`、紹介文は `description`、本文は `story` に入れます。
表紙画像を `images` に入れて、その作品の `cover` を `images/my-cover.jpg` などに変更してください。
ファイル名は半角英数字・ハイフン・アンダーバーにすると扱いやすくなります。
人物画像はキャラクターに `image: 'images/character-name.png'` を追加します。
作品テーマは `color` の6桁の色番号で変更できます。トップの注目作品は `featured: true` で指定します。
表示しない作品には `visible: false` を入れます。これは表示設定だけであり、非公開保管ではありません。

## 投稿先を登録する

作品ごとの `destinations: []` に次のような項目を入れます。
URLは**実際の作品ページ**に差し替え、掲載済みのものだけ `published` にしてください。

```js
destinations: [
  { name: 'zeta', url: '実際の作品ページのhttps URL', status: 'published' },
  { name: 'Chacha', url: '実際の作品ページのhttps URL', status: 'published' },
  { name: 'Plaitoon', url: '', status: 'draft' }
]
```

`published` かつ有効なhttp/https URLがある投稿先だけ、作品カードの表示、検索、作品詳細のリンクに反映します。
準備中の投稿先は読者に表示しません。ただし、このファイルに入れた情報自体は誰でも取得できます。
独自の投稿先名も登録できます。特定のサービスに固定していません。
投稿先によって作品名が違うときは、`title` にその掲載名を入れます。想一のPlaitoon掲載名は「輿石 想一」と表示します。

## ギャラリーと設定資料

作品の `gallery` に `{ src: 'images/illustration.png', caption: '別衣装' }` を追加します。
画像は選ぶと拡大できます。作品や人物の `sections` に `{ title: '見出し', text: '本文' }` を追加すると資料が増えます。
`spoiler: true` を付けた資料は、注意付きの折りたたみ表示になります。ネタバレの注意表示は秘密を保護する機能ではありません。
名前、年齢など不明な項目は入れていません。確認した設定を追記してください。
表紙と人物画像は `images` 内に保存済みです。掲載画像は元のファイル形式を保ち、外部サイトへ画像を取りに行く必要はありません。

## サイトの表示

公開用の表示に整えてあり、`site.preview` は `false` です。確認用の帯を出す場合は `true` にしてください。
作者紹介文は `assets/app.js` の `about()` の中にあります。サイト名は `content.js` の `site.name` で変更できます。

## 管理画面について

今回は公開サイトの第一版です。ログイン、非公開保管、画面からの作品編集や保存はまだ実装していません。
非公開のプロット、AI向けの指示、パスワード、秘密の鍵は**このフォルダーにも公開リポジトリにも入れないでください**。
`visible: false` や `visibility: 'private'` で画面から隠しても、ファイル内の情報は取得できます。
管理画面を追加するときは、認証とアクセス制限のある保存先を別に接続します。

## ファイル構成

| ファイル | 役割 |
| --- | --- |
| index.html | トップページ |
| works.html | 作品一覧・検索 |
| work.html | 作品詳細。例: work.html?id=souichi |
| characters.html | 人物図鑑 |
| character.html | 人物詳細 |
| worlds.html | 世界観一覧・詳細 |
| about.html | 作者・サイト紹介 |
| 404.html | 見つからないURL用の入口 |
| assets/style.css | デザイン・スマートフォン対応 |
| assets/content.js | 公開用の作品・人物・世界観データ |
| assets/app.js | ページ表示・検索・画像拡大 |
| assets/logo.svg | サイトロゴ |
| images/ | 掲載表紙・人物画像 |
| plot-urls.txt | 全34件の投稿先URL |

すべて相対パスを使用しており、`/kachio-archive/` 配下で動作します。
外部の画像、字体、JavaScriptライブラリーへの依存はありません。

## この版の確認

全作品・人物・世界観ページの表示処理、作品名と読み仮名の検索、投稿先別の絞り込み、画像の実在と形式、内部参照、名称統一を自動確認しています。実ブラウザーでの見た目の最終確認は未実施です。`index.html` を開き、パソコンとスマートフォンの表示を確認してください。

トップの表紙、作品詳細、ギャラリーは、横幅に合わせて高さが決まるよう修正しています。上下の余白が極端に広くなる高さ固定を解除しました。

人物画像38件とChacha掲載表紙8件を、同じ絵の大きい掲載画像に差し替えました。六車は128×192から1024×1536ピクセル、優叶は96×160から640×1067ピクセルになっています。
