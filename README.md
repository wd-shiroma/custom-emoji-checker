# Mastodon custom emoji checker

マストドン2.0.0から対応したカスタム絵文字をチェックするだけのbotです。

気分が向いたら機能追加するかもしれないし、向かなかったらこのままのやつ。

## Install

- 決まり事

```npm install```

- 設定変更

```vim ./config/default.yaml```

instanceとaccess_tokenを修正すればとりあえず動きます。

- 実行

```node index.js```

※初回は対象インスタンスからデータを取ってきてDBに入れるだけです。

※2回目以降の実行で増分のカスタム絵文字があったら通知します。

## Reset

DBファイル消すだけ

```rm db/custom_emoji.db```

## show database

簡易的にDBの情報を表示できます。

- 一覧表示

```node index.js list```

- 詳細表示

```node index.js shortcode <shortcode>```

