// 3つのグループと対象ワード
        const WORD_GROUPS = {
            A: { name: "愛情・受容", words: ['愛してます', 'ゆるします', 'ありがとう'] },
            B: { name: "喜び・快活", words: ['うれしい', '楽しい'] }, 
            C: { name: "感謝・幸運", words: ['感謝してます', 'しあわせ', 'ツイてる'] }
        };

        // 音声認識のゆらぎ吸収用（漢字変換や送り仮名の違いをカバー）
        const WORD_ALIASES = {
            '愛してます': ['愛しています', 'あいしています', 'あいしてます', '愛します', 'アイシテマス'],
            'ゆるします': ['許します', '赦します', 'ユルシマス'],
            'ありがとう': ['有難う', '有り難う', '有難うございます', 'ありがとうございます', 'ありがと', 'アリガトウ'],
            'うれしい': ['嬉しい', 'ウレシイ'],
            '楽しい': ['たのしい', '楽し', 'タノシイ'],
            '感謝してます': ['感謝しています', '感謝', 'かんしゃしてます'],
            'しあわせ': ['幸せ', '仕合わせ', 'シアワセ', '幸せです'],
            'ツイてる': ['ついてる', '付いてる', '就いてる', '憑いてる', 'ツキがある', 'ツイテル', 'ついている'],
            
            // 魂のおやつ（長い言霊）のゆらぎ吸収
            'このことがダイヤモンドにかわります': [
                'この事がダイヤモンドに変わります', 
                'このことがダイヤモンドに変わります', 
                'この事がダイヤモンドにかわります',
                'この事がダイアモンドに変わります',
                'このことがダイアモンドに変わります',
                'この事がダイアモンドにかわります',
                'このことがダイアモンドにかわります'
            ],
            'だんだんよくなる未来はあかるい': [
                'だんだん良くなる未来は明るい', 
                '段々良くなる未来は明るい', 
                'だんだんよくなる未来は明るい',
                '段々よくなる未来は明るい'
            ],
            '宇宙の調和に感謝します': [
                '宇宙の調和に感謝しています',
                '宇宙の調和に感謝',
                '宇宙の平和に感謝します'
            ],
            '自分はすごいんだ': ['自分は凄いんだ', 'じぶんはすごいんだ', '自分はすごい'],
            'もっと自分を愛しますもっと自分をゆるします': [
                'もっと自分を愛しますもっと自分を許します', 
                'もっと自分を愛しますもっと自分を赦します'
            ],
            'どうでもいいどっちでもいいどうせうまくいくから': [
                'どうでもいいどっちでもいいどうせ上手くいくから', 
                'どうでもいいどっちでもいいどうせ上手く行くから'
            ]
        };

        const OYATSU_WORDS = [
            'このことがダイヤモンドにかわります',
            'だんだんよくなる未来はあかるい',
            '宇宙の調和に感謝します',
            '自分はすごいんだ',
            'もっと自分を愛しますもっと自分をゆるします',
            'どうでもいいどっちでもいいどうせうまくいくから'
        ];

        const allWords = [...WORD_GROUPS.A.words, ...WORD_GROUPS.B.words, ...WORD_GROUPS.C.words, ...OYATSU_WORDS];

        let wordCounts = {};
        allWords.forEach(w => wordCounts[w] = 0);
        let totalCount = 0;
        let intokuPower = 0;
        let battleWins = 0;
        let battleLosses = 0;

        // --- 24x24 拡張ピクセルアート定義 (0:空白, 1:描画) ---
        // 配列の配列で定義します（各行24文字）
        const PIXEL_ARTS = {
            // 初期：タマゴ
            egg: { 
                type: 'image', src: 'タマゴ.jpg', frames: 3, speed: 1000, 
                sqSize: 500,
                customFrames: [
                    { sx: 18, sy: 26, sWidth: 500, sHeight: 500 },
                    { sx: 550, sy: 114, sWidth: 500, sHeight: 500 },
                    { sx: 1087, sy: 26, sWidth: 500, sHeight: 500 }
                ]
            },
            // Aルート（愛情・許し）：多邇具久っち（たにぐく）- 高解像度スプライトシート版
            childA: { type: 'image', src: '多邇具久.jpg', frames: 3, speed: 800, trim: 0.05, trimY: 0.01 },
            // Aルート：多邇具久っち（病気状態）
            childA_sick: { type: 'image', src: '多邇具久（病気）.jpg', frames: 3, speed: 1000, trim: 0.05, trimY: 0.01 },
            // Bルート（喜び・快活）：狛犬っち（こまいぬ）- 高解像度スプライトシート版
            childB: { type: 'image', src: '狛犬っち.jpg', frames: 3, speed: 800, trim: 0.02 },
            // Bルート：狛犬っち（病気状態）
            childB_sick: { type: 'image', src: '狛犬っち（病気）.jpg', frames: 3, speed: 1000, trim: 0.02 },
            // Cルート（感謝・幸運）：小槌っち（こづち）- 高解像度スプライトシート版
            childC: { type: 'image', src: '小槌っち.jpg', frames: 3, speed: 800, trim: 0.05, trimY: 0.05 },
            // Cルート：小槌っち（病気状態）
            childC_sick: { type: 'image', src: '小槌っち（病気）.jpg', frames: 3, speed: 1000, trim: 0.05, trimY: 0.05 },
            // A-1：白蛇っち（しろへび）- 高解像度スプライトシート版
            childA_1: { type: 'image', src: '白蛇っち.jpg', frames: 3, speed: 800, trim: 0.02 },
            // A-1：白蛇っち（病気状態）
            childA_1_sick: { type: 'image', src: '白蛇っち（病気）.jpg', frames: 3, speed: 1000, trim: 0.02 },
            // A-2：蓮華っち（れんげ）- 高解像度スプライトシート版
            childA_2: { type: 'image', src: '蓮華っち.jpg', frames: 3, speed: 800, trim: 0.02 },
            // A-2：蓮華っち（病気状態）
            childA_2_sick: { type: 'image', src: '蓮華っち（病気）.jpg', frames: 3, speed: 1000, trim: 0.02 },
            // B-1：迦楼羅っち（かるら）- 高解像度スプライトシート版
            childB_1: { 
                type: 'image', src: '迦楼羅っち.jpg', frames: 3, speed: 800, 
                sqSize: 500,
                customFrames: [
                    { sx: 17, sy: 14, sWidth: 500, sHeight: 500 },
                    { sx: 550, sy: 14, sWidth: 500, sHeight: 500 },
                    { sx: 1083, sy: 14, sWidth: 500, sHeight: 500 }
                ]
            },
            // B-1：迦楼羅っち（病気状態）
            childB_1_sick: { 
                type: 'image', src: '迦楼羅っち（病気）.jpg', frames: 3, speed: 1000, 
                sqSize: 500,
                customFrames: [
                    { sx: 17, sy: 14, sWidth: 500, sHeight: 500 },
                    { sx: 550, sy: 14, sWidth: 500, sHeight: 500 },
                    { sx: 1083, sy: 14, sWidth: 500, sHeight: 500 }
                ]
            },
            // B-2：鳳凰っち（ほうおう）- 高解像度スプライトシート版
            childB_2: { type: 'image', src: '鳳凰っち.jpg', frames: 3, speed: 800, trim: 0.02 },
            // B-2：鳳凰っち（病気状態）
            childB_2_sick: { type: 'image', src: '鳳凰っち（病気）.jpg', frames: 3, speed: 1000, trim: 0.02 },
            // C-1：招き猫っち（まねきねこ）- 高解像度スプライトシート版
            childC_1: { type: 'image', src: '招き猫っち.jpg', frames: 3, speed: 800, trim: 0.02 },
            // C-1：招き猫っち（病気状態）
            childC_1_sick: { type: 'image', src: '招き猫っち（病気）.jpg', frames: 3, speed: 1000, trim: 0.02 },
            // C-2：宝船っち（たからぶね）- 高解像度スプライトシート版
            childC_2: { type: 'image', src: '宝船っち.jpg', frames: 3, speed: 800, trim: 0.02 },
            // C-2：宝船っち（病気状態）
            childC_2_sick: { type: 'image', src: '宝船っち（病気）.jpg', frames: 3, speed: 1000, trim: 0.02 }
        };

        // 第4段階（10000回）のキャラクターを追加
        Object.assign(PIXEL_ARTS, {
            // A-1-1：天照大御神っち - 高解像度スプライトシート版
            childA_1_1: { type: 'image', src: '天照大御神っち.jpg', frames: 3, speed: 800, trim: 0.05, trimY: 0.05 },
            // A-1-1：天照大御神っち（病気状態）
            childA_1_1_sick: { type: 'image', src: '天照大御神っち（病気）.jpg', frames: 3, speed: 1000, trim: 0.05, trimY: 0.05 },
            // A-1-2：玄武っち - 高解像度スプライトシート版
            childA_1_2: { 
                type: 'image', src: '玄武っち.jpg', frames: 3, speed: 800, 
                sqSize: 520,
                customFrames: [
                    { sx: 8, sy: 6, sWidth: 520, sHeight: 516 },
                    { sx: 541, sy: 6, sWidth: 520, sHeight: 516 },
                    { sx: 1070, sy: 6, sWidth: 520, sHeight: 516 }
                ]
            },
            // A-1-2：玄武っち（病気状態）
            childA_1_2_sick: { 
                type: 'image', src: '玄武っち（病気）.jpg', frames: 3, speed: 1000, 
                sqSize: 516,
                customFrames: [
                    { sx: 8, sy: 4, sWidth: 516, sHeight: 522 },
                    { sx: 543, sy: 4, sWidth: 516, sHeight: 522 },
                    { sx: 1070, sy: 4, sWidth: 516, sHeight: 522 }
                ]
            },
            // A-1-3：福禄寿っち - 高解像度スプライトシート版
            childA_1_3: { 
                type: 'image', src: '福禄寿っち.jpg', frames: 3, speed: 800, 
                sqSize: 525,
                customFrames: [
                    { sx: 42, sy: 0, sWidth: 450, sHeight: 525 },
                    { sx: 579, sy: 0, sWidth: 450, sHeight: 525 },
                    { sx: 1102, sy: 0, sWidth: 450, sHeight: 525 }
                ]
            },
            // A-1-3：福禄寿っち（病気状態）
            childA_1_3_sick: { 
                type: 'image', src: '福禄寿っち（病気）.jpg', frames: 3, speed: 1000, 
                sqSize: 525,
                customFrames: [
                    { sx: 43, sy: 0, sWidth: 450, sHeight: 525 },
                    { sx: 599, sy: 0, sWidth: 450, sHeight: 525 },
                    { sx: 1102, sy: 0, sWidth: 450, sHeight: 525 }
                ]
            },
            // A-1-4：阿弥陀如来っち - 高解像度スプライトシート版
            childA_1_4: { 
                type: 'image', src: '阿弥陀如来っち.jpg', frames: 3, speed: 800, 
                sqSize: 529,
                customFrames: [
                    { sx: 2, sy: 0, sWidth: 529, sHeight: 529 },
                    { sx: 535, sy: 0, sWidth: 529, sHeight: 529 },
                    { sx: 1069, sy: 0, sWidth: 529, sHeight: 529 }
                ]
            },
            // A-1-4：阿弥陀如来っち（病気状態）
            childA_1_4_sick: { 
                type: 'image', src: '阿弥陀如来っち（病気）.jpg', frames: 3, speed: 1000, 
                sqSize: 529,
                customFrames: [
                    { sx: 2, sy: 0, sWidth: 529, sHeight: 529 },
                    { sx: 535, sy: 0, sWidth: 529, sHeight: 529 },
                    { sx: 1069, sy: 0, sWidth: 529, sHeight: 529 }
                ]
            },
            // A-2-1：千手観音っち - 高解像度スプライトシート版
            childA_2_1: { type: 'image', src: '千手観音っち.jpg', frames: 3, speed: 800, trim: 0.05, trimY: 0.05 },
            // A-2-1：千手観音っち（病気状態）
            childA_2_1_sick: { type: 'image', src: '千手観音っち（病気）.jpg', frames: 3, speed: 1000, trim: 0.05, trimY: 0.05 },
            // A-2-2：白虎っち - 高解像度スプライトシート版
            // 原因判明：通常と病気で座標が全く異なるため、それぞれ専用の座標を指定
            childA_2_2: { 
                type: 'image', src: '白虎っち.jpg', frames: 3, speed: 800, 
                sqSize: 560,
                customFrames: [{ sx: 50, sWidth: 410 }, { sx: 505, sWidth: 560 }, { sx: 1065, sWidth: 500 }] 
            },
            // A-2-2：白虎っち（病気状態）
            childA_2_2_sick: { 
                type: 'image', src: '白虎っち（病気）.jpg', frames: 3, speed: 1000,
                sqSize: 510,
                customFrames: [{ sx: 60, sWidth: 430 }, { sx: 515, sWidth: 510 }, { sx: 1065, sWidth: 500 }] 
            },
            // A-2-3：瀬織津姫っち
            childA_2_3: { 
                type: 'image', src: '瀬織津姫っち.jpg', frames: 3, speed: 800, 
                sqSize: 512,
                customFrames: [
                    { sx: 11, sy: 8, sWidth: 512, sHeight: 512 }, 
                    { sx: 544, sy: 8, sWidth: 512, sHeight: 512 }, 
                    { sx: 1076, sy: 8, sWidth: 512, sHeight: 512 }
                ] 
            },
            // A-2-3：瀬織津姫っち（病気状態）
            childA_2_3_sick: { 
                type: 'image', src: '瀬織津姫っち（病気）.jpg', frames: 3, speed: 1000, 
                sqSize: 512,
                customFrames: [
                    { sx: 11, sy: 8, sWidth: 512, sHeight: 512 }, 
                    { sx: 544, sy: 8, sWidth: 512, sHeight: 512 }, 
                    { sx: 1076, sy: 8, sWidth: 512, sHeight: 512 }
                ] 
            },
            // A-2-4：十一面観音っち - 高解像度スプライトシート版
            childA_2_4: { 
                type: 'image', src: '十一面観音っち.jpg', frames: 3, speed: 800, 
                sqSize: 529,
                customFrames: [
                    { sx: 2, sy: 0, sWidth: 529, sHeight: 529 },
                    { sx: 535, sy: 0, sWidth: 529, sHeight: 529 },
                    { sx: 1069, sy: 0, sWidth: 529, sHeight: 529 }
                ]
            },
            // A-2-4：十一面観音っち（病気状態）
            childA_2_4_sick: { 
                type: 'image', src: '十一面観音っち（病気）.jpg', frames: 3, speed: 1000, 
                sqSize: 529,
                customFrames: [
                    { sx: 2, sy: 0, sWidth: 529, sHeight: 529 },
                    { sx: 535, sy: 0, sWidth: 529, sHeight: 529 },
                    { sx: 1069, sy: 0, sWidth: 529, sHeight: 529 }
                ]
            },
            // B-1-1：青龍っち
            childB_1_1: { 
                type: 'image', src: '青龍っち.jpg', frames: 3, speed: 800, 
                sqSize: 500,
                customFrames: [
                    { sx: 8, sy: 10, sWidth: 500, sHeight: 500 },
                    { sx: 552, sy: 18, sWidth: 500, sHeight: 500 },
                    { sx: 1085, sy: 14, sWidth: 500, sHeight: 500 }
                ]
            },
            // B-1-1：青龍っち（病気状態）
            childB_1_1_sick: { 
                type: 'image', src: '青龍っち（病気）.jpg', frames: 3, speed: 1000, 
                sqSize: 500,
                customFrames: [
                    { sx: 20, sy: 12, sWidth: 500, sHeight: 500 },
                    { sx: 552, sy: 18, sWidth: 500, sHeight: 500 },
                    { sx: 1083, sy: 16, sWidth: 500, sHeight: 500 }
                ]
            },
            // B-1-4：弥勒菩薩っち - 高解像度スプライトシート版
            childB_1_4: { 
                type: 'image', src: '弥勒菩薩っち.jpg', frames: 3, speed: 800, 
                sqSize: 529,
                customFrames: [
                    { sx: 2, sy: 0, sWidth: 529, sHeight: 529 },
                    { sx: 535, sy: 0, sWidth: 529, sHeight: 529 },
                    { sx: 1069, sy: 0, sWidth: 529, sHeight: 529 }
                ]
            },
            // B-1-4：弥勒菩薩っち（病気状態）
            childB_1_4_sick: { 
                type: 'image', src: '弥勒菩薩っち（病気）.jpg', frames: 3, speed: 1000, 
                sqSize: 529,
                customFrames: [
                    { sx: 2, sy: 0, sWidth: 529, sHeight: 529 },
                    { sx: 535, sy: 0, sWidth: 529, sHeight: 529 },
                    { sx: 1069, sy: 0, sWidth: 529, sHeight: 529 }
                ]
            },
            // B-1-2：不動明王っち
            childB_1_2: { 
                type: 'image', src: '不動明王っち.jpg', frames: 3, speed: 800, 
                sqSize: 500,
                customFrames: [
                    { sx: 17, sy: 14, sWidth: 500, sHeight: 500 },
                    { sx: 550, sy: 14, sWidth: 500, sHeight: 500 },
                    { sx: 1083, sy: 14, sWidth: 500, sHeight: 500 }
                ]
            },
            // B-1-2：不動明王っち（病気状態）
            childB_1_2_sick: { 
                type: 'image', src: '不動明王っち（病気）.jpg', frames: 3, speed: 1000, 
                sqSize: 500,
                customFrames: [
                    { sx: 17, sy: 14, sWidth: 500, sHeight: 500 },
                    { sx: 550, sy: 14, sWidth: 500, sHeight: 500 },
                    { sx: 1083, sy: 14, sWidth: 500, sHeight: 500 }
                ]
            },
            // B-1-3：寿老人っち - 高解像度スプライトシート版
            childB_1_3: { 
                type: 'image', src: '寿老人っち.jpg', frames: 3, speed: 800, 
                sqSize: 341,
                customFrames: [
                    { sx: 0, sy: 0, sWidth: 341, sHeight: 339 },
                    { sx: 341, sy: 0, sWidth: 341, sHeight: 339 },
                    { sx: 683, sy: 0, sWidth: 341, sHeight: 339 }
                ]
            },
            // B-1-3：寿老人っち（病気状態）
            childB_1_3_sick: { 
                type: 'image', src: '寿老人っち（病気）.jpg', frames: 3, speed: 1000, 
                sqSize: 529,
                customFrames: [
                    { sx: 2, sy: 0, sWidth: 529, sHeight: 529 },
                    { sx: 535, sy: 0, sWidth: 529, sHeight: 529 },
                    { sx: 1069, sy: 0, sWidth: 529, sHeight: 529 }
                ]
            },
            // B-2-1：朱雀っち
            childB_2_1: { 
                type: 'image', src: '朱雀っち.jpg', frames: 3, speed: 800, 
                sqSize: 518,
                customFrames: [
                    { sx: 15, sy: 15, sWidth: 514, sHeight: 514 },
                    { sx: 533, sy: 7, sWidth: 518, sHeight: 518 },
                    { sx: 1079, sy: 15, sWidth: 514, sHeight: 514 }
                ]
            },
            // B-2-1：朱雀っち（病気状態）
            childB_2_1_sick: { 
                type: 'image', src: '朱雀っち（病気）.jpg', frames: 3, speed: 1000, 
                sqSize: 516,
                customFrames: [
                    { sx: 14, sy: 13, sWidth: 516, sHeight: 516 },
                    { sx: 534, sy: 13, sWidth: 516, sHeight: 516 },
                    { sx: 1154, sy: 179, sWidth: 350, sHeight: 350 }
                ]
            },
            // B-2-2：大日如来っち
            childB_2_2: { 
                type: 'image', src: '大日如来っち.jpg', frames: 3, speed: 800, 
                sqSize: 500,
                customFrames: [
                    { sx: 17, sy: 14, sWidth: 500, sHeight: 500 },
                    { sx: 550, sy: 14, sWidth: 500, sHeight: 500 },
                    { sx: 1083, sy: 14, sWidth: 500, sHeight: 500 }
                ]
            },
            // B-2-2：大日如来っち（病気状態）
            childB_2_2_sick: { 
                type: 'image', src: '大日如来っち（病気）.jpg', frames: 3, speed: 1000, 
                sqSize: 500,
                customFrames: [
                    { sx: 20, sy: 14, sWidth: 500, sHeight: 500 },
                    { sx: 557, sy: 14, sWidth: 500, sHeight: 500 },
                    { sx: 1082, sy: 14, sWidth: 500, sHeight: 500 }
                ]
            },
            // B-2-3：須佐之男命っち
            childB_2_3: { 
                type: 'image', src: '須佐之男命っち.jpg', frames: 3, speed: 800, 
                sqSize: 518,
                customFrames: [
                    { sx: 7, sy: 5, sWidth: 518, sHeight: 518 },
                    { sx: 541, sy: 5, sWidth: 518, sHeight: 518 },
                    { sx: 1074, sy: 5, sWidth: 518, sHeight: 518 }
                ]
            },
            // B-2-3：須佐之男命っち（病気状態）
            childB_2_3_sick: { 
                type: 'image', src: '須佐之男命っち（病気）.jpg', frames: 3, speed: 1000, 
                sqSize: 510,
                customFrames: [
                    { sx: 8, sy: 3, sWidth: 510, sHeight: 510 },
                    { sx: 545, sy: 3, sWidth: 510, sHeight: 510 },
                    { sx: 1071, sy: 3, sWidth: 510, sHeight: 510 }
                ]
            },
            // B-2-4：武甕槌大神っち - 高解像度スプライトシート版 (1600x529)
            childB_2_4: { 
                type: 'image', src: '武甕槌大神っち.jpg', frames: 3, speed: 800, 
                sqSize: 533,
                customFrames: [
                    { sx: 18, sy: 8, sWidth: 500, sHeight: 510 },
                    { sx: 551, sy: 8, sWidth: 500, sHeight: 510 },
                    { sx: 1084, sy: 8, sWidth: 500, sHeight: 510 }
                ]
            },
            // B-2-4：武甕槌大神っち（病気状態） (1024x339)
            childB_2_4_sick: { 
                type: 'image', src: '武甕槌大神っち（病気）.jpg', frames: 3, speed: 1000, 
                sqSize: 341,
                customFrames: [
                    { sx: 8, sy: 2, sWidth: 320, sHeight: 320 },
                    { sx: 349, sy: 2, sWidth: 320, sHeight: 320 },
                    { sx: 690, sy: 2, sWidth: 320, sHeight: 320 }
                ]
            },
            // C-1-4：経津主神っち (1600x529)
            childC_1_4: { 
                type: 'image', src: 'futsunushi.jpg', frames: 3, speed: 800, 
                sqSize: 533,
                customFrames: [
                    { sx: 18, sy: 8, sWidth: 500, sHeight: 510 },
                    { sx: 551, sy: 8, sWidth: 500, sHeight: 510 },
                    { sx: 1084, sy: 8, sWidth: 500, sHeight: 510 }
                ]
            },
            // C-1-4：経津主神っち（病気状態）
            childC_1_4_sick: { 
                type: 'image', src: 'futsunushi_sick.jpg', frames: 3, speed: 1000, 
                sqSize: 533,
                customFrames: [
                    { sx: 18, sy: 8, sWidth: 500, sHeight: 510 },
                    { sx: 551, sy: 8, sWidth: 500, sHeight: 510 },
                    { sx: 1084, sy: 8, sWidth: 500, sHeight: 510 }
                ]
            },
            // C-1-1：大黒天っち
            childC_1_1: { 
                type: 'image', src: '大黒天っち.jpg', frames: 3, speed: 800, 
                sqSize: 500,
                customFrames: [
                    { sx: 13, sy: 14, sWidth: 500, sHeight: 500 },
                    { sx: 543, sy: 22, sWidth: 500, sHeight: 500 },
                    { sx: 1080, sy: 26, sWidth: 500, sHeight: 500 }
                ]
            },
            // C-1-1：大黒天っち（病気状態）
            childC_1_1_sick: { 
                type: 'image', src: '大黒天っち（病気）.jpg', frames: 3, speed: 1000, 
                sqSize: 500,
                customFrames: [
                    { sx: 15, sy: 14, sWidth: 500, sHeight: 500 },
                    { sx: 554, sy: 18, sWidth: 500, sHeight: 500 },
                    { sx: 1080, sy: 26, sWidth: 500, sHeight: 500 }
                ]
            },
            // C-1-2：弁財天っち
            childC_1_2: { 
                type: 'image', src: '弁財天っち.jpg', frames: 3, speed: 800, 
                sqSize: 500,
                customFrames: [
                    { sx: 10, sy: 16, sWidth: 500, sHeight: 500 },
                    { sx: 540, sy: 18, sWidth: 500, sHeight: 500 },
                    { sx: 1074, sy: 16, sWidth: 500, sHeight: 500 }
                ]
            },
            // C-1-2：弁財天っち（病気状態）
            childC_1_2_sick: { 
                type: 'image', src: '弁財天っち（病気）.jpg', frames: 3, speed: 1000, 
                sqSize: 500,
                customFrames: [
                    { sx: 12, sy: 14, sWidth: 500, sHeight: 500 },
                    { sx: 542, sy: 16, sWidth: 500, sHeight: 500 },
                    { sx: 1072, sy: 24, sWidth: 500, sHeight: 500 }
                ]
            },
            // C-1-3：恵比寿っち
            childC_1_3: { 
                type: 'image', src: '恵比寿っち.jpg', frames: 3, speed: 800, 
                sqSize: 500,
                customFrames: [
                    { sx: 17, sy: 14, sWidth: 500, sHeight: 500 },
                    { sx: 550, sy: 14, sWidth: 500, sHeight: 500 },
                    { sx: 1084, sy: 14, sWidth: 500, sHeight: 500 }
                ]
            },
            // C-1-3：恵比寿っち（病気状態）
            childC_1_3_sick: { 
                type: 'image', src: '恵比寿っち（病気）.jpg', frames: 3, speed: 1000, 
                sqSize: 500,
                customFrames: [
                    { sx: 18, sy: 14, sWidth: 500, sHeight: 500 },
                    { sx: 546, sy: 13, sWidth: 500, sHeight: 500 },
                    { sx: 1085, sy: 14, sWidth: 500, sHeight: 500 }
                ]
            },
            // C-2-1：毘沙門天っち
            childC_2_1: { 
                type: 'image', src: '毘沙門天っち.jpg', frames: 3, speed: 800, 
                sqSize: 500,
                customFrames: [
                    { sx: 20, sy: 14, sWidth: 500, sHeight: 500 },
                    { sx: 550, sy: 14, sWidth: 500, sHeight: 500 },
                    { sx: 1078, sy: 14, sWidth: 500, sHeight: 500 }
                ]
            },
            // C-2-1：毘沙門天っち（病気状態）
            childC_2_1_sick: { 
                type: 'image', src: '毘沙門天っち（病気）.jpg', frames: 3, speed: 1000, 
                sqSize: 500,
                customFrames: [
                    { sx: 27, sy: 14, sWidth: 500, sHeight: 500 },
                    { sx: 553, sy: 14, sWidth: 500, sHeight: 500 },
                    { sx: 1074, sy: 14, sWidth: 500, sHeight: 500 }
                ]
            },
            // C-2-2：布袋尊っち
            childC_2_2: { 
                type: 'image', src: '布袋尊っち.jpg', frames: 3, speed: 800, 
                sqSize: 525,
                customFrames: [
                    { sx: 2, sy: 3, sWidth: 504, sHeight: 525 },
                    { sx: 551, sy: 3, sWidth: 504, sHeight: 525 },
                    { sx: 1080, sy: 3, sWidth: 504, sHeight: 525 }
                ]
            },
            // C-2-2：布袋尊っち（病気状態）
            childC_2_2_sick: { 
                type: 'image', src: '布袋尊っち（病気）.jpg', frames: 3, speed: 1000, 
                sqSize: 525,
                customFrames: [
                    { sx: 4, sy: 3, sWidth: 504, sHeight: 525 },
                    { sx: 553, sy: 3, sWidth: 504, sHeight: 525 },
                    { sx: 1090, sy: 3, sWidth: 504, sHeight: 525 }
                ]
            },
            // C-2-3：孔雀明王っち
            childC_2_3: { 
                type: 'image', src: '孔雀明王っち.jpg', frames: 3, speed: 800, 
                sqSize: 500,
                customFrames: [
                    { sx: 17, sy: 14, sWidth: 500, sHeight: 500 },
                    { sx: 550, sy: 14, sWidth: 500, sHeight: 500 },
                    { sx: 1083, sy: 14, sWidth: 500, sHeight: 500 }
                ]
            },
            // C-2-3：孔雀明王っち（病気状態）
            childC_2_3_sick: { 
                type: 'image', src: '孔雀明王っち（病気）.jpg', frames: 3, speed: 1000, 
                sqSize: 500,
                customFrames: [
                    { sx: 17, sy: 14, sWidth: 500, sHeight: 500 },
                    { sx: 550, sy: 14, sWidth: 500, sHeight: 500 },
                    { sx: 1083, sy: 14, sWidth: 500, sHeight: 500 }
                ]
            },
            // C-2-4：木花咲夜姫っち
            childC_2_4: { 
                type: 'image', src: '木花咲夜姫っち.jpg', frames: 3, speed: 800, 
                sqSize: 533,
                customFrames: [
                    { sx: 18, sy: 8, sWidth: 500, sHeight: 510 },
                    { sx: 551, sy: 8, sWidth: 500, sHeight: 510 },
                    { sx: 1084, sy: 8, sWidth: 500, sHeight: 510 }
                ]
            },
            // C-2-4：木花咲夜姫っち（病気状態）
            childC_2_4_sick: { 
                type: 'image', src: '木花咲夜姫っち（病気）.jpg', frames: 3, speed: 1000, 
                sqSize: 533,
                customFrames: [
                    { sx: 18, sy: 8, sWidth: 500, sHeight: 510 },
                    { sx: 551, sy: 8, sWidth: 500, sHeight: 510 },
                    { sx: 1084, sy: 8, sWidth: 500, sHeight: 510 }
                ]
            },
            // 第5段階シークレット（八大龍王っち）
            ultimate_1: {
                type: 'image', src: '八大龍王っち.jpg', frames: 3, speed: 800,
                sqSize: 1184,
                customFrames: [
                    { sx: 0, sy: 0, sWidth: 1184, sHeight: 1184 },
                    { sx: 1200, sy: 0, sWidth: 1184, sHeight: 1184 },
                    { sx: 2400, sy: 0, sWidth: 1184, sHeight: 1184 }
                ]
            },
            // 病気
            ultimate_1_sick: {
                type: 'image', src: '八大龍王っち.jpg', frames: 3, speed: 1000,
                sqSize: 1184,
                customFrames: [
                    { sx: 0, sy: 0, sWidth: 1184, sHeight: 1184 },
                    { sx: 1200, sy: 0, sWidth: 1184, sHeight: 1184 },
                    { sx: 2400, sy: 0, sWidth: 1184, sHeight: 1184 }
                ]
            },
            // 第5段階シークレット（天之御中主神っち）
            ultimate_2: {
                type: 'image', src: '天之御中主神っち.jpg', frames: 3, speed: 800,
                sqSize: 1184,
                customFrames: [
                    { sx: 0, sy: 0, sWidth: 1184, sHeight: 1184 },
                    { sx: 1200, sy: 0, sWidth: 1184, sHeight: 1184 },
                    { sx: 2400, sy: 0, sWidth: 1184, sHeight: 1184 }
                ]
            },
            // 病気
            ultimate_2_sick: {
                type: 'image', src: '天之御中主神っち.jpg', frames: 3, speed: 1000,
                sqSize: 1184,
                customFrames: [
                    { sx: 0, sy: 0, sWidth: 1184, sHeight: 1184 },
                    { sx: 1200, sy: 0, sWidth: 1184, sHeight: 1184 },
                    { sx: 2400, sy: 0, sWidth: 1184, sHeight: 1184 }
                ]
            },
            // 第5段階シークレット（バステトっち）
            ultimate_3: {
                type: 'image', src: 'バステトっち.jpg', frames: 3, speed: 800,
                sqSize: 1184,
                customFrames: [
                    { sx: 0, sy: 0, sWidth: 1184, sHeight: 1184 },
                    { sx: 1200, sy: 0, sWidth: 1184, sHeight: 1184 },
                    { sx: 2400, sy: 0, sWidth: 1184, sHeight: 1184 }
                ]
            },
            // 病気
            ultimate_3_sick: {
                type: 'image', src: 'バステトっち.jpg', frames: 3, speed: 1000,
                sqSize: 1184,
                customFrames: [
                    { sx: 0, sy: 0, sWidth: 1184, sHeight: 1184 },
                    { sx: 1200, sy: 0, sWidth: 1184, sHeight: 1184 },
                    { sx: 2400, sy: 0, sWidth: 1184, sHeight: 1184 }
                ]
            }

        });

        // --- DOM ---
        const canvas = document.getElementById('pixelCanvas');
        const ctx = canvas.getContext('2d');

        // --- フィルター関数 (iOSでのSVG filter非対応対策) ---
        function applyPixelFilter(targetCtx, width, height, filterType) {
            if (filterType === 'none' || !filterType) return;
            try {
                const imgData = targetCtx.getImageData(0, 0, width, height);
                const data = imgData.data;
                for (let i = 0; i < data.length; i += 4) {
                    if (data[i+3] === 0) continue;
                    const r = data[i]/255, g = data[i+1]/255, b = data[i+2]/255;
                    const sum = r + g + b;
                    let a_out = 1.0;
                    
                    if (filterType === 'remove-white') {
                        a_out = -sum + 2.5;
                    } else if (filterType === 'remove-grey') {
                        a_out = -sum + 1.5;
                    } else if (filterType === 'remove-black') {
                        a_out = sum - 0.5;
                    }
                    
                    data[i] = 15;
                    data[i+1] = 56;
                    data[i+2] = 15;
                    data[i+3] = Math.max(0, Math.min(255, a_out * 255));
                }
                targetCtx.putImageData(imgData, 0, 0);
            } catch(e) {
                console.warn("applyPixelFilter failed:", e);
            }
        }
        const progressBarEl = document.getElementById('progressBar');
        const progressTextEl = document.getElementById('progressText');
        const statusTextEl = document.getElementById('statusText');
        const statsOverlayEl = document.getElementById('statsOverlay');
        const statsListEl = document.getElementById('statsList');
        const oyatsuOverlayEl = document.getElementById('oyatsuOverlay');
        const oyatsuListEl = document.getElementById('oyatsuList');
        const micBtnEl = document.getElementById('micBtn');
        const rebirthCountdownEl = document.getElementById('rebirthCountdown');

        const REBIRTH_STAGE3_DELAY_MS = 3 * 24 * 60 * 60 * 1000;
        const REBIRTH_STAGE4_DELAY_MS = 4 * 24 * 60 * 60 * 1000;

        function getDisplayedStats() {
            if (currentStage === 0 && totalCount === 0) {
                return { hp: 0, attack: 0, evasionRate: 0, criticalRate: 0 };
            }
            return getBattleStats();
        }

        // --- 今後の対戦機能に向けた裏側ステータス（表には表示しない） ---
        // ※ 育成（心のごはん）の総量からステータスを自動計算する仕組みです
        function getBattleStats() {
            // 基本ステータス
            let stats = {
                hp: 100,
                attack: 10,
                evasionRate: 5,  // 回避率(%)
                criticalRate: 5  // 会心率(%)
            };

            // 1. 耐久力・タンク系（HPアップ）
            const defScore = (wordCounts['愛してます'] || 0) + (wordCounts['ゆるします'] || 0);
            stats.hp += defScore * 2; // 1回ごとにHP+2

            // 2. 火力・パワー系（攻撃力アップ）
            const atkScore = (wordCounts['ありがとう'] || 0) + (wordCounts['感謝してます'] || 0);
            stats.attack += atkScore * 1; // 1回ごとに攻撃力+1

            // 3. スピード・回避系（回避率アップ）
            const evaScore = (wordCounts['楽しい'] || 0) + (wordCounts['うれしい'] || 0);
            stats.evasionRate = Math.min(stats.evasionRate + (evaScore * 0.2), 50); // 上限50%にキャップ

            // 4. 運・ミラクル系（クリティカル率アップ）
            const critScore = (wordCounts['ツイてる'] || 0) + (wordCounts['しあわせ'] || 0);
            stats.criticalRate = Math.min(stats.criticalRate + (critScore * 0.2), 50); // 上限50%にキャップ
            // シークレット（第5段階）による全ステータスアップのボーナス
            if (currentForm.startsWith('ultimate')) {
                stats.hp = Math.floor(stats.hp * 1.3); // HP 1.3倍
                stats.attack = Math.floor(stats.attack * 1.3); // 攻撃 1.3倍
                stats.evasionRate = Math.min(stats.evasionRate + 15, 60); // 回避+15%
                stats.criticalRate = Math.min(stats.criticalRate + 15, 60); // 会心+15%
            }

            return stats;
        }

        function getEnemyStats(playerStats = getBattleStats()) {
            // CPUは「戦闘に使う能力」を基準にする。おやつ等の総発話数では強くならない。
            const strength = 0.88 + Math.random() * 0.24; // 自分とほぼ同格（-12% 〜 +12%）
            const hpTilt = 0.92 + Math.random() * 0.16;
            const attackTilt = 0.92 + Math.random() * 0.16;

            return {
                hp: Math.max(100, Math.round(playerStats.hp * strength * hpTilt)),
                attack: Math.max(10, Math.round(playerStats.attack * strength * attackTilt)),
                evasionRate: Math.min(60, Math.max(5, Math.round(playerStats.evasionRate * strength))),
                criticalRate: Math.min(60, Math.max(5, Math.round(playerStats.criticalRate * strength)))
            };
        }

        function saveState() {
            const state = {
                saveDataVersion: window.KotodamaStateMigrations.CURRENT_SAVE_DATA_VERSION,
                currentStage,
                currentForm,
                wordCounts,
                totalCount,
                intokuPower,
                battleWins,
                battleLosses,
                isSick,
                sickRecoveryCount,
                lastInteractionTimestamp,
                finalEvolutionTimestamp,
                unlockedForms,
                unlockedItems
            };
            const serializedState = JSON.stringify(state);
            try {
                const previousState = localStorage.getItem('kotodama_state');
                if (previousState && previousState !== serializedState) {
                    try {
                        JSON.parse(previousState);
                        localStorage.setItem('kotodama_state_backup', previousState);
                    } catch (error) {
                        console.warn('壊れた保存データは予備保存にコピーしませんでした。', error);
                    }
                }
                localStorage.setItem('kotodama_state', serializedState);
            } catch (e) {
                console.error('Failed to save state:', e);
            }
        }

        function loadState() {
            try {
                // 音量は端末側で管理する。旧バージョンのアプリ内OFF設定は引き継がない。
                soundEnabled = true;
                localStorage.removeItem('kotodama_sound_enabled');
                const saved = localStorage.getItem('kotodama_state');
                if (saved) {
                    let state;
                    try {
                        state = JSON.parse(saved);
                    } catch (primaryError) {
                        const backup = localStorage.getItem('kotodama_state_backup');
                        if (!backup) throw primaryError;
                        state = JSON.parse(backup);
                        localStorage.setItem('kotodama_state', backup);
                        console.warn('保存データを予備保存から復旧しました。');
                    }
                    if (!state || typeof state !== 'object') {
                        throw new Error('保存データの形式が不正です');
                    }

                    const migration = window.KotodamaStateMigrations.migrateSavedState(state, allWords);
                    state = migration.state;
                    if (migration.didChange) {
                        const migratedState = JSON.stringify(state);
                        localStorage.setItem('kotodama_state', migratedState);
                        localStorage.setItem('kotodama_state_backup', migratedState);
                    }
                    if (migration.didResetKnownTestState) {
                        console.info('公開前のテストデータを初期状態へ移行しました。');
                    }

                    currentStage = (state.currentStage !== undefined) ? Number(state.currentStage) : 0;
                    currentForm = state.currentForm || 'egg';
                    totalCount = (state.totalCount !== undefined) ? Number(state.totalCount) : 0;
                    intokuPower = (state.intokuPower !== undefined) ? Number(state.intokuPower) : 0;
                    battleWins = (state.battleWins !== undefined) ? Number(state.battleWins) : 0;
                    battleLosses = (state.battleLosses !== undefined) ? Number(state.battleLosses) : 0;
                    isSick = !!state.isSick;
                    sickRecoveryCount = (state.sickRecoveryCount !== undefined) ? Number(state.sickRecoveryCount) : 0;
                    lastInteractionTimestamp = (state.lastInteractionTimestamp !== undefined) ? Number(state.lastInteractionTimestamp) : Date.now();
                    finalEvolutionTimestamp = (state.finalEvolutionTimestamp !== undefined) ? state.finalEvolutionTimestamp : null;
                    
                    unlockedForms = state.unlockedForms || [];
                    if (!unlockedForms.includes('egg')) unlockedForms.push('egg');
                    if (!unlockedForms.includes(currentForm)) unlockedForms.push(currentForm);

                    unlockedItems = state.unlockedItems || [];

                    // wordCountsは個別にマージ（数値であることを保証）
                    if (state.wordCounts) {
                        for (let w in state.wordCounts) {
                            if (wordCounts.hasOwnProperty(w)) {
                                wordCounts[w] = Number(state.wordCounts[w]) || 0;
                            }
                        }
                    }

                    // 72時間以上ことだまが届かなかった場合だけ、病気状態にする
                    const now = Date.now();
                    if (now - lastInteractionTimestamp > SICKNESS_DELAY_MS && !isSick) {
                        isSick = true;
                        sickRecoveryCount = 0;
                    }
                }
            } catch (e) {
                console.error("Failed to load state:", e);
            }
            
        }

        // --- 転生ロジック ---
        function getRebirthDeadline() {
            if (!finalEvolutionTimestamp) return null;
            if (currentStage === 3) return finalEvolutionTimestamp + REBIRTH_STAGE3_DELAY_MS;
            if (currentStage === 4) return finalEvolutionTimestamp + REBIRTH_STAGE4_DELAY_MS;
            return null;
        }

        function updateRebirthCountdown() {
            if (!rebirthCountdownEl) return;

            const deadline = getRebirthDeadline();
            if (!deadline) {
                rebirthCountdownEl.hidden = true;
                rebirthCountdownEl.textContent = '';
                return;
            }

            const remainingMs = Math.max(0, deadline - Date.now());
            const totalHours = Math.ceil(remainingMs / (60 * 60 * 1000));
            const days = Math.floor(totalHours / 24);
            const hours = totalHours % 24;
            const remainingLabel = remainingMs <= 0
                ? 'まもなく'
                : (days > 0 ? `あと ${days}日 ${hours}時間` : `あと ${Math.max(1, hours)}時間`);

            rebirthCountdownEl.textContent = `転生まで ${remainingLabel}`;
            rebirthCountdownEl.setAttribute('aria-label', `現在の姿は${remainingLabel}で転生します。図鑑とアイテムは残ります。`);
            rebirthCountdownEl.hidden = false;
        }

        function checkRebirth({ announce = true } = {}) {
            const deadline = getRebirthDeadline();
            if (deadline && Date.now() >= deadline) reincarnate({ announce });
        }

        function reincarnate({ announce = true } = {}) {
            const overlay = document.getElementById('rebirthOverlay');
            if(!overlay) return;

            const resetToEgg = () => {
                currentStage = 0;
                currentForm = 'egg';
                totalCount = 0;
                for (let w in wordCounts) {
                    wordCounts[w] = 0;
                }
                finalEvolutionTimestamp = null;
                isSick = false;
                sickRecoveryCount = 0;
                
                // 図鑑とアイテムはそのまま！
                saveState();
                
                renderCanvasArt('egg', ctx);
                updateUI();
                statusTextEl.textContent = announce ? "ふたたび たまごになった..." : "マイクをオンにしてね";
            };

            // 起動時に期限切れを検出した場合は、転生演出を出さず通常の案内で始める。
            if (!announce) {
                resetToEgg();
                return;
            }

            // 起動中に迎えた転生だけは、転生サウンドと暗転を表示する。
            playRebirthSound();
            overlay.classList.add('active');

            // 3秒後（完全に真っ黒になった瞬間）にデータをリセット
            setTimeout(() => {
                resetToEgg();

                // ゆっくり明転させる
                overlay.classList.remove('active');
            }, 3000);
        }

        // --- 描画ロジック ---
        function init() {
            loadState();
            checkRebirth({ announce: false });
            if (isSick) {
                const remaining = Math.max(0, SICKNESS_RECOVERY_GOAL - sickRecoveryCount);
                statusTextEl.textContent = `ことだまを あと ${remaining} 回で元気！`;
            }
            renderCanvasArt(currentForm, ctx);
            updateUI();
            // 開いたままでも日付をまたいだ表示・転生を取りこぼさない。
            window.setInterval(() => {
                checkRebirth();
                updateRebirthCountdown();
            }, 60 * 1000);
            if (useNativeSpeech) {
                prepareNativeSpeech().catch((error) => {
                    console.warn('Speech recognition prewarm failed:', error);
                });
            }
            startFirstLaunchTutorial();
        }

        const FIRST_LAUNCH_TUTORIAL_KEY = 'kotodama_onboarding_seen';
        let tutorialStep = 0;
        const tutorialCoachmarkEl = document.getElementById('tutorialCoachmark');
        const tutorialStepLabelEl = document.getElementById('tutorialStepLabel');
        const tutorialCoachTitleEl = document.getElementById('tutorialCoachTitle');
        const tutorialCoachTextEl = document.getElementById('tutorialCoachText');
        const tutorialFinishButtonEl = document.getElementById('tutorialFinishButton');

        function clearTutorialHighlights() {
            micBtnEl.classList.remove('tutorial-highlight');
            canvas.classList.remove('tutorial-highlight');
        }

        function showTutorialCoach(step, title, message, canFinish = false) {
            tutorialStep = step;
            tutorialStepLabelEl.textContent = `${step} / 3`;
            tutorialCoachTitleEl.textContent = title;
            tutorialCoachTextEl.textContent = message;
            tutorialFinishButtonEl.hidden = !canFinish;
            tutorialCoachmarkEl.classList.add('visible');
        }

        function startFirstLaunchTutorial() {
            if (localStorage.getItem(FIRST_LAUNCH_TUTORIAL_KEY)) return;

            // 表示した時点で記録し、次回起動からは自動表示しない。
            localStorage.setItem(FIRST_LAUNCH_TUTORIAL_KEY, 'true');
            startInteractiveTutorial(false);
        }

        function startInteractiveTutorial(shouldPlaySound = true) {
            if (shouldPlaySound) playButtonSound();
            clearTutorialHighlights();
            micBtnEl.classList.add('tutorial-highlight');
            showTutorialCoach(1, 'MICを押してみよう', 'マイクを許可すると、ことだまを聞き取れるよ。');
        }

        function onMicrophoneStartedForTutorial() {
            if (tutorialStep !== 1) return;
            clearTutorialHighlights();
            canvas.classList.add('tutorial-highlight');
            showTutorialCoach(2, '「ありがとう」と言ってみよう', '認識されると、コトダマっちが喜んで回数が増えるよ。');
        }

        function handleTutorialWordRecognized(word) {
            if (tutorialStep !== 2) return;
            stopMic();
            clearTutorialHighlights();
            canvas.classList.add('tutorial-highlight');
            showTutorialCoach(3, 'はじめの一歩、成功！', `「${word}」が届いたよ。次は10回の特別演出を目指そう！`, true);
        }

        function finishTutorial() {
            playButtonSound();
            tutorialStep = 0;
            tutorialCoachmarkEl.classList.remove('visible');
            clearTutorialHighlights();
            statusTextEl.textContent = '次は10回を目指そう！';
        }

        function skipOnboarding() {
            tutorialStep = 0;
            tutorialCoachmarkEl.classList.remove('visible');
            clearTutorialHighlights();
        }

        function renderCanvasArt(key, targetCtx) {
            // 病気ステータスなら病気用スプライトを探す（メインキャンバスのみ）
            let searchKey = key;
            if (isSick && targetCtx === ctx) {
                if (PIXEL_ARTS[key + '_sick']) {
                    searchKey = key + '_sick';
                }
            }

            const artData = PIXEL_ARTS[searchKey];
            if(!artData) return;

            // アニメーションタイマーをクリア
            if (targetCtx.canvas.animTimer) {
                clearInterval(targetCtx.canvas.animTimer);
                targetCtx.canvas.animTimer = null;
            }

            // === 新機能：高解像度画像（AI生成スプライトシート）を自動透過・変色してアニメーション ===
            if (!Array.isArray(artData) && artData.type === 'image') {
                const img = new Image();
                img.src = artData.src;
                targetCtx.canvas.lastSrc = artData.src; // 読み込み開始ソースを記録

                // 画像がロードされたら描画開始
                img.onload = () => {
                    // 非同期ロード中に別のキャラが指定されていたら無視
                    if (targetCtx.canvas.lastSrc !== artData.src) return;

                    // 念のため既存のタイマーを再度クリア（重複防止）
                    if (targetCtx.canvas.animTimer) {
                        clearInterval(targetCtx.canvas.animTimer);
                    }

                    let currentFrame = 0;
                    
                    const renderLoop = () => {
                        // CSSの表示サイズ(192px)に合わせてキャンバス解像度を直接引き上げることで鮮明に描画
                        targetCtx.canvas.width = 192;
                        targetCtx.canvas.height = 192;
                        targetCtx.clearRect(0, 0, 192, 192);

                        let sx, sy, sWidth, sHeight;
                        
                        // はみ出し・被りがある画像向けの手動切り出し定義（customFrames）を優先
                        if (artData.customFrames && artData.customFrames[currentFrame]) {
                            const cFrame = artData.customFrames[currentFrame];
                            sx = cFrame.sx;
                            sy = cFrame.sy || 0;
                            sWidth = cFrame.sWidth;
                            sHeight = cFrame.sHeight || img.height;
                        } else {
                            const frameW = img.width / artData.frames;
                            const frameH = img.height;
                            
                            // 画像の不要なフチ（AIが生成した枠線など）をカットする
                            // 個別のキャラに応じて、左右(trim)と上下(trimY)を別々に調整可能にする
                            const tX = artData.trim || 0;
                            const tY = (artData.trimY !== undefined) ? artData.trimY : 0;
                            
                            sx = currentFrame * frameW + (frameW * tX);
                            sy = frameH * tY;
                            sWidth = frameW * (1 - tX * 2);
                            sHeight = frameH * (1 - tY * 2);
                        }
                        
                        // 縦長の画像（頭の装飾など）が見切れないよう、高さを基準にしたスケール計算も考慮
                        let sqSize;
                        if (artData.sqSize) {
                            sqSize = artData.sqSize; // サイズの跳ねを防ぐための固定スケール幅
                        } else {
                            sqSize = Math.max(sWidth, sHeight);
                        }
                        
                        const renderScale = 0.85; // 左右上下に余白をもたせて見切れを防止 (0.92 -> 0.85 に縮小)
                        const drawW = Math.round((sWidth / sqSize) * 192 * renderScale);
                        const drawH = Math.round((sHeight / sqSize) * 192 * renderScale);
                        
                        // 画像が上にはみ出さないように、オフセットを中央ではなくやや下に寄せる調整（必要であれば）
                        // ここでは純粋に中央配置とするが、より余裕を持たせる
                        const offX = Math.round((192 - drawW) / 2);
                        const offY = Math.round((192 - drawH) / 2);

                        // Canvas Contextのfilterを使って背景を透過し、緑色に着色 (ChromeのローカルファイルCORSエラー回避)
                        // Canvas Contextのfilterを使って背景を透過し、緑色に着色 (ChromeのローカルファイルCORSエラー回避)
                        // Canvas Contextのfilterを使って背景を透過し、緑色に着色 (ChromeのローカルファイルCORSエラー回避)
                        let pixelFilterType = "none";
                        if (artData.filter === 'black' || artData.filter === 'remove-black') {
                            pixelFilterType = "remove-black";
                        } else if (artData.filter !== 'none') {
                            pixelFilterType = "remove-white";
                        }
                        
                        targetCtx.filter = artData.brightness ? `brightness(${artData.brightness})` : "none";
                        targetCtx.drawImage(img, sx, sy, sWidth, sHeight, offX, offY, drawW, drawH);
                        targetCtx.filter = "none"; // 元に戻す
                        
                        // 代わりにJSでピクセル操作（iOS CanvasでのSVG filterバグ対策）
                        applyPixelFilter(targetCtx, 192, 192, pixelFilterType);
                    };

                    // 最初のフレームを描画
                    renderLoop();

                    // コマ数が複数ならループアニメーションを開始
                    if (artData.frames > 1) {
                        targetCtx.canvas.animTimer = setInterval(() => {
                            currentFrame = (currentFrame + 1) % artData.frames;
                            renderLoop();
                        }, artData.speed || 400);
                    }
                };
                img.onerror = (e) => {
                    console.error("Failed to load image:", artData.src, e);
                    // 画像ロードに失敗した場合は従来の描画（もしあれば）を試みる
                };

                // CSSでの筐体の揺れを止める（自身のパラパラアニメが動くため）
                if (targetCtx === ctx && artData.frames > 1) {
                    canvas.classList.remove('animated'); 
                }
                return;
            }

            // === 従来の24x24テキスト配列ベース描画（AI画像以外の既存キャラ用） ===
            // 解像度を24に戻す
            targetCtx.canvas.width = 24;
            targetCtx.canvas.height = 24;
            
            // 配列の配列（パラパラ漫画）かどうか判定
            const isAnimated = Array.isArray(artData[0]);
            const frames = isAnimated ? artData : [artData];
            let currentFrame = 0;

            function drawFrame(frameIndex) {
                const frameData = frames[frameIndex];
                targetCtx.clearRect(0, 0, targetCtx.canvas.width, targetCtx.canvas.height);
                targetCtx.fillStyle = '#0f380f'; // 液晶のドット色

                // 24x24の文字列配列を描画
                for(let y=0; y<24; y++) {
                    const row = frameData[y];
                    for(let x=0; x<24; x++) {
                        if (row[x] === '█') {
                            targetCtx.fillRect(x, y, 1, 1);
                        }
                    }
                }
            }

            // 初回描画
            drawFrame(0);

            if (isAnimated) {
                // パラパラ漫画のループ（400msごとにコマ送り）
                targetCtx.canvas.animTimer = setInterval(() => {
                    currentFrame = (currentFrame + 1) % frames.length;
                    drawFrame(currentFrame);
                }, 400); 
            }

            // メインキャンバスの場合のみ揺れアニメーション付与（パラパラ漫画の場合は揺らさない）
            if (targetCtx === ctx && !isAnimated) {
                canvas.classList.remove('animated');
                void canvas.offsetWidth; // リフロー強制
                canvas.classList.add('animated');
            } else if (targetCtx === ctx && isAnimated) {
                canvas.classList.remove('animated'); // 独自のパラパラアニメが動いているので揺れは止める
            }
        }

        // プレビューギャラリー用の描画
        function renderPreviewGallery() {
            const keys = [
                'egg',
                'childA', 'childB', 'childC',
                'childA_1', 'childA_2', 'childB_1', 'childB_2', 'childC_1', 'childC_2',
                'childA_1_1', 'childA_1_2', 'childA_1_3', 'childA_1_4', 'childA_2_1', 'childA_2_2', 'childA_2_3', 'childA_2_4',
                'childB_1_1', 'childB_1_2', 'childB_1_3', 'childB_1_4', 'childB_2_1', 'childB_2_2', 'childB_2_3', 'childB_2_4',
                'childC_1_1', 'childC_1_2', 'childC_1_3', 'childC_1_4', 'childC_2_1', 'childC_2_2', 'childC_2_3', 'childC_2_4',
                'ultimate_1', 'ultimate_2', 'ultimate_3'
            ];
            keys.forEach(key => {
                const previewCanvas = document.getElementById('preview-' + key);
                if (previewCanvas) {
                    const previewCtx = previewCanvas.getContext('2d');
                    renderCanvasArt(key, previewCtx);

                    // クリックでそのキャラをメインに反映させる
                    previewCanvas.style.cursor = 'pointer';
                    previewCanvas.onclick = () => {
                        currentForm = key;
                        // キー形式からステージを推測 (egg=0, childA=1, childA_1=2, childA_1_1=3, ultimate_1=4)
                        if (key === 'egg') {
                            currentStage = 0;
                        } else if (key === 'ultimate_1' || key === 'ultimate_2' || key === 'ultimate_3') {
                            currentStage = 4;
                        } else {
                            currentStage = key.split('_').length;
                        }
                        
                        isSick = false; // プレビュー時は健康な状態にする
                        saveState();
                        renderCanvasArt(currentForm, ctx);
                        updateUI();
                        
                        // キャラ名マップ
                        const nameMap = {
                            egg: 'タマゴ',
                            childA: '多邇具久っち', childB: '狛犬っち', childC: '小槌っち',
                            childA_1: '白蛇っち', childA_2: '蓮華っち',
                            childB_1: '迦楼羅っち', childB_2: '鳳凰っち',
                            childC_1: '招き猫っち', childC_2: '宝船っち',
                            childA_1_1: '天照大御神っち', childA_1_2: '玄武っち', childA_1_3: '福禄寿っち', childA_1_4: '阿弥陀如来っち',
                            childA_2_1: '千手観音っち', childA_2_2: '白虎っち', childA_2_3: '瀬織津姫っち', childA_2_4: '十一面観音っち',
                            childB_1_1: '青龍っち', childB_1_2: '不動明王っち', childB_1_3: '寿老人っち', childB_1_4: '弥勒菩薩っち',
                            childB_2_1: '朱雀っち', childB_2_2: '大日如来っち', childB_2_3: '須佐之男命っち', childB_2_4: '武甕槌大神っち',
                            childC_1_1: '大黒天っち', childC_1_2: '弁財天っち', childC_1_3: '恵比寿っち', childC_1_4: '経津主神っち',
                            childC_2_1: '毘沙門天っち', childC_2_2: '布袋尊っち', childC_2_3: '孔雀明王っち', childC_2_4: '木花咲夜姫っち',
                            ultimate_1: '八大龍王っち',
                            ultimate_2: '天之御中主神っち',
                            ultimate_3: 'バステトっち'
                        };
                        statusTextEl.textContent = nameMap[key] || key;
                        // ギャラリーを閉じる（もしスマホ表示などで邪魔なら）
                    };
                }
            });
        }

        function updateUI() {
            let percentage = 0;
            let currentGoal = STAGE1_GOAL;

            if (currentStage === 0) {
                currentGoal = STAGE1_GOAL;
                percentage = (totalCount / STAGE1_GOAL) * 100;
            } else if (currentStage === 1) {
                currentGoal = STAGE2_GOAL;
                percentage = ((totalCount - STAGE1_GOAL) / (STAGE2_GOAL - STAGE1_GOAL)) * 100;
            } else if (currentStage === 2) {
                currentGoal = STAGE3_GOAL;
                percentage = ((totalCount - STAGE2_GOAL) / (STAGE3_GOAL - STAGE2_GOAL)) * 100;
            } else if (currentStage === 3) {
                currentGoal = STAGE4_GOAL;
                percentage = ((totalCount - STAGE3_GOAL) / (STAGE4_GOAL - STAGE3_GOAL)) * 100;
            } else {
                percentage = 100;
                currentGoal = STAGE4_GOAL;
            }

            if(percentage > 100) percentage = 100;
            
            progressBarEl.style.width = percentage + '%';
            progressBarEl.style.minWidth = percentage > 0 ? '4px' : '0';
            
            let denominator;
            if (currentStage === 0) {
                denominator = STAGE1_GOAL;
            } else if (currentStage === 1) {
                denominator = STAGE2_GOAL;
            } else if (currentStage === 2) {
                denominator = STAGE3_GOAL;
            } else if (currentStage === 3) {
                denominator = STAGE4_GOAL;
            } else {
                denominator = 'MAX';
            }

            if (denominator === 'MAX') {
                progressTextEl.textContent = `${totalCount} 回`;
            } else {
                progressTextEl.textContent = `${totalCount} / ${denominator}`;
            }
            const progressContainer = document.getElementById('progressContainer');
            if (progressContainer) {
                progressContainer.setAttribute('aria-valuenow', String(totalCount));
                progressContainer.setAttribute('aria-valuemax', denominator === 'MAX' ? String(totalCount) : String(denominator));
                progressContainer.setAttribute('aria-valuetext', denominator === 'MAX' ? `${totalCount}回。最大進化済み` : `${totalCount}回。次の進化まで${denominator}回`);
            }

            // メイン画面のステータス表示を更新
            const currentStats = getDisplayedStats();
            const mainStatsDisplay = document.getElementById('mainStatsDisplay');
            if (mainStatsDisplay) {
                mainStatsDisplay.innerHTML = `
                    HP:${currentStats.hp}<br>
                    攻:${currentStats.attack}<br>
                    避:${Math.floor(currentStats.evasionRate)}%<br>
                    会:${Math.floor(currentStats.criticalRate)}%<br>
                    陰徳:${intokuPower}
                `;
            }

            const battleRecordDisplay = document.getElementById('battleRecordDisplay');
            if (battleRecordDisplay) {
                let trophyHtml = '';
                if (battleWins >= 10) {
                    let color = battleWins >= 100 ? '#81ecec' : (battleWins >= 50 ? '#fab1a0' : '#f1c40f');
                    trophyHtml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="14" height="14" style="vertical-align: text-bottom; margin-right: 3px; display: inline-block;">
  <path fill="#2f3640" d="M4 1h8v1H4zM2 2h2v1H2zM12 2h2v1h-2zM1 3h2v2H1zM13 3h2v2h-2zM2 5h2v1H2zM12 5h2v1h-2zM3 6h2v1H3zM11 6h2v1h-2zM4 7h2v1H4zM10 7h2v1h-2zM6 8h4v1H6zM7 9h2v1H7zM6 10h4v1H6zM5 11h6v1H5zM4 12h8v2H4z"/>
  <path fill="${color}" d="M4 2h8v1H4zM3 3h1v2H3zM4 3h8v3H4zM12 3h1v2h-1zM5 6h6v1H5zM6 7h4v1H6zM7 8h2v2H7zM6 10h4v1H6zM5 11h6v1H5z"/>
  <path fill="rgba(255,255,255,0.8)" d="M5 3h1v2H5zM6 3h1v1H6z"/>
  </svg>`;
                }
                battleRecordDisplay.innerHTML = `戦歴<br>${trophyHtml}${battleWins}勝<br>${battleLosses}敗`;
            }

            updateRebirthCountdown();

            if(totalCount >= STAGE4_GOAL && currentStage < 4) {
                evolve(4);
            } else if(totalCount >= STAGE3_GOAL && currentStage < 3) {
                evolve(3);
            } else if(totalCount >= STAGE2_GOAL && currentStage < 2) {
                evolve(2);
            } else if (totalCount >= STAGE1_GOAL && currentStage < 1) {
                evolve(1);
            } else if (currentStage === 0) {
                if(totalCount > 0) statusTextEl.textContent = "トクトク...";
                if(totalCount > 300) statusTextEl.textContent = "うごきはじめた...";
                if(totalCount > 500) statusTextEl.textContent = "おおきくなってきた！";
                if(totalCount > 800) statusTextEl.textContent = "もうすぐうまれる...！";
            }
            
            updateAuraEffect();
        }

        // 勝利数に応じたオーラエフェクトの更新
        function updateAuraEffect() {
            const auraEl = document.getElementById('auraEffect');
            if (!auraEl) return;
            
            // クラスを一旦リセット
            auraEl.className = 'aura-effect';

            if (battleWins >= 100) {
                auraEl.classList.add('aura-100');
            } else if (battleWins >= 50) {
                auraEl.classList.add('aura-50');
            } else if (battleWins >= 10) {
                auraEl.classList.add('aura-10');
            }
        }

        function createEvolutionEffect(callback, isUltimate = false) {
            const overlay = document.getElementById('evolutionOverlay');
            if(!overlay) {
                callback();
                return;
            }
            
            if (isUltimate) {
                overlay.classList.add('flashing-ultimate');
                playUltimateEvolutionSound(); // 究極進化用の超派手な音
                
                // 9.0秒経過したとき（真っ白の瞬間）で姿を切り替える
                setTimeout(() => {
                    callback();
                    
                    // ゆっくりと白い光が晴れていく余韻
                    setTimeout(() => {
                        overlay.classList.remove('flashing-ultimate');
                    }, 3000);
                }, 9000);
            } else {
                overlay.classList.add('flashing');
                playEvolutionSound(); // ドキドキパルス音＋ファンファーレ開始
                
                // 6.0秒経過したとき（真っ黒のタイミング）で姿を切り替える
                setTimeout(() => {
                    callback();
                    
                    // 真っ黒になってから少し余韻を残してゆっくりと晴れる
                    setTimeout(() => {
                        overlay.classList.remove('flashing');
                    }, 1000);
                }, 6000);
            }
        }

        function evolve(targetStage) {
            let prevStage = currentStage;
            currentStage = targetStage;
            statusTextEl.textContent = "ドキドキ...";
            canvas.classList.add('bouncing');

            let evolutionType = currentForm;
            let newName = "";

            if(targetStage === 1) {
                let sumA = WORD_GROUPS.A.words.reduce((sum, w) => sum + wordCounts[w], 0);
                let sumB = WORD_GROUPS.B.words.reduce((sum, w) => sum + wordCounts[w], 0);
                let sumC = WORD_GROUPS.C.words.reduce((sum, w) => sum + wordCounts[w], 0);

                evolutionType = 'childA';
                let maxVal = sumA;
                if (sumB > maxVal) { maxVal = sumB; evolutionType = 'childB'; }
                if (sumC > maxVal) { evolutionType = 'childC'; }
                
                if(evolutionType === 'childA') newName = "多邇具久っち";
                if(evolutionType === 'childB') newName = "狛犬っち";
                if(evolutionType === 'childC') newName = "小槌っち";
            } else if(targetStage === 2) {
                const STAGE2_GROUPS = {
                    childA: {
                        path1: ['愛してます', 'ありがとう', 'うれしい', 'しあわせ'],
                        path2: ['ゆるします', '楽しい', '感謝してます', 'ツイてる'],
                        types: ['childA_1', 'childA_2']
                    },
                    childB: {
                        path1: ['楽しい', 'うれしい', '愛してます', '感謝してます'],
                        path2: ['しあわせ', 'ツイてる', 'ゆるします', 'ありがとう'],
                        types: ['childB_1', 'childB_2']
                    },
                    childC: {
                        path1: ['感謝してます', 'しあわせ', 'ツイてる', '楽しい'],
                        path2: ['愛してます', 'ゆるします', 'ありがとう', 'うれしい'],
                        types: ['childC_1', 'childC_2']
                    }
                };

                const group = STAGE2_GROUPS[currentForm];
                if(group) {
                    const sum1 = group.path1.reduce((s, w) => s + (wordCounts[w] || 0), 0);
                    const sum2 = group.path2.reduce((s, w) => s + (wordCounts[w] || 0), 0);
                    evolutionType = (sum2 > sum1) ? group.types[1] : group.types[0];
                }
                
                if(evolutionType === 'childA_1') newName = "白蛇っち";
                if(evolutionType === 'childA_2') newName = "蓮華っち";
                if(evolutionType === 'childB_1') newName = "迦楼羅っち";
                if(evolutionType === 'childB_2') newName = "鳳凰っち";
                if(evolutionType === 'childC_1') newName = "招き猫っち";
                if(evolutionType === 'childC_2') newName = "宝船っち";
            } else if(targetStage === 3) {
                let maxVal = -1;
                let maxIdx = 0;
                allWords.forEach((w, idx) => {
                    if(wordCounts[w] > maxVal) {
                        maxVal = wordCounts[w];
                        maxIdx = idx;
                    }
                });

                let root = 'A';
                if(currentForm.startsWith('childB')) root = 'B';
                if(currentForm.startsWith('childC')) root = 'C';

                const FINAL_MAP = {
                    A: ['childA_1_1', 'childA_1_2', 'childA_1_3', 'childA_1_4', 'childA_2_1', 'childA_2_2', 'childA_2_3', 'childA_2_4'],
                    B: ['childB_1_1', 'childB_1_2', 'childB_1_3', 'childB_1_4', 'childB_2_1', 'childB_2_2', 'childB_2_3', 'childB_2_4'],
                    C: ['childC_1_1', 'childC_1_2', 'childC_1_3', 'childC_1_4', 'childC_2_1', 'childC_2_2', 'childC_2_3', 'childC_2_4']
                };

                evolutionType = FINAL_MAP[root][maxIdx] || `${currentForm}_1`;

                const names = {
                    'childA_1_1': '天照大御神っち', 'childA_1_2': '玄武っち', 'childA_1_3': '福禄寿っち', 'childA_1_4': '阿弥陀如来っち',
                    'childA_2_1': '千手観音っち', 'childA_2_2': '白虎っち', 'childA_2_3': '瀬織津姫っち', 'childA_2_4': '十一面観音っち',
                    'childB_1_1': '青龍っち', 'childB_1_2': '不動明王っち', 'childB_1_3': '寿老人っち', 'childB_1_4': '弥勒菩薩っち',
                    'childB_2_1': '朱雀っち', 'childB_2_2': '大日如来っち', 'childB_2_3': '須佐之男命っち', 'childB_2_4': '武甕槌大神っち',
                    'childC_1_1': '大黒天っち', 'childC_1_2': '弁財天っち', 'childC_1_3': '恵比寿っち', 'childC_1_4': '経津主神っち',
                    'childC_2_1': '毘沙門天っち', 'childC_2_2': '布袋尊っち', 'childC_2_3': '孔雀明王っち', 'childC_2_4': '木花咲夜姫っち'
                };
                newName = names[evolutionType] || `${evolutionType}`;
            } else if(targetStage === 4) {
                // 第5段階シークレット確率（基本3% + 陰徳パワー49毎に1%増加）
                let baseProb = 0.03;
                let bonusProb = Math.floor((intokuPower || 0) / 49) * 0.01;
                let totalProb = baseProb + bonusProb;
                
                const isSuccess = Math.random() < totalProb;
                if (isSuccess) {
                    const rnd = Math.random();
                    if (rnd < 0.333) {
                        evolutionType = 'ultimate_1';
                        newName = '八大龍王っち';
                    } else if (rnd < 0.666) {
                        evolutionType = 'ultimate_2';
                        newName = '天之御中主神っち';
                    } else {
                        evolutionType = 'ultimate_3';
                        newName = 'バステトっち';
                    }
                } else {
                    evolutionType = currentForm; // 元の姿のまま
                    newName = charNames[currentForm] || '元のすがた';
                }
            }

            // エフェクト開始
            createEvolutionEffect(() => {
                const isFailedUltimate = (targetStage === 4 && evolutionType === currentForm);
                if (isFailedUltimate) {
                    statusTextEl.textContent = "進化に失敗した...";
                    totalCount = 4800; // カウントを少し戻して再挑戦させる
                    currentStage = prevStage; // ステージも手前に戻す
                    saveState();
                    updateUI(); // UIのカウンタも戻す
                    canvas.classList.remove('bouncing');
                    return; 
                }

                currentForm = evolutionType;
                if (!unlockedForms.includes(currentForm)) {
                    unlockedForms.push(currentForm);
                }
                
                // 第3段階到達で転生タイマー開始
                if (currentStage === 3) {
                    finalEvolutionTimestamp = Date.now();
                }
                
                saveState(); // 進化状態を保存
                renderCanvasArt(evolutionType, ctx);
                
                if (currentStage === 3) {
                    statusTextEl.textContent = `★ ${newName}！ 3日後に転生するよ。図鑑・アイテムは残るよ！ ★`;
                } else if (currentStage === 4) {
                    statusTextEl.textContent = `★ ${newName}！ 転生までの時間が1日延びたよ。★`;
                } else {
                    statusTextEl.textContent = `★ ${newName}！ ★`;
                }
                updateRebirthCountdown();
                canvas.classList.remove('bouncing');
            }, targetStage === 4);
        }

        function createWordEffect(count, word, isTen = false) {
            const container = document.querySelector('.art-container');
            if(!container) return;
            const fx = document.createElement('div');
            fx.textContent = '+' + count;
            fx.className = 'word-count-effect';
            fx.style.left = (25 + Math.random() * 38) + '%';
            fx.style.top = '62%';
            const POP_COLORS = ['#ff4757', '#ffa502', '#2ed573', '#1e90ff', '#ff69b4', '#00ced1', '#ff2e93'];
            const color1 = POP_COLORS[Math.floor(Math.random() * POP_COLORS.length)];
            const color2 = POP_COLORS[Math.floor(Math.random() * POP_COLORS.length)];

            fx.style.color = color1;
            fx.style.textShadow = '2px 2px 0 #fff, -2px -2px 0 #fff, 2px -2px 0 #fff, -2px 2px 0 #fff';
            fx.style.fontWeight = 'bold';
            fx.style.fontFamily = "'DotGothic16', sans-serif";
            fx.style.fontSize = '2.5rem';
            if (isTen) fx.classList.add('word-effect-milestone');
            container.appendChild(fx);
            
            const EMOJI_MAP = {
                '愛してます': '♥',
                'ゆるします': '✦',
                'ありがとう': '♪',
                'うれしい': '☀',
                '楽しい': '♪',
                '感謝してます': '❀',
                'しあわせ': '♧',
                'ツイてる': '★'
            };

            const sparkle = document.createElement('div');
            sparkle.textContent = EMOJI_MAP[word] || '♪';
            sparkle.className = 'word-symbol-effect';
            sparkle.style.left = Math.min(76, parseFloat(fx.style.left) + 18) + '%';
            sparkle.style.top = '60%';
            sparkle.style.color = color2;
            sparkle.style.textShadow = '2px 2px 0 #fff, -2px -2px 0 #fff, 2px -2px 0 #fff, -2px 2px 0 #fff';
            sparkle.style.fontFamily = "'DotGothic16', sans-serif";
            sparkle.style.fontSize = '2.5rem';
            if (isTen) sparkle.classList.add('word-effect-milestone');
            container.appendChild(sparkle);

            // 「テロン」または10の倍数なら「テレレン」を鳴らす
            if (isTen) {
                playTenPopSound();
            } else {
                playWordPopSound();
            }

            // WebKitでも開始フレームが省略されないCSSキーフレームで動かし、完了後に削除する
            const cleanup = () => {
                fx.remove();
                sparkle.remove();
            };
            fx.addEventListener('animationend', cleanup, { once: true });
            setTimeout(cleanup, 1300);
        }

        function animateProgressGain() {
            const progressContainer = document.getElementById('progressContainer');
            if (!progressContainer) return;
            progressContainer.classList.remove('progress-gain');
            void progressContainer.offsetWidth;
            progressContainer.classList.add('progress-gain');
            setTimeout(() => progressContainer.classList.remove('progress-gain'), 500);
        }

        function addWordLog(word, count=1) {
            wordCounts[word] += count;
            let oldCount = totalCount;
            totalCount += count;
            handleTutorialWordRecognized(word);
            
            let crossedTen = Math.floor(totalCount / 10) > Math.floor(oldCount / 10);
            
            // 第5段階（シークレット進化）の判定 (最終形態後、5000回ごとのチャレンジ)
            if (currentStage === 3) {
                let stage5Old = Math.floor((oldCount - STAGE3_GOAL) / 5000);
                let stage5New = Math.floor((totalCount - STAGE3_GOAL) / 5000);
                if (stage5New > stage5Old && stage5New >= 1) {
                    if (Math.random() < 0.05) { // 指定通り 5% に変更
                        evolve(4);
                    } else {
                        // 失敗時も同じエフェクトを流す（ガセ演出）
                        statusTextEl.textContent = "ドキドキ...";
                        canvas.classList.add('bouncing');
                        createEvolutionEffect(() => {
                            statusTextEl.textContent = "何かの気配がしたが...静まり返った";
                            canvas.classList.remove('bouncing');
                            setTimeout(() => checkRebirth(), 4000);
                        }, true);
                    }
                }
            }
            
            // お金が貯まるようなピコンピコンエフェクト
            if (count > 5) {
                createWordEffect(count, word, crossedTen);
            } else {
                for (let i = 0; i < count; i++) {
                    let currentPopCount = oldCount + i + 1;
                    let isTen = (currentPopCount % 10 === 0);
                    setTimeout(() => createWordEffect(1, word, isTen), i * 150);
                }
            }
            animateProgressGain();


            // 進化のタイミングと被るかどうか判定
            const isEvolutionMilestone = [STAGE1_GOAL, STAGE2_GOAL, STAGE3_GOAL, STAGE4_GOAL].some(goal => oldCount < goal && totalCount >= goal);

            // 100回ごとの区切りでお祝いを表示（進化と被る場合は非表示）
            if (!isEvolutionMilestone && Math.floor(totalCount / 100) > Math.floor(oldCount / 100)) {
                showCelebration(Math.floor(totalCount / 100) * 100);
            } else if (!isEvolutionMilestone && oldCount < 30 && totalCount >= 30) {
                showCelebration(30, {
                    title: '30回達成！',
                    message: 'タマゴがもっと元気になった！<br>1,000回の進化へ前進中♪'
                });
            } else if (!isEvolutionMilestone && oldCount < 10 && totalCount >= 10) {
                showCelebration(10, {
                    title: 'はじめの10回！',
                    message: 'ことだま習慣の第一歩！<br>次は30回を目指そう♪'
                });
            }
            
            // 病気ステータスの場合の処理
            if (isSick) {
                sickRecoveryCount = Math.min(SICKNESS_RECOVERY_GOAL, sickRecoveryCount + count);
                if (sickRecoveryCount >= SICKNESS_RECOVERY_GOAL) {
                    recoverFromSick();
                } else {
                    lastInteractionTimestamp = Date.now();
                    saveState();
                    statusTextEl.textContent = `かいふくまで あと ${SICKNESS_RECOVERY_GOAL - sickRecoveryCount} 回...`;
                }
            } else {
                lastInteractionTimestamp = Date.now();
                checkRebirth(); // 音声入力などの相互作用時にも転生チェック
                saveState();

                const randomMessages = ["大満足", "喜んでいる", "パワーアップ"];
                const msg = randomMessages[Math.floor(Math.random() * randomMessages.length)];
                statusTextEl.textContent = msg;
            }
            updateUI();

            // おやつマイルストーンチェック（秘密のアイテムゲット：各おやつ言霊1万回で特定アイテム獲得）
            const ITEM_MAPPING = {
                '自分はすごいんだ': 'kusanagi_no_tsurugi', // 草薙剣
                'もっと自分を愛しますもっと自分をゆるします': 'yasakani_no_magatama', // 八尺瓊勾玉
                '宇宙の調和に感謝します': 'yata_no_kagami', // 八咫鏡
                'このことがダイヤモンドにかわります': 'houju', // 宝珠
                'だんだんよくなる未来はあかるい': 'sankosho', // 三鈷杵
                'どうでもいいどっちでもいいどうせうまくいくから': 'kagurasuzu' // 神楽鈴
            };

            if (ITEM_MAPPING[word]) {
                let oldCountForWord = wordCounts[word] - count;
                let newCountForWord = wordCounts[word];
                
                // 初めて2万回、3万回と節目を超えるたびに発動（複数回取得させず図鑑に1回だけ登録でも弾く）
                if (Math.floor(newCountForWord / 10000) > Math.floor(oldCountForWord / 10000)) {
                    const itemId = ITEM_MAPPING[word];
                    if (!unlockedItems.includes(itemId)) {
                        setTimeout(() => showItemPopup(itemId), 500);
                    }
                }
            }
            
            // 現在の画面が開かれていればリアルタイムにテキストを更新する
            if (overlayState === 1) updateStatsList();
            if (overlayState === 2) updateOyatsuList();
        }

        // --- 割合表示と図鑑画面 ---
        let overlayState = 0; // 0: closed, 1: stats, 2: oyatsu, 3: zukan
        const zukanOverlayEl = document.getElementById('zukanOverlay');
        const zukanListEl = document.getElementById('zukanList');

        function setInfoPage(page) {
            const nextPage = Math.max(1, Math.min(3, Number(page) || 1));

            const pvpOverlay = document.getElementById('pvpMenuOverlay');
            if (pvpOverlay) pvpOverlay.classList.remove('visible');
            const intokuOverlay = document.getElementById('intokuOverlay');
            if (intokuOverlay) intokuOverlay.classList.remove('visible');

            overlayState = nextPage;
            statsOverlayEl.classList.toggle('visible', nextPage === 1);
            oyatsuOverlayEl.classList.toggle('visible', nextPage === 2);
            zukanOverlayEl.classList.toggle('visible', nextPage === 3);

            if (nextPage === 1) updateStatsList();
            if (nextPage === 2) updateOyatsuList();
            if (nextPage === 3) renderZukan();
        }

        function toggleAButton() {
            playButtonSound();
            if (overlayState < 3) {
                setInfoPage(overlayState + 1);
            } else {
                closeOverlays();
            }
        }

        function closeOverlays() {
            overlayState = 0;
            statsOverlayEl.classList.remove('visible');
            oyatsuOverlayEl.classList.remove('visible');
            zukanOverlayEl.classList.remove('visible');
            
            const zukanDetail = document.getElementById('zukanDetailOverlay');
            if(zukanDetail) zukanDetail.classList.remove('visible');

            // 図鑑のCanvasアニメーションループを止める
            const oldCanvases = zukanListEl.querySelectorAll('canvas');
            oldCanvases.forEach(c => {
                if (c.animTimer) {
                    clearInterval(c.animTimer);
                    c.animTimer = null;
                }
            });
        }

        const ZUKAN_DESCRIPTIONS = { 
            childA_1_4: { text: '限りない命を持つことから「無量寿如来」、阿弥陀如来は永遠のいのちをもち、まばゆい光で人々を照らし「無量光如来」とも呼ばれ「南無阿弥陀仏」と唱えるすべての人を、必ず極楽浄土へ導くといわれます。極楽浄土とは、宇宙の西の果てにある阿弥陀如来の住む世界のことで、西方極楽浄土ともいいます。苦しみのない理想の世界、この上なく楽しい世界です' },
            childA_2_4: { text: '本面（本来の顔）の周囲や頭上に11の顔（または10の顔と最頂部の仏面）を持ちます。これらはすべての方向を見渡すためのものであらゆる方向から人々を見守り、救いの手を差し伸べる仏教の菩薩（観音菩薩の変化身）病気治癒、財福授与、災難除けなどの現世利益があるとされます。' },
            childB_2_1: { text: '四神で朱雀は南方を守護する神獣です。火の象徴。南方を守護します。。美しい赤い翼を持ち「太陽」「情熱」「発展」「名声」「カリスマ性」を象徴します。大きな翼で災厄を払い、幸運や平安、人気運を引き寄せる強力なエネルギーを持つとされています。' },
            childB_2_2: { text: '密教では宇宙の根源をなす中心的な仏さまです。偉大な光で闇をてらします密教では二つの世界があります。大日には「おおいなる太陽」唱えることで功徳が得られるとされる「真言」があります。金剛界は何があっても壊れない智慧：ご真言はオン・バサラ・ダトバン　胎蔵界とは事象の根元を内在の世界に宿っている（森羅万象）：オン・アビラウンケン　唱えれパワーみなぎるよ' },
            childC_2_1: { text: '七福神の一柱です。仏法や人々を悪から守る最強の武神としての力強さから「勝運・開運」、財宝の神ともいわれ「金運・商売繁盛」上杉謙信が信仰していた。四天王の1人として数えられるときは「多聞天（たもんてん）」と呼ばれます。これは、お釈迦様の教えを一番多く聞いていた、という逸話もある' },
            childB_1_3: { text: '七福神の一柱で、長い杖（つえ）を手にして、長いひげをたくわえた姿の寿老人。延命長寿、家庭円満を授ける神様です。道教の仙人で、南極老人星と呼ばれ星の化身とされています。この星は、南の空の低い場所に現れ、様々な条件がそろった時でないと見えない星です。この星が見えたら長生きするといわれるからさがしてみてね。' },
            childA_1: { text: '無限の豊かさの象徴。脱皮を繰り返す姿が「無限の再生（お金が循環して返ってくる）」を意味します。海千山千のことわざで海で千年、山で千年生きた蛇が龍になる' },
            childA_2: { text: '泥の中でも美しく咲き誇る蓮（笑顔でいる人が美しいという教え）「5つの徳」といわれ①どのように良くない環境であっても、心は健やかに笑顔で明るく②唯一無二の自分自身を大切に③美しい心を育む④一人が悟りに至れば多くの人を幸せに導ける⑤自我やむさぶる欲を無にしてお天道様に心を向けましょう' },
            childC: { text: '大黒天の持ち物で、振ることで欲しいもの願い事を唱えて振ると願いどおりの物があらわれる効果特に財運アップ！商売繁盛が有名ですが、一寸法師が鬼退治で鬼から手に入れた打ち出の小づちで、大きくなることができ、富も手に入れ、お姫様と結ばれた' },
            childA_1_1: { text: '日本神話の最高神として登場し、八百万の神の中で最も尊いとされる太陽神天照大神（あまてらすおおみかみ）が天岩戸（あまのいわと）に篭ってしまい、世界が暗闇になってしまう。天岩戸の神隠れで有名な神さま。高天原（たかまがはら）から日向（ひゅうが）、すなわち現在の宮崎の高千穂へと降り立ったとされ、この出来事を天孫降臨といいます' },
            childC_2_4: { text: '美の女神で、想像を絶するコノハナノサクヤヒメの美しさにニニギノミコトが一目ぼれをし結婚にいたりました。、桜のように美しいのではなく桜のほうがコノハナサクヤヒメの美貌にあやかったといわれます。富士山の神、火山の神、安産の神、子育ての神' },
            ultimate_1: { text: '龍族の中の皇族クラスの王で直感と勝機をもたらす龍神「最大の願いを叶える」「勝負運や金運を高める」「人生の大きな流れを掴む」象徴。難陀（なんだ）、跋難陀（ばつなんだ）、娑迦羅（しゃから）、和修吉（わしゅきつ）、徳叉伽（とくしゃか）、阿那婆達多（あなばだった）、摩那斯（まなし）、優鉢羅（うはつら）' },
            childA_1_2: {
                text: '玄武は北を守護する。冥界と現世を往来して、冥界にて神託を受け、現世にその答えを持ち帰ることが出来る。四神の中で最強・最古そして最も高い霊力を持つ守護神。変化しながらも、どっしり守る'
            },
            childB_1_1: {
                text: '青龍は東を守護し新しい始まりと成長の象徴で金運・出世・成功・勝利する。青龍は「川の流れ」を象徴することから、滞りなく清らかな気が流れるように、運気や豊かさがスムーズに循環していく力を持つ'
            },
            childA_2_1: {
                text: 'あの手この手を使い、生きとし生けるものすべて（全宇宙）を、一人も漏らさず救い上げてくれます。底知れない大慈悲と無限の力を象徴です。ねずみ年の守り本尊'
            },
            childA_2_2: {
                text: '白虎は西方の守護を司どる邪気を払い、家運を安定させる強いパワーを持つ“前へ切り開く守護”8月23日の「白虎隊の日」'
            },
            childA_2_3: {
                text: '大祓詞（おおはらへのことば）の中で、四柱の祓戸の大神として一番最初に出てくるのが瀬織津姫もろもろの禍事・罪・穢れを川から海へ流してくれ海で浄化します'
            },
            childA_1_3: {
                text: '七福神の一柱で幸福・財宝・長寿の三徳をもたらす福の神です。\n福：子孫繁栄、家内安全\n禄：財運、金運、立身出世\n寿：延命長寿、健康'
            },
            childB_1_2: {
                text: '大日如来の化身とされ、怒った表情をしているのは怒りをもって救うため。煩悩を抱えた人たちを力ずくで救済するためよこしまな心や、迷いを断ち切る意味があります。悪を縛り上げ、煩悩を断ち切れない人正しい方向へ導きます'
            },
            childB_1_4: {
                text: 'お釈迦様の入滅後(人としての命が終わった後)、五十六億七千万年後の未来に仏となってこの世に現れ、お釈迦様のように仏教を説き、多くの人々を救済していくとされている未来仏'
            },
            childB_2_3: {
                text: '荒々しい「破壊神」のような側面と、村を苦しめる巨大な蛇「ヤマタノオロチ」を倒す人々を救う「英雄」としての側面を併せ持つ、非常に人間味あふれ「感情を抑え込まず、本音で生きる力」'
            },
            childC_1_1: {
                text: '七福神の一柱に頭巾をかぶり、左肩に大きな袋を背負い、右手には打ち出の小槌を持って米俵の上に立つ、にこやかな笑顔の姿日本の七福神の一柱として広く親しまれている財福・五穀豊穣・出世の神様'
            },
            childC_1_2: {
                text: '七福神の中で唯一の女性神で琵琶（びわ）を持ち、市杵島姫命（いちきしまひめのみこと）と同一視される。音楽や弁舌の才能を授ける存在として信仰される。福徳財宝の神といわれ江戸時代には人気を博した'
            },
            childC_1_3: {
                text: '恵比寿様は、七福神で唯一日本ルーツの神様でにこやかな笑顔をえびす顔ともいわれる。商売繁盛の神。すえびす神は耳が遠いとされているため、神社本殿の正面を参拝するほか、本殿の裏側に回りドラを叩いて祈願しなくてはならないとされる'
            },
            childC_2_2: {
                text: '七福神の中で唯一実在した中国の禅僧（契此がモデルの福徳円満の神様です。)いつもニコニコして心豊かで楽天的でした。未来のできごとや天気を予知する不思議な能力もあり最後は仙人になりました'
            },
            childA: { 
                text: '非常にかしこく「国土の隅々まで知り尽くしている存在」別名　少名毘古那神（すくなびこな　一寸帽子)日本神話において「知恵者で多才な小人神」非常に重要な神酒造の神で有名で大国主の命の相棒' 
            },
            childB: {
                text: '狛犬は神社の入り口で\n魂の重たい気を祓う守り神です　口を開けた「阿（あ）」で良いエネルギーを取り入れ、閉じた「吽（うん）」で心と体に落とし込んでくれます\n狛犬と仲良くなるには\n鳥居をくぐって彼らの前に来たら、「いつも神様とこの場所をお守りくださり、ありがとうございます」と心の中で話しかけてみてくださいね'
            },
            childB_1: {
                text: '迦楼羅は仏教では「天部（守護する存在）」「人の煩悩（毒）を喰らい尽くす」精神的な浄化の力が強い\n人々を救済する慈悲も持ち合わせている\n古い執着を焼き切る\nエネルギーを一気に上昇させる\n「本来の自分に戻る」'
            },
            ultimate_2: {
                text: '「宇宙の中心」にいるひとり神\nかたちもなく古事記にも１回しか登場しない'
            },
            childC_2_3: {
                text: '孔雀は、猛毒を持つサソリや蛇を好んで食べても美しい姿でパワフルで性質があります。そこから、「人間の心にある猛毒（煩悩や苦しみ）を喰らい尽くし、清浄な状態に変えてくれる」懐の深い神様'
            },
            childB_2_4: {
                text: '現最強の軍神・雷神であり、剣の神実的な豊かさ＋見えない運の両方 地震は巨大な「大鯰（おおなまず）」が暴れて起こるものと信じられていましたが、タケミカヅチはその鯰を「要石（かなめいし）」で押さえつけて鎮めている神様'
            },
            childC_1_4: {
                text: 'たけみかずちの神と兄弟　静かだけどめちゃ強い武神\n「戦う」よりも整えて勝つタイプ\n秩序・ルール・調和を司る　フツフツとひらめきがいただけるかも'
            },
            childB_2: {
                text: '鳳凰は「魂の完全な解放」と「祝福」のシンボルです\n過去の傷や深刻さを手放し「フワッと軽い心」明るい人のもとへ、圧倒的な幸運を運びます\nものごとを俯瞰できて、愛と豊かさを周りを笑顔にする調和のエネルギーです'
            },
            childC_1: {
                text: '猫自体がスピリチュアルな存在です\n右手でお金、左手で人を招く招き猫は、宇宙からの福をキャッチするアンテナです\n「今日もありがとう」と万物に感謝することで、豊かさにあふれるでしょう'
            },
            ultimate_3: {
                text: '古代エジプトの女神バステトは、強力な魔除けと守護の力\n闇を見通す直感力と女性性を授け、直感と創造の女神です\n喜びの波動でいることが最大の豊かさを生むことを教えてくれます'
            },
            childC_2: {
                text: '宝船は、宇宙の無尽蔵の豊かさがあなたに向かってきているサインです\n睡眠中の潜在意識を浄化し、魂を幸運体質にリセットします\n無理に抗うのではなく、宇宙の大きな「幸運の波に乗る」ことです'
            }
        };

        const ZUKAN_DATA = [
            { stage: '第1段階', keys: ['egg'] },
            { stage: '第2段階', keys: ['childA', 'childB', 'childC'] },
            { stage: '第3段階', keys: ['childA_1', 'childA_2', 'childB_1', 'childB_2', 'childC_1', 'childC_2'] },
            { stage: '第4段階', keys: [
                'childA_1_1', 'childA_1_2', 'childA_1_3', 'childA_1_4', 'childA_2_1', 'childA_2_2', 'childA_2_3', 'childA_2_4',
                'childB_1_1', 'childB_1_2', 'childB_1_3', 'childB_1_4', 'childB_2_1', 'childB_2_2', 'childB_2_3', 'childB_2_4',
                'childC_1_1', 'childC_1_2', 'childC_1_3', 'childC_1_4', 'childC_2_1', 'childC_2_2', 'childC_2_3', 'childC_2_4'
            ]},
            { stage: '第5段階（シークレット）', keys: ['ultimate_1', 'ultimate_2', 'ultimate_3'] }
        ];

        const charNames = {
            egg: 'タマゴ',
            childA: '多邇具久っち', childB: '狛犬っち', childC: '小槌っち',
            childA_1: '白蛇っち', childA_2: '蓮華っち',
            childB_1: '迦楼羅っち', childB_2: '鳳凰っち',
            childC_1: '招き猫っち', childC_2: '宝船っち',
            childA_1_1: '天照大御神っち', childA_1_2: '玄武っち', childA_1_3: '福禄寿っち', childA_1_4: '阿弥陀如来っち',
            childA_2_1: '千手観音っち', childA_2_2: '白虎っち', childA_2_3: '瀬織津姫っち', childA_2_4: '十一面観音っち',
            childB_1_1: '青龍っち', childB_1_2: '不動明王っち', childB_1_3: '寿老人っち', childB_1_4: '弥勒菩薩っち',
            childB_2_1: '朱雀っち', childB_2_2: '大日如来っち', childB_2_3: '須佐之男命っち', childB_2_4: '武甕槌大神っち',
            childC_1_1: '大黒天っち', childC_1_2: '弁財天っち', childC_1_3: '恵比寿っち', childC_1_4: '経津主神っち',
            childC_2_1: '毘沙門天っち', childC_2_2: '布袋尊っち', childC_2_3: '孔雀明王っち', childC_2_4: '木花咲夜姫っち',
            ultimate_1: '八大龍王っち',
            ultimate_2: '天之御中主神っち',
            ultimate_3: 'バステトっち'
        };

        function renderZukan() {
            // 前回のCanvasアニメーションタイマーをクリア
            const oldCanvases = zukanListEl.querySelectorAll('canvas');
            oldCanvases.forEach(c => {
                if (c.animTimer) clearInterval(c.animTimer);
            });
            zukanListEl.innerHTML = '';
            
            ZUKAN_DATA.forEach(group => {
                const title = document.createElement('div');
                title.className = 'zukan-stage-title';
                title.textContent = group.stage;
                zukanListEl.appendChild(title);

                const grid = document.createElement('div');
                grid.className = 'zukan-grid';
                if (group.keys.length === 1) {
                    grid.style.display = 'flex';
                    grid.style.justifyContent = 'center';
                }

                group.keys.forEach(key => {
                    const item = document.createElement('div');
                    item.className = 'zukan-item';
                    
                    const can = document.createElement('canvas');
                    can.className = 'zukan-canvas';
                    can.width = 24;
                    can.height = 24;
                    
                    const nameEl = document.createElement('div');
                    nameEl.className = 'zukan-name';
                    
                    if (unlockedForms.includes(key)) {
                        nameEl.textContent = charNames[key] || key;
                        item.appendChild(can);
                        item.appendChild(nameEl);
                        grid.appendChild(item);
                        
                        const zctx = can.getContext('2d');
                        renderCanvasArt(key, zctx);
                        
                        item.addEventListener('click', () => {
                            const desc = ZUKAN_DESCRIPTIONS[key];
                            document.getElementById('zukanDetailName').textContent = charNames[key] || key;
                            
                            const typeEl = document.getElementById('zukanDetailType');
                            const statsEl = document.getElementById('zukanDetailStats');
                            const descEl = document.getElementById('zukanDetailDesc');

                            if (desc) {
                                if (desc.type) {
                                    typeEl.style.display = 'block';
                                    typeEl.textContent = 'タイプ：' + desc.type;
                                } else {
                                    typeEl.style.display = 'none';
                                }
                                
                                if (desc.stats) {
                                    statsEl.style.display = 'block';
                                    statsEl.textContent = desc.stats;
                                } else {
                                    statsEl.style.display = 'none';
                                }
                                
                                descEl.textContent = desc.text;
                            } else {
                                typeEl.style.display = 'none';
                                statsEl.style.display = 'none';
                                descEl.textContent = '（詳細データはまだありません）';
                            }
                            
                            const detailCan = document.getElementById('zukanDetailCanvas');
                            const detailCtx = detailCan.getContext('2d');
                            detailCtx.clearRect(0,0,detailCan.width,detailCan.height);
                            renderCanvasArt(key, detailCtx);
                            
                            playButtonSound();
                            document.getElementById('zukanDetailOverlay').classList.add('visible');
                        });
                    } else {
                        nameEl.textContent = '???';
                        const zctx = can.getContext('2d');
                        zctx.fillStyle = '#5a5a5a';
                        zctx.fillRect(0,0,24,24);
                        zctx.fillStyle = '#fff';
                        zctx.font = '16px DotGothic16, sans-serif';
                        zctx.textAlign = 'center';
                        zctx.textBaseline = 'middle';
                        zctx.fillText('?', 12, 12);
                        
                        item.appendChild(can);
                        item.appendChild(nameEl);
                        grid.appendChild(item);
                    }
                });
                zukanListEl.appendChild(grid);
            });

            // --- 秘密のアイテム枠 ---
            const itemTitle = document.createElement('div');
            itemTitle.className = 'zukan-stage-title';
            itemTitle.style.marginTop = '15px';
            itemTitle.style.color = '#c0392b'; // 特別な色
            itemTitle.style.fontWeight = 'bold';
            itemTitle.textContent = '★ ひみつのアイテム ★';
            zukanListEl.appendChild(itemTitle);

            const itemGrid = document.createElement('div');
            itemGrid.className = 'zukan-grid';

            for (let i = 0; i < SECRET_ITEMS_DATA.length; i++) {
                const itemData = SECRET_ITEMS_DATA[i];
                const item = document.createElement('div');
                item.className = 'zukan-item';
                
                const can = document.createElement('canvas'); // 将来絵を入れる枠
                can.className = 'zukan-canvas';
                can.style.background = '#eadecd'; // 特別な背景色
                can.style.borderColor = '#c0392b';
                can.width = 24;
                can.height = 24;
                
                const nameEl = document.createElement('div');
                nameEl.className = 'zukan-name';
                
                const zctx = can.getContext('2d');
                
                if (itemData && unlockedItems.includes(itemData.id)) {
                    nameEl.textContent = itemData.name;
                    
                    item.addEventListener('click', () => {
                        document.getElementById('zukanDetailName').textContent = itemData.name;
                        const typeEl = document.getElementById('zukanDetailType');
                        const statsEl = document.getElementById('zukanDetailStats');
                        const descEl = document.getElementById('zukanDetailDesc');
                        
                        typeEl.style.display = 'none';
                        statsEl.style.display = 'none';
                        descEl.textContent = itemData.desc || '（詳細データはまだありません）';
                        
                        const detailCan = document.getElementById('zukanDetailCanvas');
                        const zCtxDetail = detailCan.getContext('2d');
                        detailCan.width = 192;
                        detailCan.height = 192;
                        zCtxDetail.clearRect(0,0,192,192);
                        const imgDetail = new Image();
                        imgDetail.src = itemData.src;
                        imgDetail.onload = () => {
                            const t = itemData.trim || 0;
                            const sx = imgDetail.width * t;
                            const sy = imgDetail.height * t;
                            const sW = imgDetail.width * (1 - t * 2);
                            const sH = imgDetail.height * (1 - t * 2);
                            zCtxDetail.drawImage(imgDetail, sx, sy, sW, sH, 0, 0, 192, 192);
                            if (itemData.filter !== 'none') {
                                applyPixelFilter(zCtxDetail, 192, 192, itemData.filter || 'remove-white');
                            }
                        };
                        document.getElementById('zukanDetailOverlay').classList.add('visible');
                    });

                    if (itemData.src) {
                        const img = new Image();
                        img.src = itemData.src;
                        img.onload = () => {
                            can.width = 192;
                            can.height = 192;
                            can.style.imageRendering = 'auto'; // 高画質画像を滑らかに縮小
                            zctx.filter = "none";
                            
                            const t = itemData.trim || 0;
                            const sx = img.width * t;
                            const sy = img.height * t;
                            const sW = img.width * (1 - t * 2);
                            const sH = img.height * (1 - t * 2);
                            
                            zctx.drawImage(img, sx, sy, sW, sH, 0, 0, 192, 192);
                            if (itemData.filter !== 'none') {
                                applyPixelFilter(zctx, 192, 192, itemData.filter || 'remove-white');
                            }
                        };
                    }
                } else {
                    nameEl.textContent = '???';
                    zctx.fillStyle = '#8e44ad'; // 謎のシルエット
                    zctx.fillRect(0,0,24,24);
                    zctx.fillStyle = '#fff';
                    zctx.font = '16px DotGothic16, sans-serif';
                    zctx.textAlign = 'center';
                    zctx.textBaseline = 'middle';
                    zctx.fillText('?', 12, 12);
                }

                item.appendChild(can);
                item.appendChild(nameEl);
                itemGrid.appendChild(item);
            }
            zukanListEl.appendChild(itemGrid);
        }

        const celebrationOverlayEl = document.getElementById('celebrationOverlay');
        const celebrationTitleEl = document.getElementById('celebrationTitle');
        const celebrationMessageEl = document.getElementById('celebrationMessage');

        function showCelebration(reachedCount, options = {}) {
            celebrationTitleEl.textContent = options.title || `${reachedCount}回達成！`;
            
            // ランダムにメッセージを選択
            if (options.message) {
                celebrationMessageEl.innerHTML = options.message;
            } else {
                const randIdx = Math.floor(Math.random() * CELEBRATION_MESSAGES.length);
                celebrationMessageEl.innerHTML = CELEBRATION_MESSAGES[randIdx];
            }

            celebrationOverlayEl.classList.add('visible');
            
            playCelebrateSound(); // テスト音源の再生

            // 紙吹雪エフェクト (ドット風)
            // もっと派手な紙吹雪エフェクト (ドット風)
            for(let i=0; i<80; i++) {
                setTimeout(createConfetti, Math.random() * 500);
            }
            
            // 花火エフェクトをランダムな位置に時間差で打ち上げる
            for(let i=0; i<5; i++) {
                setTimeout(() => {
                    const x = 20 + Math.random() * 60; // 20%〜80%
                    const y = 20 + Math.random() * 40; // 20%〜60%
                    createPixelFirework(x, y);
                }, i * 300 + Math.random() * 200);
            }
            // skip old createConfetti block


        }

        function hideCelebration() {
            playButtonSound();
            celebrationOverlayEl.classList.remove('visible');
        }

        function createPixelFirework(xPos, yPos) {
            const container = document.getElementById('celebrationOverlay');
            if(!container) return;
            const colors = ['#ff4757', '#ffa502', '#2ed573', '#1e90ff', '#ff69b4', '#fff'];
            const color = colors[Math.floor(Math.random() * colors.length)];
            const particleCount = 20 + Math.floor(Math.random() * 15);
            
            for(let i=0; i<particleCount; i++) {
                const p = document.createElement('div');
                p.style.position = 'absolute';
                p.style.width = '6px';
                p.style.height = '6px';
                p.style.background = (Math.random() > 0.5) ? color : '#fff';
                p.style.left = xPos + '%';
                p.style.top = yPos + '%';
                p.style.pointerEvents = 'none';
                p.style.zIndex = '90';
                
                container.appendChild(p);
                
                const angle = Math.random() * Math.PI * 2;
                const speed = 2 + Math.random() * 4;
                const vx = Math.cos(angle) * speed;
                let vy = Math.sin(angle) * speed;
                
                let opacity = 1.0;
                
                function animate() {
                    opacity -= 0.02 + Math.random() * 0.02;
                    vy += 0.15; // 重力
                    
                    const currentLeft = parseFloat(p.style.left);
                    const currentTop = parseFloat(p.style.top);
                    
                    p.style.left = (currentLeft + vx * 0.2) + '%';
                    p.style.top = (currentTop + vy * 0.2) + '%';
                    p.style.opacity = opacity;
                    
                    if(opacity <= 0) {
                        p.remove();
                    } else {
                        requestAnimationFrame(animate);
                    }
                }
                requestAnimationFrame(animate);
            }
        }

        function createConfetti() {
            const colors = ['#ff4757', '#ffa502', '#2ed573', '#1e90ff', '#ff69b4', '#f1c40f'];
            const conf = document.createElement('div');
            conf.className = 'confetti';
            conf.style.background = colors[Math.floor(Math.random() * colors.length)];
            conf.style.left = Math.random() * 100 + '%';
            conf.style.top = '-5%';
            // より派手なサイズ感
            const size = Math.floor(Math.random() * 8) + 6; 
            conf.style.width = size + 'px';
            conf.style.height = size + 'px';
            conf.style.zIndex = '95';
            
            const container = document.getElementById('celebrationOverlay');
            if(container) container.appendChild(conf);

            const startTime = Date.now();
            const duration = 2500 + Math.random() * 1500;
            const horizontalVel = (Math.random() - 0.5) * 5;
            const rotateSpeed = (Math.random() - 0.5) * 10;
            let currentRot = 0;

            function fall() {
                const elapsed = Date.now() - startTime;
                const progress = elapsed / duration;
                if (progress >= 1) {
                    if(conf.parentNode) conf.remove();
                    return;
                }
                
                currentRot += rotateSpeed;
                const yPos = -5 + (progress * 110); 
                
                conf.style.top = yPos + '%';
                conf.style.left = (parseFloat(conf.style.left) + horizontalVel * 0.05) + '%';
                conf.style.transform = `rotate(${currentRot}deg)`;
                requestAnimationFrame(fall);
            }
            fall();
        }
        // --- アイテム獲得ポップアップ処理 ---
        const itemOverlayEl = document.getElementById('itemOverlay');
        const itemPopupNameEl = document.getElementById('itemPopupName');
        const itemPopupCanvas = document.getElementById('itemPopupCanvas');

        function createItemExplosion() {
            // ド派手な画面フラッシュ
            const flash = document.createElement('div');
            flash.style.position = 'absolute';
            flash.style.top = 0; flash.style.left = 0; flash.style.width = '100%'; flash.style.height = '100%';
            flash.style.background = 'white';
            flash.style.zIndex = 200;
            flash.style.pointerEvents = 'none';
            flash.style.animation = 'flashFade 0.8s ease-out forwards';
            document.getElementById('itemOverlay').appendChild(flash);
            setTimeout(() => flash.remove(), 800);

            // 大量の紙吹雪を高速で射出
            for(let i=0; i<80; i++) {
                setTimeout(createConfettiFast, Math.random() * 400); 
            }
        }
        
        function createConfettiFast() {
            const colors = ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#fff', '#FFD700'];
            const conf = document.createElement('div');
            conf.className = 'confetti';
            conf.style.background = colors[Math.floor(Math.random() * colors.length)];
            conf.style.left = Math.random() * 100 + '%';
            conf.style.top = '-10px';
            const size = Math.floor(Math.random() * 8) + 4; 
            conf.style.width = size + 'px';
            conf.style.height = size + 'px';
            if(Math.random() > 0.5) conf.style.borderRadius = '50%';
            
            const container = document.getElementById('itemOverlay');
            if(!container) return;
            container.appendChild(conf);

            const startTime = Date.now();
            const duration = 1200 + Math.random() * 800;
            const horizontalVel = (Math.random() - 0.5) * 8;

            function fall() {
                const elapsed = Date.now() - startTime;
                const progress = elapsed / duration;
                if (progress >= 1) { conf.remove(); return; }
                
                conf.style.top = (progress * progress * 300) + 'px';
                conf.style.left = (parseFloat(conf.style.left) + horizontalVel * 0.2) + '%';
                conf.style.transform = `rotate(${progress * 720}deg)`;
                
                requestAnimationFrame(fall);
            }
            requestAnimationFrame(fall);
        }

        function showItemPopup(itemId) {
            const itemObj = SECRET_ITEMS_DATA.find(i => i.id === itemId);
            if(!itemObj) return;

            itemPopupNameEl.textContent = itemObj.name;
            itemOverlayEl.classList.add('visible');
            
            playItemGetSound(); // すごいアイテムをゲットした超派手な音を鳴らす！

            // 未取得なら取得済みにする
            if (!unlockedItems.includes(itemId)) {
                unlockedItems.push(itemId);
                saveState();
            }
            
            // 初回・何度目に関わらずテスト用なので最高に派手な爆発を毎回出す
            createItemExplosion();

            // キャンバス描画
            const ictx = itemPopupCanvas.getContext('2d');
            itemPopupCanvas.width = 192;
            itemPopupCanvas.height = 192;
            ictx.clearRect(0, 0, 192, 192);
            if (itemObj.src) {
                const img = new Image();
                img.src = itemObj.src;
                img.onload = () => {
                    itemPopupCanvas.style.imageRendering = 'auto'; // 滑らかに縮小
                    ictx.filter = "none";
                    
                    const t = itemObj.trim || 0;
                    const sx = img.width * t;
                    const sy = img.height * t;
                    const sW = img.width * (1 - t * 2);
                    const sH = img.height * (1 - t * 2);
                    
                    ictx.drawImage(img, sx, sy, sW, sH, 0, 0, 192, 192);
                    if (itemObj.filter !== 'none') {
                        applyPixelFilter(ictx, 192, 192, 'remove-white');
                    }
                };
            }
        }

        function hideItemPopup() {
            playButtonSound();
            itemOverlayEl.classList.remove('visible');
        }

        function updateStatsList() {
            statsListEl.innerHTML = '';
            
            // 表示順（心のごはん画面用）
            const displayOrder = ['愛してます', 'ツイてる', 'うれしい', '楽しい', '感謝してます', 'しあわせ', 'ありがとう', 'ゆるします'];
            displayOrder.forEach(w => {
                let count = wordCounts[w];
                let row = document.createElement('div');
                row.className = 'stats-row';
                row.innerHTML = `<span style="font-size:1.8rem; font-weight:bold;">${w}</span><span style="font-size:1.8rem; font-weight:bold;">${count} 回</span>`;
                statsListEl.appendChild(row);
            });
        }

        function updateOyatsuList() {
            oyatsuListEl.innerHTML = '';
            let totalOyatsu = OYATSU_WORDS.reduce((sum, w) => sum + (wordCounts[w] || 0), 0);
            
            OYATSU_WORDS.forEach(w => {
                let count = wordCounts[w] || 0;
                let displayWord = w;
                if (w === 'だんだんよくなる未来はあかるい') displayWord = 'だんだんよくなる<br>未来はあかるい';
                else if (w === 'このことがダイヤモンドにかわります') displayWord = 'このことがダイヤ<br>モンドにかわります';
                else if (w === '宇宙の調和に感謝します') displayWord = '宇宙の調和に<br>感謝します';
                else if (w === 'もっと自分を愛しますもっと自分をゆるします') displayWord = '<span style=\'font-size: 1.25rem; white-space: nowrap; -webkit-text-stroke: 0.3px;\'>もっと自分を愛します<br>もっと自分をゆるします</span>';
                else if (w === 'どうでもいいどっちでもいいどうせうまくいくから') displayWord = '<span style=\'font-size: 1.25rem; white-space: nowrap; -webkit-text-stroke: 0.3px;\'>どうでもいい<br>どっちでもいい<br>どうせうまくいくから</span>';
                
                let row = document.createElement('div');
                row.className = 'stats-row';
                row.style.fontSize = '1.6rem';
                row.style.fontWeight = 'bold';
                row.style.lineHeight = '1.4';
                row.style.marginBottom = '8px';
                row.innerHTML = `<span style="flex:1; padding-right:5px; word-break:normal; white-space:normal;">${displayWord}</span><span style="white-space:nowrap; align-self:flex-start; margin-top:2px;">${count} 回</span>`;
                oyatsuListEl.appendChild(row);
            });

            // 魂のおやつ トータル回数
            let totalRow = document.createElement('div');
            totalRow.style.textAlign = 'center';
            totalRow.style.marginTop = '15px';
            totalRow.style.borderTop = '1px dashed var(--screen-shadow)';
            totalRow.style.paddingTop = '10px';
            totalRow.style.fontWeight = 'bold';
            totalRow.style.fontSize = '2.0rem';
            totalRow.textContent = `トータル: ${totalOyatsu} 回`;
            oyatsuListEl.appendChild(totalRow);

            // シークレットアイテムのヒント
            let hintRow = document.createElement('div');
            hintRow.style.textAlign = 'center';
            hintRow.style.marginTop = '10px';
            hintRow.style.fontSize = '1.2rem';
            hintRow.style.color = '#5a5a5a';
            hintRow.style.fontWeight = 'bold';
            hintRow.innerHTML = '※トータル1万回言うと<br>　何かが起こる！？';
            oyatsuListEl.appendChild(hintRow);
        }

        function resetGame() {
            playButtonSound();
            if(confirm("すべての育成データを削除して、タマゴからやり直しますか？")){
                currentStage = 0;
                currentForm = 'egg';
                totalCount = 0;
                allWords.forEach(w => wordCounts[w] = 0);
                intokuPower = 0;
                battleWins = 0;
                battleLosses = 0;
                isSick = false;
                sickRecoveryCount = 0;
                lastInteractionTimestamp = Date.now();
                finalEvolutionTimestamp = null;
                unlockedForms = ['egg'];
                unlockedItems = [];
                canvas.classList.remove('bouncing');
                statusTextEl.textContent = "マイクをオンにしてね";
                renderCanvasArt(currentForm, ctx);
                updateUI();
                closeOverlays();
                saveState();
            }
        }

        function recoverFromSick() {
            isSick = false;
            sickRecoveryCount = 0;
            lastInteractionTimestamp = Date.now();
            checkRebirth();
            saveState();

            playRecoveryEffect();
            
            statusTextEl.textContent = "全快しました！";
            renderCanvasArt(currentForm, ctx);
            updateUI();
        }

        function playRecoveryEffect() {
            if (!audioCtx) initAudio();
            if (!audioCtx) return;
            
            const now = audioCtx.currentTime;
            // 病気からの完全復活を祝う壮大なファンファーレ (BGM風)
            // タタタ、タハーン！タラランターン！
            const notes = [
                { f: 523.25, d: 0.15, start: 0.0 }, // C5
                { f: 523.25, d: 0.15, start: 0.2 }, // C5
                { f: 523.25, d: 0.15, start: 0.4 }, // C5
                { f: 659.25, d: 0.4,  start: 0.6 }, // E5
                { f: 587.33, d: 0.15, start: 1.1 }, // D5
                { f: 659.25, d: 0.15, start: 1.3 }, // E5
                { f: 783.99, d: 0.8,  start: 1.5 }  // G5
            ];
            
            notes.forEach(n => {
                playOscillator(n.f, now + n.start, n.d, 0.1, 'square');
                // ハーモニー
                playOscillator(n.f * 1.5, now + n.start, n.d, 0.05, 'triangle'); 
            });
            
            // ベース音で厚みを出す
            playOscillator(261.63, now + 0.6, 0.4, 0.08, 'sawtooth'); // C4
            playOscillator(392.00, now + 1.5, 0.8, 0.08, 'sawtooth'); // G4
            
            const screen = document.querySelector('.screen');
            if(!screen) return;

            // フラッシュ
            const flash = document.createElement('div');
            flash.style.position = 'absolute';
            flash.style.top = 0; flash.style.left = 0; flash.style.width = '100%'; flash.style.height = '100%';
            flash.style.background = 'white';
            flash.style.zIndex = 400;
            flash.style.pointerEvents = 'none';
            flash.style.animation = 'flashFade 0.5s ease-out forwards';
            screen.appendChild(flash);
            setTimeout(() => flash.remove(), 500);

            // 衝撃波（ショックウェーブ）リング
            const wave = document.createElement('div');
            wave.style.position = 'absolute';
            wave.style.left = '50%';
            wave.style.top = '50%';
            wave.style.width = '0px';
            wave.style.height = '0px';
            wave.style.border = '10px solid #f1c40f';
            wave.style.borderRadius = '50%';
            wave.style.transform = 'translate(-50%, -50%)';
            wave.style.zIndex = 398;
            wave.style.pointerEvents = 'none';
            wave.style.transition = 'all 0.5s cubic-bezier(0.1, 0.8, 0.3, 1)';
            screen.appendChild(wave);

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    wave.style.width = '450px';
                    wave.style.height = '450px';
                    wave.style.borderWidth = '0px';
                    wave.style.opacity = '0';
                });
            });
            setTimeout(() => wave.remove(), 500);

            // 画面全体に散らばる大量の紙吹雪
            for(let i=0; i<60; i++) {
                setTimeout(() => {
                    const colors = ['#2ecc71', '#f1c40f', '#fff', '#3498db', '#e74c3c'];
                    const conf = document.createElement('div');
                    conf.className = 'confetti';
                    conf.style.background = colors[Math.floor(Math.random() * colors.length)];
                    conf.style.left = '50%';
                    conf.style.top = '50%';
                    const size = Math.floor(Math.random() * 8) + 4; 
                    conf.style.width = size + 'px';
                    conf.style.height = size + 'px';
                    conf.style.borderRadius = (Math.random() > 0.5) ? '50%' : '0%';
                    conf.style.pointerEvents = 'none';
                    conf.style.zIndex = 399;
                    screen.appendChild(conf);

                    const startTime = Date.now();
                    const duration = 1200 + Math.random() * 800;
                    const angle = Math.random() * Math.PI * 2;
                    // 初速を非常に高くして画面全体に素早く広げる
                    const velocity = 60 + Math.random() * 60; 
                    const vx = Math.cos(angle) * velocity;
                    const vy = Math.sin(angle) * velocity;
                    const rotSpeed = (Math.random() - 0.5) * 10;

                    function animateConf() {
                        const elapsed = Date.now() - startTime;
                        const progress = elapsed / duration;
                        if (progress >= 1) { conf.remove(); return; }
                        
                        // 初速で一気に広がり、途中から失速する
                        const easeOut = 1 - Math.pow(1 - progress, 5); 
                        // 重力で少し落ちる
                        const gravity = progress * progress * 100;
                        
                        conf.style.top = `calc(50% + ${vy * easeOut + gravity}px)`;
                        conf.style.left = `calc(50% + ${vx * easeOut}px)`;
                        conf.style.transform = `translate(-50%, -50%) rotate(${progress * 360 * rotSpeed}deg)`;
                        conf.style.opacity = 1 - Math.pow(progress, 3); // 最後の方でスッと消える
                        
                        requestAnimationFrame(animateConf);
                    }
                    requestAnimationFrame(animateConf);
                }, Math.random() * 150); // ランダムな間隔でバラバラと発生
            }
        }


        // --- 音声認識 ---
        let isListening = false;
        let isStartingMic = false;
        const WebSpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        let webRecognition = null;
        let useNativeSpeech = window.Capacitor && window.Capacitor.isNativePlatform() && window.Capacitor.Plugins.SpeechRecognition;

        if (!useNativeSpeech && WebSpeechRecognition) {
            webRecognition = new WebSpeechRecognition();
            webRecognition.lang = 'ja-JP';
            webRecognition.continuous = true;
            webRecognition.interimResults = true;

            let lastResultIndex = -1;
            let interimMatchCounts = {};

            webRecognition.onstart = () => {
                isListening = true;
                micBtnEl.classList.add('mic-active');
                onMicrophoneStartedForTutorial();
            };

            webRecognition.onresult = (event) => {
                if (event.resultIndex !== lastResultIndex) {
                    interimMatchCounts = {};
                    lastResultIndex = event.resultIndex;
                }
                const currentResult = event.results[event.resultIndex];
                let transcript = currentResult[0].transcript;
                processTranscript(transcript, currentResult.isFinal, interimMatchCounts);
            };

            webRecognition.onerror = (e) => { stopMic(); };
            webRecognition.onend = () => {
                if (isListening) {
                    try { webRecognition.start(); } catch(e) {}
                } else {
                    micBtnEl.classList.remove('mic-active');
                    if(currentStage < 3) statusTextEl.textContent = "マイクがオフです";
                }
            };
        }

        // 共通の認識文字列処理
        let lastWordMatchTime = {};
        function processTranscript(rawTranscript, isFinal, interimMatchCounts) {
            let transcript = rawTranscript.replace(/[\s　、。！？,!?]/g, '');
            const sortedWords = [...allWords].sort((a, b) => b.length - a.length);

            sortedWords.forEach(w => {
                let pattern = w;
                if (WORD_ALIASES[w]) pattern = `(?:${w}|${WORD_ALIASES[w].join('|')})`;
                const regex = new RegExp(pattern, 'g');
                const matches = transcript.match(regex);
                
                const currentMatchCount = matches ? matches.length : 0;
                const previousMatchCount = interimMatchCounts[w] || 0;
                
                if (currentMatchCount > previousMatchCount) {
                    let now = Date.now();
                    const isOyatsu = OYATSU_WORDS.includes(w);
                    // 魂のおやつは4秒、通常の言霊は0.5秒の連続検知防止（二重カウント防止策）
                    const cooldown = isOyatsu ? 4000 : 500;
                    
                    if (!lastWordMatchTime[w] || (now - lastWordMatchTime[w] > cooldown)) {
                        addWordLog(w, currentMatchCount - previousMatchCount);
                        lastWordMatchTime[w] = now;
                    }
                    interimMatchCounts[w] = currentMatchCount;
                }
                
                if (matches) transcript = transcript.replace(regex, '');
            });

            const hasAnyMatchInSentence = Object.values(interimMatchCounts).some(v => v > 0);
            if (isFinal && !hasAnyMatchInSentence && currentStage < 3) {
                statusTextEl.textContent = "おしい";
            }
        }

        async function toggleMic() {
            playButtonSound();
            if (!useNativeSpeech && !webRecognition) return alert('この環境は音声認識に非対応です');
            if (isStartingMic) return;
            if(isListening) {
                stopMic();
            } else {
                isStartingMic = true;
                micBtnEl.classList.add('mic-starting');
                statusTextEl.textContent = 'マイク準備中...';

                try {
                    if (useNativeSpeech) {
                        const speechPlugin = window.Capacitor.Plugins.SpeechRecognition;
                        const permissionResult = await ensureNativeSpeechPermissions();
                        if (!permissionResult.granted) {
                            statusTextEl.textContent = permissionResult.message;
                            return;
                        }

                        const availability = await speechPlugin.available();
                        if (!availability.available) {
                            statusTextEl.textContent = '音声認識を開始できません。通信状態を確認して、もう一度試してください';
                            return;
                        }
                    }
                    await startMic();
                } catch (e) {
                    console.error('Speech recognition failed to start', e);
                    statusTextEl.textContent = getNativeSpeechErrorMessage(e);
                } finally {
                    isStartingMic = false;
                    micBtnEl.classList.remove('mic-starting');
                    if (!isListening) micBtnEl.classList.remove('mic-active');
                }
            }
        }

        let nativeInterimMatchCounts = {};
        let nativeListenersReady = false;
        let nativePermissionGranted = false;
        let nativePermissionState = {
            microphone: 'prompt',
            speechRecognition: 'prompt'
        };
        let nativePreparationPromise = null;

        function updateNativePermissionState(permissions = {}) {
            nativePermissionState = {
                microphone: permissions.microphone || 'prompt',
                speechRecognition: permissions.speechRecognition || 'prompt'
            };
            nativePermissionGranted = nativePermissionState.microphone === 'granted'
                && nativePermissionState.speechRecognition === 'granted';
            return nativePermissionState;
        }

        function getNativePermissionMessage(permissions = nativePermissionState) {
            if (permissions.microphone !== 'granted') {
                return permissions.microphone === 'denied'
                    ? '設定で「マイク」をオンにしてください'
                    : 'マイクの許可が必要です';
            }

            if (permissions.speechRecognition !== 'granted') {
                return permissions.speechRecognition === 'denied'
                    ? '設定で「音声認識」をオンにしてください'
                    : '音声認識の許可が必要です';
            }

            return '';
        }

        function getNativeSpeechErrorMessage(error) {
            const message = String(error?.message || error || '').toLowerCase();
            if (message.includes('microphone permission')) {
                return '設定で「マイク」をオンにしてください';
            }
            if (message.includes('speech recognition permission')) {
                return '設定で「音声認識」をオンにしてください';
            }
            if (message.includes('unavailable')) {
                return '音声認識を開始できません。通信状態を確認して、もう一度試してください';
            }
            return '音声認識を開始できませんでした。通信状態を確認して、もう一度試してください';
        }

        async function ensureNativeSpeechPermissions() {
            const speechPlugin = window.Capacitor.Plugins.SpeechRecognition;
            let permissions = updateNativePermissionState(await speechPlugin.checkPermissions());
            const needsPrompt = permissions.microphone === 'prompt'
                || permissions.speechRecognition === 'prompt';

            if (!nativePermissionGranted && needsPrompt) {
                permissions = updateNativePermissionState(await speechPlugin.requestPermissions());
            }

            return {
                granted: nativePermissionGranted,
                message: getNativePermissionMessage(permissions)
            };
        }

        async function prepareNativeSpeech() {
            if (!useNativeSpeech) return false;
            if (nativePreparationPromise) return nativePreparationPromise;

            nativePreparationPromise = (async () => {
                const speechPlugin = window.Capacitor.Plugins.SpeechRecognition;
                if (!nativeListenersReady) {
                    await speechPlugin.removeAllListeners();
                    await speechPlugin.addListener('partialResults', (data) => {
                        if (data && data.matches && data.matches.length > 0) {
                            processTranscript(data.matches[0], false, nativeInterimMatchCounts);
                        }
                    });
                    await speechPlugin.addListener('listeningState', (data) => {
                        if (data && data.status === 'started') {
                            isListening = true;
                            isStartingMic = false;
                            micBtnEl.classList.remove('mic-starting');
                            micBtnEl.classList.add('mic-active');
                            statusTextEl.textContent = 'ききとり中...';
                        } else if (data && data.status === 'stopped') {
                            isListening = false;
                            isStartingMic = false;
                            micBtnEl.classList.remove('mic-starting', 'mic-active');
                            if (currentStage < 3) statusTextEl.textContent = 'マイクがオフです';
                        }
                    });
                    nativeListenersReady = true;
                }

                const permissions = await speechPlugin.checkPermissions();
                updateNativePermissionState(permissions);
                return nativePermissionGranted;
            })().catch((error) => {
                nativePreparationPromise = null;
                nativeListenersReady = false;
                throw error;
            });

            return nativePreparationPromise;
        }
        
        async function startMic(){ 
            if (useNativeSpeech) {
                nativeInterimMatchCounts = {};
                const speechPlugin = window.Capacitor.Plugins.SpeechRecognition;
                await prepareNativeSpeech();
                await speechPlugin.start({
                    language: "ja-JP",
                    maxResults: 1,
                    prompt: "言霊を唱えてください",
                    partialResults: true,
                    popup: false
                });
                isListening = true;
                micBtnEl.classList.remove('mic-starting');
                micBtnEl.classList.add('mic-active');
                statusTextEl.textContent = 'ききとり中...';
                onMicrophoneStartedForTutorial();
                // ネイティブ音声入力開始で中断されたWeb Audioを戻す
                initAudio();
            } else if (webRecognition) {
                try{ webRecognition.start(); }catch(e){} 
            }
        }

        async function stopMic(){ 
            isListening = false; 
            isStartingMic = false;
            if (useNativeSpeech) {
                micBtnEl.classList.remove('mic-starting', 'mic-active');
                try {
                    await window.Capacitor.Plugins.SpeechRecognition.stop();
                } catch(e){}
            } else if (webRecognition) {
                webRecognition.stop(); 
            }
        }

        // --- UI用 ---
        function createTestButtons() {
            console.log("createTestButtons: Starting...");
            const container = document.getElementById('testBtns');
            if (!container) {
                console.error("createTestButtons: container 'testBtns' not found!");
                return;
            }
            container.innerHTML = ''; 
            
            // 各グループのボタン
            Object.entries(WORD_GROUPS).forEach(([groupKey, group]) => {
                const div = document.createElement('div');
                div.style.width = "100%";
                div.style.marginBottom = "8px";
                div.innerHTML = `<strong style="font-size:0.8rem;">${group.name}</strong><br>`;
                
                group.words.forEach(w => {
                    const btn = document.createElement('button');
                    btn.className = 'test-btn';
                    btn.textContent = `${w}`;
                    btn.onclick = () => { addWordLog(w, 100); };
                    div.appendChild(btn);
                });
                container.appendChild(div);
            });
            
            // 便利ボタンセクション
            console.log("createTestButtons: Adding utility section...");
            const div2 = document.createElement('div');
            div2.style.width = "100%";
            div2.style.marginTop = "12px";
            div2.style.padding = "5px";
            div2.style.border = "1px dashed #4A90E2";
            div2.style.borderRadius = "4px";
            div2.style.background = "#f0f7ff";
            div2.innerHTML = `<strong style="font-size:0.8rem; color:#4A90E2;">便利機能</strong><br>`;

            const jumpBtn = document.createElement('button');
            jumpBtn.className = 'test-btn';
            jumpBtn.style.background = '#ffdca8';
            jumpBtn.textContent = 'ランダム+1000回';
            jumpBtn.onclick = () => {
                let randWord = allWords[Math.floor(Math.random() * allWords.length)];
                addWordLog(randWord, 1000);
            };
            div2.appendChild(jumpBtn);

            const evolveBtn = document.createElement('button');
            evolveBtn.className = 'test-btn';
            evolveBtn.style.background = '#d1c4e9';
            evolveBtn.style.fontWeight = 'bold';
            evolveBtn.textContent = '1段階進化(テスト)';
            evolveBtn.onclick = () => {
                if (currentStage >= 3) {
                    alert("すでに最終形態（第3段階）です！");
                    return;
                }
                evolve(currentStage + 1);
            };
            div2.appendChild(evolveBtn);

            const test100Btn = document.createElement('button');
            test100Btn.className = 'test-btn';
            test100Btn.style.background = '#e1f5fe';
            test100Btn.textContent = '100回達成テスト';
            test100Btn.onclick = () => {
                let randWord = allWords[Math.floor(Math.random() * allWords.length)];
                addWordLog(randWord, 100);
            };
            div2.appendChild(test100Btn);
            
            const rebirthBtn = document.createElement('button');
            rebirthBtn.className = 'test-btn';
            rebirthBtn.style.background = '#e0f2f1';
            rebirthBtn.textContent = '転生テスト(たまごに戻る)';
            rebirthBtn.onclick = () => { reincarnate(); };
            div2.appendChild(rebirthBtn);

            const sickBtn = document.createElement('button');
            sickBtn.className = 'test-btn';
            sickBtn.style.background = '#ffb3b3';
            sickBtn.textContent = '72H放置(病気)';
            sickBtn.onclick = () => {
                lastInteractionTimestamp -= SICKNESS_DELAY_MS + 1000;
                saveState();
                location.reload();
            };
            div2.appendChild(sickBtn);

            const recoverBtn = document.createElement('button');
            recoverBtn.className = 'test-btn';
            recoverBtn.style.background = '#d4edda';
            recoverBtn.textContent = '回復エフェクト(テスト)';
            recoverBtn.onclick = () => {
                if (!isSick) isSick = true; // 強制的に病気扱いにする
                sickRecoveryCount = SICKNESS_RECOVERY_GOAL;
                recoverFromSick();
            };
            div2.appendChild(recoverBtn);

            const itemBtn1 = document.createElement('button');
            itemBtn1.className = 'test-btn';
            itemBtn1.style.background = '#e8daef';
            itemBtn1.textContent = '八咫鏡ゲット';
            itemBtn1.onclick = () => { showItemPopup('yata_no_kagami'); };
            div2.appendChild(itemBtn1);

            const itemBtn2 = document.createElement('button');
            itemBtn2.className = 'test-btn';
            itemBtn2.style.background = '#e8daef';
            itemBtn2.textContent = '草薙剣ゲット';
            itemBtn2.onclick = () => { showItemPopup('kusanagi_no_tsurugi'); };
            div2.appendChild(itemBtn2);

            const itemBtn3 = document.createElement('button');
            itemBtn3.className = 'test-btn';
            itemBtn3.style.background = '#e8daef';
            itemBtn3.textContent = '八尺瓊勾玉ゲット';
            itemBtn3.onclick = () => { showItemPopup('yasakani_no_magatama'); };
            div2.appendChild(itemBtn3);

            const itemBtn4 = document.createElement('button');
            itemBtn4.className = 'test-btn';
            itemBtn4.style.background = '#e8daef';
            itemBtn4.textContent = '宝珠ゲット';
            itemBtn4.onclick = () => { showItemPopup('houju'); };
            div2.appendChild(itemBtn4);

            const itemBtn5 = document.createElement('button');
            itemBtn5.className = 'test-btn';
            itemBtn5.style.background = '#e8daef';
            itemBtn5.textContent = '三鈷杵ゲット';
            itemBtn5.onclick = () => { showItemPopup('sankosho'); };
            div2.appendChild(itemBtn5);

            const itemBtn6 = document.createElement('button');
            itemBtn6.className = 'test-btn';
            itemBtn6.style.background = '#e8daef';
            itemBtn6.textContent = '神楽鈴ゲット';
            itemBtn6.onclick = () => { showItemPopup('kagurasuzu'); };
            div2.appendChild(itemBtn6);

            const battleBtn = document.createElement('button');
            battleBtn.className = 'test-btn';
            battleBtn.style.background = '#ffcccc';
            battleBtn.style.fontWeight = 'bold';
            battleBtn.style.color = '#c0392b';
            battleBtn.textContent = '通信対戦(テスト)';
            battleBtn.onclick = () => { startBattle(); };
            div2.appendChild(battleBtn);

            const battleMiracleBtn = document.createElement('button');
            battleMiracleBtn.className = 'test-btn';
            battleMiracleBtn.style.background = '#ffe066';
            battleMiracleBtn.style.fontWeight = 'bold';
            battleMiracleBtn.style.color = '#d35400';
            battleMiracleBtn.textContent = '通信対戦(奇跡100%)';
            battleMiracleBtn.onclick = () => { startBattle(true); };
            div2.appendChild(battleMiracleBtn);

            const stage5WinBtn = document.createElement('button');
            stage5WinBtn.className = 'test-btn';
            stage5WinBtn.style.background = '#f8c291';
            stage5WinBtn.style.fontWeight = 'bold';
            stage5WinBtn.textContent = '第5段階進化(成功)';
            stage5WinBtn.onclick = () => { 
                currentStage = 3; // テスト用に事前条件を合わせる
                evolve(4); 
            };
            div2.appendChild(stage5WinBtn);

            const stage5LoseBtn = document.createElement('button');
            stage5LoseBtn.className = 'test-btn';
            stage5LoseBtn.style.background = '#dcdde1';
            stage5LoseBtn.textContent = '第5段階進化(失敗)';
            stage5LoseBtn.onclick = () => {
                statusTextEl.textContent = "ドキドキ...";
                canvas.classList.add('bouncing');
                createEvolutionEffect(() => {
                    statusTextEl.textContent = "何かの気配がしたが...静まり返った";
                    canvas.classList.remove('bouncing');
                    setTimeout(() => checkRebirth(), 4000);
                }, true);
            };
            div2.appendChild(stage5LoseBtn);

            container.appendChild(div2);
            console.log("createTestButtons: Finished.");
        }

        // --- 通信対戦 (Battle) ロジック ---
        const battleOverlayEl = document.getElementById('battleOverlay');
        const battleFlashEl = document.getElementById('battleFlash');
        const battleVsScreenEl = document.getElementById('battleVsScreen');
        const battleArenaEl = document.getElementById('battleArena');
        const myHpBarEl = document.getElementById('myHpBar');
        const enemyHpBarEl = document.getElementById('enemyHpBar');
        const myCharEl = document.getElementById('myChar');
        const enemyCharEl = document.getElementById('enemyChar');
        const myCanvasCtx = document.getElementById('myCanvas').getContext('2d');
        const enemyCanvasCtx = document.getElementById('enemyCanvas').getContext('2d');
        // --- 音響エフェクト（バトル専用） ---
        const bgmFileList = [
            'maou_game_boss03.mp3',
            'maou_game_boss06.mp3',
            'maou_game_boss07.mp3',
            'maou_game_medley01.mp3',
            'maou_game_medley02.mp3'
        ];
        let currentBgmAudio = null;

        function startBattleBgm() {
            if (!soundEnabled) return;
            let randomBgmFile = bgmFileList[Math.floor(Math.random() * bgmFileList.length)];
            currentBgmAudio = new Audio(randomBgmFile);
            currentBgmAudio.loop = true;
            currentBgmAudio.volume = 0.15; // 音量を大幅に下げてSEを目立たせる
            // 自動再生ポリシー対策
            currentBgmAudio.play().catch(e => console.log('BGM Play Error:', e));
        }

        function stopBattleBgm() {
            if (currentBgmAudio) {
                currentBgmAudio.pause();
                currentBgmAudio.currentTime = 0;
                currentBgmAudio = null;
            }
        }

        function playFightSound() {
            if (!audioCtx) initAudio();
            const now = audioCtx.currentTime;
            for (let i = 0; i < 6; i++) {
                playOscillator(1760, now + i * 0.08, 0.05, 0.05, 'square');
            }
        }

        function playGogogogoSound() {
            if (!audioCtx) initAudio();
            const now = audioCtx.currentTime;
            
            // 雑音(ノイズ)ではなく、神聖なオーラがチャージされるような「ウオォォォーン」という上昇音
            
            // ベースの魔法チャージ音（低音から徐々に上がっていく）
            const oscBase = audioCtx.createOscillator();
            const gainBase = audioCtx.createGain();
            oscBase.type = 'triangle';
            oscBase.frequency.setValueAtTime(110, now); // A2
            oscBase.frequency.exponentialRampToValueAtTime(440, now + 1.5); // A4へ上昇
            gainBase.gain.setValueAtTime(0.01, now);
            gainBase.gain.linearRampToValueAtTime(0.25, now + 0.8);
            gainBase.gain.linearRampToValueAtTime(0.01, now + 1.5);
            oscBase.connect(gainBase);
            gainBase.connect(audioCtx.destination);
            oscBase.start(now);
            oscBase.stop(now + 1.5);

            // 響くオーラ音（高音のコーラス）
            const oscAura = audioCtx.createOscillator();
            const gainAura = audioCtx.createGain();
            oscAura.type = 'sine';
            oscAura.frequency.setValueAtTime(523.25, now); // C5
            oscAura.frequency.linearRampToValueAtTime(1046.5, now + 1.5); // C6へ
            gainAura.gain.setValueAtTime(0.01, now);
            gainAura.gain.linearRampToValueAtTime(0.15, now + 1.0);
            gainAura.gain.linearRampToValueAtTime(0.01, now + 1.5);
            oscAura.connect(gainAura);
            gainAura.connect(audioCtx.destination);
            oscAura.start(now);
            oscAura.stop(now + 1.5);
        }

        function playMiracleFlashSound() {
            if (!audioCtx) initAudio();
            const now = audioCtx.currentTime;
            playOscillator(2000, now, 0.1, 0.5, 'square');
            playOscillator(1000, now, 0.2, 0.5, 'square');
            for (let i = 0; i < 30; i++) {
                let f = 100 + Math.random() * 1000;
                let t = now + (Math.random() * 0.3);
                playOscillator(f, t, 0.1, 0.4, 'sawtooth');
            }
            playOscillator(40, now, 0.8, 0.6, 'square');
        }

        function playExplosionSound() {
            if (!audioCtx) initAudio();
            const now = audioCtx.currentTime;
            // バシャーン！というノイズと低音
            for (let i = 0; i < 20; i++) {
                let f = 100 + Math.random() * 800;
                let t = now + (Math.random() * 0.2);
                playOscillator(f, t, 0.05, 0.1, 'sawtooth');
            }
            playOscillator(60, now, 0.3, 0.3, 'square');
        }

        function playCriticalSound() {
            if (!audioCtx) initAudio();
            const now = audioCtx.currentTime;
            // ギャン！ズキューン！という鋭い高音＋大爆発
            for (let i = 0; i < 10; i++) {
                let f = 1500 - (i * 100); 
                let t = now + (i * 0.015);
                playOscillator(f, t, 0.05, 0.1, 'square');
            }
            for (let i = 0; i < 25; i++) {
                let f = 150 + Math.random() * 1000;
                let t = now + 0.1 + (Math.random() * 0.25);
                playOscillator(f, t, 0.05, 0.1, 'sawtooth');
            }
            playOscillator(50, now + 0.1, 0.4, 0.4, 'square');
        }

        function playButtonSound() {
            if (!soundEnabled) return;
            playWhenAudioReady((ctx) => {
                const now = ctx.currentTime + 0.01;
                playOscillator(880, now, 0.06, 0.14, 'square');
                playOscillator(1174.66, now + 0.045, 0.07, 0.10, 'square');
            });
        }

        function playWordPopSound() {
            playWhenAudioReady((ctx) => {
                const now = ctx.currentTime + 0.01;
                // 軽やかな「テロン♪」という音 (C5 -> E5)
                playOscillator(523.25, now, 0.10, 0.08, 'sine');
                playOscillator(659.25, now + 0.08, 0.18, 0.10, 'sine');
            });
        }

        function playTenPopSound() {
            playWhenAudioReady((ctx) => {
                const now = ctx.currentTime + 0.01;
                // 10回ごとの「テレレン♪」という音 (C5 -> E5 -> G5)
                playOscillator(523.25, now, 0.10, 0.08, 'sine');
                playOscillator(659.25, now + 0.08, 0.10, 0.09, 'sine');
                playOscillator(783.99, now + 0.16, 0.24, 0.11, 'sine');
            });
        }

        const battleMessageEl = document.getElementById('battleMessage');

        const battleBgList = [
            'Gemini_Generated_Image_2ht5i42ht5i42ht5.jpg',
            'Gemini_Generated_Image_5z0q9g5z0q9g5z0q.jpg',
            'Gemini_Generated_Image_9pseq69pseq69pse.jpg'
        ];

        let pendingChallengerData = null;
        let selectedBattleAction = null;
        let pendingBattleOptions = null;
        const ONLINE_BATTLE_API_URL = String(window.KOTODAMA_ONLINE_BATTLE_API_URL || '').replace(/\/$/, '');
        let onlineBattleSession = null;

        const BATTLE_ACTIONS = {
            attack: { label: '攻める！', message: '攻撃力が 35% アップ！' },
            guard: { label: '守る！', message: 'HPと回避率が アップ！' },
            pray: { label: '祈る！', message: '会心と神器の力が アップ！' }
        };

        function getOnlineBattleSnapshot() {
            const stats = getBattleStats();
            return {
                form: currentForm,
                hp: Math.min(5000, Math.max(100, Math.round(stats.hp))),
                attack: Math.min(1000, Math.max(10, Math.round(stats.attack))),
                evasionRate: Math.min(75, Math.max(0, Math.round(stats.evasionRate))),
                criticalRate: Math.min(75, Math.max(0, Math.round(stats.criticalRate))),
                wins: Math.min(99999, Math.max(0, Math.round(battleWins)))
            };
        }

        function onlineBattleStatus(message) {
            const status = document.getElementById('onlineBattleStatus');
            if (status) status.textContent = message;
        }

        function openOnlineBattleMenu() {
            playButtonSound();
            document.getElementById('pvpMainMenu').style.display = 'none';
            document.getElementById('onlineBattleMenu').style.display = 'flex';
            onlineBattleStatus(ONLINE_BATTLE_API_URL ? '部屋をつくるか、友だちのコードを入力してね。' : 'オンライン対戦サーバーを準備しています。');
        }

        function closeOnlineBattleMenu() {
            playButtonSound();
            document.getElementById('onlineBattleMenu').style.display = 'none';
            document.getElementById('pvpMainMenu').style.display = 'flex';
        }

        async function onlineBattleRequest(path, options = {}) {
            if (!ONLINE_BATTLE_API_URL) throw new Error('オンライン対戦サーバーの接続設定がまだありません。');
            const response = await fetch(`${ONLINE_BATTLE_API_URL}${path}`, {
                ...options,
                headers: { 'content-type': 'application/json', ...(options.headers || {}) }
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || '通信に失敗しました。');
            return payload;
        }

        async function createOnlineBattleRoom() {
            try {
                playButtonSound();
                onlineBattleStatus('部屋をつくっています…');
                const data = await onlineBattleRequest('/v1/rooms', {
                    method: 'POST', body: JSON.stringify({ snapshot: getOnlineBattleSnapshot() })
                });
                onlineBattleSession = { code: data.code, token: data.playerToken, seat: 'host', started: false, socket: null };
                const codeInput = document.getElementById('onlineBattleCode');
                if (codeInput) codeInput.value = data.code;
                onlineBattleStatus(`招待コード: ${data.code}\n友だちに伝えて、入室を待ってね。`);
                connectOnlineBattleSocket();
            } catch (error) {
                onlineBattleStatus(error.message || '部屋をつくれませんでした。');
            }
        }

        async function joinOnlineBattleRoom() {
            try {
                playButtonSound();
                const code = String(document.getElementById('onlineBattleCode')?.value || '').trim().toUpperCase();
                if (!/^[A-Z2-9]{6}$/.test(code)) throw new Error('6文字の招待コードを入力してね。');
                onlineBattleStatus('部屋に入っています…');
                const data = await onlineBattleRequest(`/v1/rooms/${code}`, {
                    method: 'POST', body: JSON.stringify({ snapshot: getOnlineBattleSnapshot() })
                });
                onlineBattleSession = { code, token: data.playerToken, seat: 'guest', started: false, socket: null };
                onlineBattleStatus('入室できたよ。対戦を始めます…');
                connectOnlineBattleSocket();
            } catch (error) {
                onlineBattleStatus(error.message || '入室できませんでした。');
            }
        }

        function connectOnlineBattleSocket() {
            if (!onlineBattleSession || !ONLINE_BATTLE_API_URL) return;
            const socketUrl = `${ONLINE_BATTLE_API_URL.replace(/^http/, 'ws')}/v1/rooms/${onlineBattleSession.code}/socket`;
            const socket = new WebSocket(socketUrl);
            onlineBattleSession.socket = socket;
            socket.addEventListener('open', () => socket.send(JSON.stringify({ type: 'auth', token: onlineBattleSession.token })));
            socket.addEventListener('message', (event) => handleOnlineBattleMessage(event));
            socket.addEventListener('close', () => {
                if (onlineBattleSession && !onlineBattleSession.finished) {
                    onlineBattleStatus('通信が切れました。もう一度、部屋へ入り直してね。');
                }
            });
            socket.addEventListener('error', () => onlineBattleStatus('通信を開始できませんでした。接続を確認してね。'));
        }

        function handleOnlineBattleMessage(event) {
            let message;
            try { message = JSON.parse(event.data); } catch { return; }
            if (!onlineBattleSession) return;
            if (message.type === 'error') return onlineBattleStatus(message.message || '通信エラーが起きました。');
            if (message.type === 'expired') {
                onlineBattleStatus('この部屋は期限切れです。新しい部屋をつくってね。');
                return;
            }
            if (message.type === 'room') {
                if (message.seat) onlineBattleSession.seat = message.seat;
                const room = message.room;
                if (room.phase === 'waiting') {
                    onlineBattleStatus(`招待コード: ${room.code}\n友だちの入室を待っています。`);
                } else if (room.phase === 'choosing' && !onlineBattleSession.started) {
                    startOnlineBattle(room);
                }
                return;
            }
            if (message.type === 'waiting') {
                battleMessageEl.textContent = '相手の作戦を待っています…';
                battleMessageEl.style.display = 'block';
                return;
            }
            if (message.type === 'result') {
                onlineBattleSession.finished = true;
                runOnlineBattleSequence(message.result, onlineBattleSession.seat);
            }
        }

        function startOnlineBattle(room) {
            const opponent = onlineBattleSession.seat === 'host' ? room.guest : room.host;
            if (!opponent) return;
            onlineBattleSession.started = true;
            startBattle(false, { f: opponent.form, w: opponent.wins, h: 100, a: 10, e: 5, c: 5 });
            if (pendingBattleOptions) pendingBattleOptions.online = true;
        }

        function submitOnlineBattleAction(action) {
            const socket = onlineBattleSession?.socket;
            if (!socket || socket.readyState !== WebSocket.OPEN) {
                battleMessageEl.textContent = '通信が切れました。対戦をやり直してね。';
                battleMessageEl.style.display = 'block';
                return;
            }
            socket.send(JSON.stringify({ type: 'choose', action }));
        }

        function runOnlineBattleSequence(result, seat) {
            const myRole = seat;
            const enemyRole = seat === 'host' ? 'guest' : 'host';
            const myMaxHp = result.maxHp[myRole];
            const enemyMaxHp = result.maxHp[enemyRole];
            let eventIndex = 0;
            battleMessageEl.style.display = 'none';

            const playNext = () => {
                const event = result.events[eventIndex];
                if (!event) {
                    const didWin = seat === 'host' ? result.hostWon : !result.hostWon;
                    finishBattle(didWin);
                    return;
                }
                eventIndex += 1;
                const isMyTurn = event.attacker === myRole;
                const attackerEl = isMyTurn ? myCharEl : enemyCharEl;
                const defenderEl = isMyTurn ? enemyCharEl : myCharEl;
                const atkClass = isMyTurn ? 'attack-mine' : 'attack-enemy';
                attackerEl.classList.add(atkClass);
                initAudio();
                playOscillator(150, audioCtx ? audioCtx.currentTime : 0, 0.12, 0.08, 'sawtooth');
                setTimeout(() => {
                    if (event.hit) {
                        defenderEl.classList.add('hit');
                        const arenaRect = battleArenaEl.getBoundingClientRect();
                        createHitFx(arenaRect.width / 2, arenaRect.height / 2);
                        createPopupText(event.critical ? `CRITICAL! ${event.damage}` : `-${event.damage}`, isMyTurn, event.critical);
                        if (event.critical) playCriticalSound(); else playExplosionSound();
                        setTimeout(() => defenderEl.classList.remove('hit'), 350);
                    } else {
                        defenderEl.classList.add('miss');
                        createPopupText('MISS!', isMyTurn, false);
                        setTimeout(() => defenderEl.classList.remove('miss'), 350);
                    }
                    myHpBarEl.style.width = `${Math.max(0, event.hp[myRole]) / myMaxHp * 100}%`;
                    enemyHpBarEl.style.width = `${Math.max(0, event.hp[enemyRole]) / enemyMaxHp * 100}%`;
                    setTimeout(() => attackerEl.classList.remove(atkClass), 250);
                    setTimeout(playNext, 850);
                }, 260);
            };
            playNext();
        }

        function startBattle(forceMiracle = false, challengerData = null) {
            closePvpMenu(); // メニューが開いていれば閉じる
            selectedBattleAction = null;
            pendingBattleOptions = { forceMiracle, challengerData };
            const battleCommandPanel = document.getElementById('battleCommandPanel');
            if (battleCommandPanel) battleCommandPanel.classList.remove('visible');

            // 背景をランダム設定
            let randomBg = battleBgList[Math.floor(Math.random() * battleBgList.length)];
            battleArenaEl.style.backgroundImage = `linear-gradient(rgba(255,255,255,0.7), rgba(255,255,255,0.6)), url('${randomBg}')`;

            // オーバーレイ表示
            battleOverlayEl.classList.add('visible');
            battleVsScreenEl.style.display = 'flex';
            battleArenaEl.style.display = 'none';
            battleFlashEl.classList.remove('active');
            battleMessageEl.style.display = 'none';
            
            // 初期状態リセット
            myCharEl.className = 'battle-character mine';
            enemyCharEl.className = 'battle-character enemy';

            const myAuraEl = document.getElementById('myAuraEffect');
            const enemyAuraEl = document.getElementById('enemyAuraEffect');
            if (myAuraEl) myAuraEl.className = 'aura-effect';
            if (enemyAuraEl) enemyAuraEl.className = 'aura-effect';

            // 自分のオーラ設定
            if (myAuraEl) {
                if (battleWins >= 100) myAuraEl.classList.add('aura-100');
                else if (battleWins >= 50) myAuraEl.classList.add('aura-50');
                else if (battleWins >= 10) myAuraEl.classList.add('aura-10');
            }
            // 敵のオーラ設定
            if (enemyAuraEl && challengerData && challengerData.w !== undefined) {
                if (challengerData.w >= 100) enemyAuraEl.classList.add('aura-100');
                else if (challengerData.w >= 50) enemyAuraEl.classList.add('aura-50');
                else if (challengerData.w >= 10) enemyAuraEl.classList.add('aura-10');
            }
            myHpBarEl.style.width = '100%';
            enemyHpBarEl.style.width = '100%';
            
            // キャラクター描画（敵は挑戦者データかランダム）
            let enemyKey;
            if (challengerData) {
                enemyKey = challengerData.f;
            } else {
                let allKeys = Object.keys(PIXEL_ARTS).filter(k => k !== 'egg' && !k.includes('sick'));
                enemyKey = allKeys[Math.floor(Math.random() * allKeys.length)];
            }
            renderCanvasArt(currentForm, myCanvasCtx);
            renderCanvasArt(enemyKey, enemyCanvasCtx);
            
            // ピコピコVS音
            initAudio();
            if (audioCtx && audioCtx.state === 'suspended') { audioCtx.resume(); }
            const offset = (audioCtx && (audioCtx.state === 'suspended' || audioCtx.currentTime < 0.1)) ? 0.05 : 0;
            const now = audioCtx ? audioCtx.currentTime + offset : 0;
            for(let i=0; i<6; i++) {
                if(i%2===0) playOscillator(880, now + (i*0.1), 0.1, 0.1, 'square');
                else playOscillator(1760, now + (i*0.1), 0.1, 0.1, 'square');
            }
            // 決定音
            playOscillator(1318.51, now + 0.8, 0.5, 0.2, 'square'); // E6
            
            setTimeout(() => {
                // VS画面消去＆アリーナ表示＆フラッシュ
                battleVsScreenEl.style.display = 'none';
                battleArenaEl.style.display = 'block';
                battleFlashEl.classList.add('active');
                
                // バトル開始メッセージ
                battleMessageEl.textContent = 'FIGHT!!';
                battleMessageEl.style.color = '#ff2a00';
                battleMessageEl.style.display = 'block';
                
                playFightSound();
                
                // バトルBGM再生開始
                startBattleBgm();
                
                setTimeout(() => {
                    battleMessageEl.textContent = '作戦をえらぼう！';
                    battleMessageEl.style.color = 'var(--screen-text)';
                    battleMessageEl.style.fontSize = '1.15rem';
                    battleMessageEl.style.top = '25%';
                    battleFlashEl.classList.remove('active');
                    if (battleCommandPanel) battleCommandPanel.classList.add('visible');
                }, 1000);
            }, 2000);
        }

        function chooseBattleAction(action) {
            if (!BATTLE_ACTIONS[action] || selectedBattleAction || !pendingBattleOptions) return;

            playButtonSound();
            selectedBattleAction = action;
            const options = pendingBattleOptions;
            pendingBattleOptions = null;

            const battleCommandPanel = document.getElementById('battleCommandPanel');
            if (battleCommandPanel) battleCommandPanel.classList.remove('visible');

            const actionInfo = BATTLE_ACTIONS[action];
            battleMessageEl.innerHTML = `${actionInfo.label}<br><span style="font-size:0.72rem">${actionInfo.message}</span>`;
            battleMessageEl.style.color = '#ff2a00';
            battleMessageEl.style.fontSize = '1.6rem';
            battleMessageEl.style.top = '50%';
            battleMessageEl.style.display = 'block';

            if (options.online) {
                setTimeout(() => {
                    battleMessageEl.textContent = '相手の作戦を待っています…';
                    battleMessageEl.style.color = 'var(--screen-text)';
                    battleMessageEl.style.fontSize = '1.1rem';
                    battleMessageEl.style.display = 'block';
                    submitOnlineBattleAction(action);
                }, 900);
                return;
            }

            setTimeout(() => {
                battleMessageEl.style.display = 'none';
                runBattleSequence(options.forceMiracle, options.challengerData, action);
            }, 900);
        }

        function createHitFx(x, y) {
            const fx = document.createElement('div');
            fx.className = 'hit-fx';
            fx.style.left = x + 'px';
            fx.style.top = y + 'px';
            battleArenaEl.appendChild(fx);
            
            // ピカッと画面を光らせる
            battleFlashEl.style.animation = 'none'; // リセット用
            void battleFlashEl.offsetWidth;         // リフロー強制
            battleFlashEl.style.animation = 'flashAnim 0.15s ease-out';
            
            setTimeout(() => {
                fx.remove();
            }, 400);
        }

        function createPopupText(text, isMySide, isCritical) {
            const popup = document.createElement('div');
            popup.className = 'battle-popup-text';
            popup.textContent = text;
            
            // 表示位置: キャラの少し近く
            // 自分は左下、敵は右上なのでそれら付近に寄せる
            if (isMySide) {
                // 自キャラ(左下)の少し上
                popup.style.bottom = '80px';
                popup.style.left = '10px';
            } else {
                // 敵キャラ(右上)の少し下
                popup.style.top = '80px';
                popup.style.right = '10px';
            }
            
            if (isCritical) {
                popup.style.color = '#ff2a00';
                popup.style.textShadow = '2px 2px 0 #fff, -2px -2px 0 #fff, 0 0 8px #ffea00';
                popup.style.fontSize = '1.3rem';
            } else {
                // 回避
                popup.style.color = '#3498db'; 
            }
            
            battleArenaEl.appendChild(popup);
            setTimeout(() => popup.remove(), 800);
        }

        function runBattleSequence(forceMiracle = false, challengerData = null, battleAction = 'attack') {
            let myStats = getBattleStats();
            let enemyStats = challengerData ? {
                hp: challengerData.h,
                attack: challengerData.a,
                evasionRate: challengerData.e,
                criticalRate: challengerData.c
            } : getEnemyStats(myStats);

            if (battleAction === 'attack') {
                myStats.attack = Math.max(1, Math.round(myStats.attack * 1.35));
            } else if (battleAction === 'guard') {
                myStats.hp = Math.max(1, Math.round(myStats.hp * 1.4));
                myStats.evasionRate = Math.min(70, myStats.evasionRate + 10);
            } else if (battleAction === 'pray') {
                myStats.criticalRate = Math.min(80, myStats.criticalRate + 15);
            }
            
            let myMaxHp = myStats.hp;
            let enemyMaxHp = enemyStats.hp;
            let myHp = myMaxHp;
            let enemyHp = enemyMaxHp;
            
            let turnCount = 0;
            const maxTurns = 8;
            let isBattleOver = false;

            function executeTurn() {
                if (isBattleOver) return;

                turnCount++;
                if (myHp <= 0 || enemyHp <= 0 || turnCount > maxTurns) {
                    isBattleOver = true;
                    const myHpRatio = myMaxHp > 0 ? myHp / myMaxHp : 0;
                    const enemyHpRatio = enemyMaxHp > 0 ? enemyHp / enemyMaxHp : 0;
                    finishBattle(myHpRatio >= enemyHpRatio);
                    return;
                }
                
                let isMyTurn = Math.random() > 0.5;
                let attackerEl = isMyTurn ? myCharEl : enemyCharEl;
                let defenderEl = isMyTurn ? enemyCharEl : myCharEl;
                let atkClass = isMyTurn ? 'attack-mine' : 'attack-enemy';
                
                let attackerStats = isMyTurn ? myStats : enemyStats;
                let defenderStats = isMyTurn ? enemyStats : myStats;
                
                setTimeout(() => {
                    attackerEl.classList.add(atkClass);
                    
                    initAudio();
                    const now = audioCtx ? audioCtx.currentTime : 0;
                    playOscillator(150, now, 0.15, 0.1, 'sawtooth');
                    
                    setTimeout(() => {
                        // 命中判定（基本100% から相手の回避率を引く）
                        let hit = Math.random() > (defenderStats.evasionRate / 100); 
                        // クリティカル判定（命中時に攻撃側の会心率を参照）
                        let critical = hit && (Math.random() < (attackerStats.criticalRate / 100)); 
                        // ダメージ計算（基本攻撃力 + ランダム0〜20）
                        let dmg = attackerStats.attack + Math.floor(Math.random() * 20);

                            let triggeredItem = null;
                            const availableItems = forceMiracle ? SECRET_ITEMS_DATA.map(i => i.id) : unlockedItems;
                            
                            // ピンチ判定: 相手のHP割合が自分のHP割合より50%以上多い場合
                            let myHpRatio = myMaxHp > 0 ? myHp / myMaxHp : 0;
                            let enemyHpRatio = enemyMaxHp > 0 ? enemyHp / enemyMaxHp : 0;
                            let isPinch = (enemyHpRatio - myHpRatio) >= 0.5;

                            // 発動確率は通常3%（テスト時は100%）。ピンチ時は20%に跳ね上がる
                            let probability = forceMiracle ? 1.0 : (isPinch ? 0.20 : 0.03);
                            if (!forceMiracle && battleAction === 'pray') {
                                probability = Math.min(0.45, probability * 3);
                            }
                            
                            if (availableItems.length > 0 && Math.random() < probability) {
                            if (isMyTurn) {
                                const attackerItems = availableItems.filter(i => ['kusanagi_no_tsurugi', 'houju', 'sankosho', 'yasakani_no_magatama'].includes(i));
                                if (attackerItems.length > 0) {
                                    triggeredItem = attackerItems[Math.floor(Math.random() * attackerItems.length)];
                                }
                            } else {
                                const defenderItems = availableItems.filter(i => ['yata_no_kagami', 'kagurasuzu'].includes(i));
                                if (defenderItems.length > 0) {
                                    triggeredItem = defenderItems[Math.floor(Math.random() * defenderItems.length)];
                                }
                            }
                        }

                        // アイテムによる回復や反射のパラメータ
                        let healAmount = 0;
                        let reflectItem = false;

                        // ダメージとUI更新のクロージャ
                        const applyDamageAndNextTurn = () => {
                            if (hit) {
                                defenderEl.classList.add('hit');
                                let arenaRect = battleArenaEl.getBoundingClientRect();
                                createHitFx(arenaRect.width / 2, arenaRect.height / 2);
                                
                                if (critical) {
                                    if (!triggeredItem) {
                                        dmg = Math.floor(dmg * 1.5);
                                        createPopupText('クリティカル!!', !isMyTurn, true);
                                    }
                                    playCriticalSound();
                                } else {
                                    playExplosionSound(); 
                                }

                                if (isMyTurn) enemyHp = Math.max(0, enemyHp - dmg);
                                else myHp = Math.max(0, myHp - dmg);
                                
                                myHpBarEl.style.width = (myHp / myMaxHp * 100) + '%';
                                enemyHpBarEl.style.width = (enemyHp / enemyMaxHp * 100) + '%';
                                
                                setTimeout(() => defenderEl.classList.remove('hit'), 400);
                            } else {
                                if (!triggeredItem) {
                                    defenderEl.classList.add('miss');
                                    createPopupText('回避！', !isMyTurn, false);
                                    playOscillator(800, audioCtx ? audioCtx.currentTime : 0, 0.2, 0.1, 'sine');
                                    setTimeout(() => defenderEl.classList.remove('miss'), 500);
                                }
                            }
                            
                            // 回復や反射のUI反映（カットインの直後に表示される）
                            if (healAmount > 0) {
                                myHp = Math.min(myMaxHp, myHp + healAmount);
                                myHpBarEl.style.width = (myHp / myMaxHp * 100) + '%';
                                defenderEl.classList.add('miss'); // 攻撃を回避したかのように扱う
                                setTimeout(() => defenderEl.classList.remove('miss'), 500);
                            }
                            if (reflectItem) {
                                // 自分(defenderEl)が反射、敵(enemyCharEl)にダメージ
                                enemyHp = Math.max(0, enemyHp - dmg);
                                enemyHpBarEl.style.width = (enemyHp / enemyMaxHp * 100) + '%';
                                enemyCharEl.classList.add('hit');
                                setTimeout(() => enemyCharEl.classList.remove('hit'), 400);
                                defenderEl.classList.add('miss'); // 自分のダメージは0
                                setTimeout(() => defenderEl.classList.remove('miss'), 500);
                            }
                            
                            setTimeout(() => attackerEl.classList.remove(atkClass), 300);

                            // 次のターンの呼び出し
                            setTimeout(executeTurn, 1200);
                        };

                        if (triggeredItem) {
                            // バトル進行を一旦ストップしてカットインへ
                            const cutinOverlay = document.getElementById('miracleCutinOverlay');
                            const cutinContent = document.getElementById('miracleCutinContent');
                            const cutinName = document.getElementById('miracleCutinName');
                            const cutinCanvas = document.getElementById('miracleCutinCanvas');
                            const cutinFlash = document.getElementById('miracleCutinFlash');
                            
                            cutinOverlay.style.display = 'flex';
                            cutinContent.classList.remove('show');
                            cutinFlash.classList.remove('active');
                            
                            // アイテム描画
                            const itemData = SECRET_ITEMS_DATA.find(i => i.id === triggeredItem);
                            if (itemData) {
                                const cctx = cutinCanvas.getContext('2d');
                                const img = new Image();
                                img.src = itemData.src;
                                img.onload = () => {
                                    cctx.clearRect(0,0,192,192);
                                    cctx.filter = "none";
                                    const t = itemData.trim || 0;
                                    const sx = img.width * t;
                                    const sy = img.height * t;
                                    const sW = img.width * (1 - t * 2);
                                    const sH = img.height * (1 - t * 2);
                                    cctx.drawImage(img, sx, sy, sW, sH, 0, 0, 192, 192);
                                    applyPixelFilter(cctx, 192, 192, 'remove-white');
                                };
                            }

                            playGogogogoSound(); // 地鳴り
                            
                            // ゴゴゴゴタメ時間 (1.0sec)
                            setTimeout(() => {
                                cutinContent.classList.add('show');
                                
                                let miracleText = "";
                                switch (triggeredItem) {
                                    case 'kusanagi_no_tsurugi': miracleText = "【草薙剣】神撃！"; hit = true; critical = true; dmg *= 3; break;
                                    case 'houju': miracleText = "【宝珠】奇跡の一手！"; hit = true; critical = true; dmg += attackerStats.attack * 2; break; // 固定30ではなく攻撃力依存へ
                                    case 'sankosho': miracleText = "【三鈷杵】雷撃！"; hit = true; critical = true; dmg = attackerStats.attack * 5; break; // 固定80からスケーリングへ
                                    case 'yasakani_no_magatama': 
                                        miracleText = "【八尺瓊勾玉】治癒！"; 
                                        hit = false; // 攻撃の代わりの回復行動
                                        healAmount = Math.floor(myMaxHp * 0.5); 
                                        break;
                                    case 'yata_no_kagami':
                                        miracleText = "【八咫鏡】反射！"; 
                                        hit = false; 
                                        reflectItem = true;
                                        break;
                                    case 'kagurasuzu':
                                        miracleText = "【神楽鈴】清め！"; 
                                        hit = false; 
                                        healAmount = Math.floor(myMaxHp * 0.3);
                                        break;
                                }
                                cutinName.textContent = miracleText;

                                // ボーン！バチーン！発動時間 (1.5sec後)
                                setTimeout(() => {
                                    cutinFlash.classList.add('active');
                                    playMiracleFlashSound();

                                    // さらにちょっと待ってから背景消して通常画面のダメージフェーズへ
                                    setTimeout(() => {
                                        cutinOverlay.style.display = 'none';
                                        
                                        // 画面に戻った直後にド派手ポップアップ
                                        const popup = document.createElement('div');
                                        popup.className = 'battle-popup-text';
                                        popup.textContent = miracleText;
                                        popup.style.color = '#fff600';
                                        popup.style.textShadow = '2px 2px 0 #cc5500, -2px -2px 0 #cc5500, 0 0 10px #ffff00';
                                        popup.style.fontSize = '1.5rem';
                                        popup.style.top = '40%';
                                        popup.style.left = '50%';
                                        popup.style.transform = 'translate(-50%, -50%)';
                                        popup.style.zIndex = '300';
                                        battleArenaEl.appendChild(popup);
                                        setTimeout(() => popup.remove(), 1200);

                                        applyDamageAndNextTurn();
                                    }, 400);
                                }, 1500);
                            }, 500);

                        } else {
                            // 通常攻撃
                            applyDamageAndNextTurn();
                        }
                    }, 350);
                }, 500);
            }

            // 初回をキック
            setTimeout(executeTurn, 1000);
        }

        function finishBattle(isWin) {
            stopBattleBgm(); // バトル終了時にBGMを止める
            const battleCommandPanel = document.getElementById('battleCommandPanel');
            if (battleCommandPanel) battleCommandPanel.classList.remove('visible');
            pendingBattleOptions = null;
            setupBattleMessage(isWin);
            
            if (isWin) {
                battleWins++;
                myCharEl.classList.add('win');
                enemyCharEl.classList.add('lose');
                playCelebrateSound(); // 勝利のファンファーレ
            } else {
                battleLosses++;
                myCharEl.classList.add('lose');
                enemyCharEl.classList.add('win');
                // 敗北のファンファーレ
                initAudio();
                const now = audioCtx ? audioCtx.currentTime : 0;
                playOscillator(300, now, 0.4, 0.2, 'sawtooth');
                playOscillator(200, now + 0.4, 0.4, 0.2, 'sawtooth');
                playOscillator(100, now + 0.8, 1.0, 0.3, 'sawtooth');
            }
            
            saveState(); // 勝敗を保存
            updateUI(); // メイン画面の戦績を更新
            
            setTimeout(() => {
                // バトル終了、元に戻る
                battleOverlayEl.classList.remove('visible');
                myCharEl.className = 'battle-character mine';
                enemyCharEl.className = 'battle-character enemy';
                selectedBattleAction = null;
                
                // キャンバスのアニメーションタイマーを停止して軽くする
                if (myCanvasCtx.canvas.animTimer) clearInterval(myCanvasCtx.canvas.animTimer);
                if (enemyCanvasCtx.canvas.animTimer) clearInterval(enemyCanvasCtx.canvas.animTimer);
            }, 4000);
        }

        function setupBattleMessage(isWin) {
            battleMessageEl.textContent = isWin ? 'YOU WIN!!' : 'YOU LOSE...';
            battleMessageEl.style.color = isWin ? '#ff4757' : '#2f3640';
            battleMessageEl.style.textShadow = isWin 
                ? '2px 2px 0px #fff, -2px -2px 0px #fff, 0 0 15px #f1c40f' 
                : '2px 2px 0px #fff, -2px -2px 0px #fff';
            battleMessageEl.style.display = 'block';
        }

        // --- CPU戦メニュー ---
        function openPvpMenu() {
            playButtonSound();

            // 他のメニューを閉じる
            closeOverlays();
            const intokuOverlay = document.getElementById('intokuOverlay');
            if(intokuOverlay) intokuOverlay.classList.remove('visible');

            document.getElementById('pvpMenuOverlay').classList.add('visible');
            document.getElementById('pvpMainMenu').style.display = 'flex';
            document.getElementById('onlineBattleMenu').style.display = 'none';
        }

        function closePvpMenu() {
            playButtonSound();
            document.getElementById('pvpMenuOverlay').classList.remove('visible');
        }

        // --- 陰徳システム ---
        function openIntokuModal() {
            playButtonSound();

            // 他のメニューを閉じる
            closeOverlays();
            const pvpOverlay = document.getElementById('pvpMenuOverlay');
            if(pvpOverlay) pvpOverlay.classList.remove('visible');

            const overlay = document.getElementById('intokuOverlay');
            if (overlay) overlay.classList.add('visible');
        }

        function closeIntokuModal() {
            playButtonSound();
            const overlay = document.getElementById('intokuOverlay');
            if (overlay) overlay.classList.remove('visible');
        }

        function playIntokuSound() {
            if (!audioCtx) return;
            if (audioCtx.state === 'suspended') { audioCtx.resume(); }
            const offset = (audioCtx.state === 'suspended' || audioCtx.currentTime < 0.1) ? 0.05 : 0;
            const t = audioCtx.currentTime + offset;
            
            // 少し神秘的な和音のチャイム（ポワァン...）
            const freqs = [880, 1108.73, 1318.51, 1760]; // A5, C#6, E6, A6 (A major chord)
            
            freqs.forEach((freq, i) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                
                osc.type = 'sine';
                osc.frequency.value = freq;
                
                gain.gain.setValueAtTime(0, t + i * 0.05);
                gain.gain.linearRampToValueAtTime(0.15, t + i * 0.05 + 0.1);
                gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.05 + 2.0);
                
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                
                osc.start(t + i * 0.05);
                osc.stop(t + i * 0.05 + 2.0);
            });
        }

        function confirmIntoku() {
            if (!audioCtx) initAudio();
            
            // モーダルを閉じる
            closeIntokuModal();
            
            // 陰徳ポイント加算
            intokuPower++;
            saveState();
            updateUI();
            
            // 効果音
            playIntokuSound();
            
            // 軽い演出（キャラクターを少し光らせる）
            const canvas = document.getElementById('pixelCanvas');
            if (canvas) {
                canvas.style.transition = 'filter 0.5s';
                canvas.style.filter = 'drop-shadow(0 0 15px #f1c40f) brightness(1.2)';
                setTimeout(() => {
                    canvas.style.filter = 'drop-shadow(2px 2px 0px rgba(15, 56, 15, 0.4))';
                }, 1500);
            }
        }

        function preventViewportZoom() {
            const cancelZoomGesture = (event) => event.preventDefault();
            ['gesturestart', 'gesturechange', 'gestureend'].forEach(eventName => {
                document.addEventListener(eventName, cancelZoomGesture, { passive: false });
            });

            document.addEventListener('touchmove', event => {
                if (event.touches.length > 1) event.preventDefault();
            }, { passive: false });

            let lastTouchEnd = 0;
            document.addEventListener('touchend', event => {
                const now = Date.now();
                if (now - lastTouchEnd < 320) event.preventDefault();
                lastTouchEnd = now;
            }, { passive: false });
        }

        // 初回ロード
        window.onload = () => {
            preventViewportZoom();
            init();
        };

document.addEventListener('DOMContentLoaded', () => { const btn = document.getElementById('closeZukanDetailBtn'); if(btn) btn.addEventListener('click', () => { playButtonSound(); document.getElementById('zukanDetailOverlay').classList.remove('visible'); }); });
