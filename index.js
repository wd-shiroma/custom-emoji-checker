'use strict'

let request = require('request');
let sqlite = require('./module/db.js');
let conf = require('config');

// DB定義
let db = sqlite.init('./db/custom_emoji.db');

db.serialize(function () {
    let create = new Promise(function (resolve, reject) {
        db.get(
            'select count(*) from sqlite_master where type="table" and name=$name',
            { $name: 'custom_emoji' },
            function (err, res) {
                let exists = false;
                if (0 < res['count(*)']) { exists = true; }

                resolve(exists);
            }
        );
    });

    create.then(function (exists) {
        if (!exists) {
            db.run('create table custom_emoji (shortcode text primary key, static_url text, url text)');
        }
    });
});

if (process.argv[2] === 'shortcode') {
    db.serialize(function () {
        db.all(
            'select * from custom_emoji',
            [],
            function (err, rows) {
            if (err) throw err;
            rows.forEach(function (row) {
                console.log(row.shortcode);
            });
        });
    });
    return;
}

let headers = {
    'Content-Type': 'application/json',
    authorization: 'bearer ' + conf.config.access_token
}
let get_options = {
    url: 'https://' + conf.config.instance + '/api/v1/custom_emojis',
    method: 'GET',
    headers: headers,
    json: true
}
let post_options = {
    url: 'https://' + conf.config.instance + '/api/v1/statuses',
    method: 'POST',
    headers: headers,
}

let now = new Date();
console.log('[ ' + now.toString() + ']');

request(get_options, function (error, response, body) {
    let search = [];
    let new_emojis = [];
    for (let i = 0; i < body.length; i++) {
        search.push(select_custom_emoji(body[i].shortcode));
    }
    console.log
    Promise.all(search)
    .then(function(rows) {
        for (let i = 0; i < rows.length; i++) {
            if (rows[i] === false) {
                insert_custom_emoji(body[i]);
                new_emojis.push(body[i].shortcode);
            }
        }

        let count = {
            all: body.length,
            registed: (body.length - new_emojis.length)
        };
        console.log("取得カスタム絵文字数" + ':' + count.all);
        console.log('登録済み絵文字数：' + count.registed);

        if (new_emojis.length === 0) {
            console.log('新しい絵文字ないよ。。。。');
            return;
        }

        console.log('新しい絵文字来てるよ！');
        console.log(new_emojis);

        let codes = [];
        let toots = [];
        let t = '';
        for (let j = 0; j < new_emojis.length; j++) {
            if (t.length + new_emojis[j].length + 3 >= 500) {
                toots.push(t);
                codes = [new_emojis[j]];
            }
            else {
                codes.push(new_emojis[j]);
            }
            t = ((toots.length > 0)
                    ? ('続き、' + (toots.length + 1) + 'つ目')
                    : ('新しい絵文字が追加されてる！ (' + count.registed + '→' + count.all + ')'))
                + "\n:" + codes.join(': :') + ":\n#new_emojis";
        }
        toots.push(t);
        for (let j = 0; j < toots.length; j++) {
            post_options.json = {
                visibility: conf.config.visibility,
                status: toots[j]
            };
            request(post_options, function() {
                console.log('done');
            });
        }
    });
});

function select_custom_emoji(shortcode) {
    return new Promise(function (resolve, reject) {
        db.serialize(function () {
            db.get('select * from custom_emoji where shortcode = $code',
                { $code: shortcode },
                function (err, res) {
                    if (err) {
                        return resolve(false);
                    }
                    else if (res) {
                        return resolve(res);
                    }
                    else {
                        return resolve(false);
                    }
                }
            );
        });
    });
}

function insert_custom_emoji(dataset) {
    db.serialize(function () {
        db.run(
            'insert or ignore into custom_emoji (shortcode, static_url, url) values ($a, $b, $c)',
            {
                $a: dataset.shortcode,
                $b: dataset.static_url,
                $c: dataset.url
            }
        );
    });
}