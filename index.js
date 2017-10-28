'use strict'

let request = require('request');
let sqlite = require('./module/db.js');
let conf = require('config');

// DB定義
let db = sqlite.init('./db/custom_emoji.db');

let is_init = false;
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
            db.run('create table custom_emoji (shortcode text primary key, static_url text, url text, created_at integer)');
            is_init = true;
        }
    });
});

if (process.argv[2] === 'list') {
    db.serialize(function () {
        db.all(
            'select * from custom_emoji',
            [],
            function (err, rows) {
            if (err) throw err;
            rows.forEach(function (row) {
                let created_at = new Date(row.created_at)
                console.log(created_at.toISOString() + ': ' + row.shortcode);
            });
        });
    });
    return;
}
else if (process.argv[2] === 'shortcode') {
    if (!process.argv[3]) {
        console.log('Invalid shortcode');
        return;
    }
    db.serialize(function () {
        db.all(
            'select * from custom_emoji where shortcode = $a',
            { $a: process.argv[3] },
            function (err, rows) {
            if (err) throw err;
            if (rows.length === 0) {
                console.log('No shortcode');
            }
            else {
                let created_at = new Date(rows[0].created_at);
                console.log('>> ' + rows[0].shortcode);
                console.log('created_at: ' + created_at.toISOString());
                console.log('static_url: ' + rows[0].static_url);
                console.log('url: ' + rows[0].url);
            }
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
    let now = Date.now();
    for (let i = 0; i < body.length; i++) {
        search.push(select_custom_emoji(body[i].shortcode));
    }
    console.log
    Promise.all(search)
    .then(function(rows) {
        for (let i = 0; i < rows.length; i++) {
            if (rows[i] === false) {
                insert_custom_emoji(body[i], now);
                new_emojis.push(body[i].shortcode);
            }
        }

        let count = {
            all: body.length,
            registed: (body.length - new_emojis.length)
        };
        console.log(conf.message.log.count_all + ': ' + count.all);
        console.log(conf.message.log.count_registed + ': ' + count.registed);

        if (is_init) {
            console.log(conf.message.log.init);
            return;
        }
        else if (new_emojis.length === 0) {
            console.log(conf.message.log.not_found);
            return;
        }

        console.log(conf.message.log.found);
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
                    ? (conf.message.toot.head_next_before + (toots.length + 1) + conf.message.toot.head_next_after)
                    : (conf.message.toot.head_new + ' (' + count.registed + '→' + count.all + ')'))
                + "\n:" + codes.join(': :') + ":\n#" + conf.message.toot.hashtag;
        }
        toots.push(t);
        for (let j = 0; j < toots.length; j++) {
            post_options.json = {
                visibility: conf.config.visibility,
                status: toots[j]
            };
            setTimeout(function(opt_str) {
                let options = JSON.parse(opt_str);
                request(options, function() {
                    console.log('done');
                });
            }, j * 1000, JSON.stringify(post_options));
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

function insert_custom_emoji(dataset, created = 0) {
    if (created === 0) {
        created = Date.now();
    }
    db.serialize(function () {
        db.run(
            'insert or ignore into custom_emoji (shortcode, static_url, url, created_at) values ($a, $b, $c, $d)',
            {
                $a: dataset.shortcode,
                $b: dataset.static_url,
                $c: dataset.url,
                $d: created
            }
        );
    });
}