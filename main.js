// 3つのグループと対象ワード
        const WORD_GROUPS = {
            A: { name: "愛情・受容", words: ['愛してます', 'ゆるします', 'ありがとう'] },
            B: { name: "喜び・快活", words: ['うれしい', '楽しい'] }, 
            C: { name: "感謝・幸運", words: ['感謝してます', 'しあわせ', 'ツイてる'] }
        };

        // 音声認識のゆらぎ吸収用（漢字変換や送り仮名の違いをカバー）
        const WORD_ALIASES = {
            '愛してます': ['愛しています', 'あいしています', 'あいしてます', '愛します'],
            'ゆるします': ['許します', '赦します'],
            'ありがとう': ['有難う', '有難うございます', 'ありがとうございます', 'ありがと'],
            'うれしい': ['嬉しい'],
            '楽しい': ['たのしい', '楽し'],
            '感謝してます': ['感謝しています', '感謝', 'かんしゃしてます'],
            'しあわせ': ['幸せ', '仕合わせ'],
            'ツイてる': ['ついてる', '付いてる', 'ツキがある'],
            
            // 魂のおやつ（長い言霊）のゆらぎ吸収
            'このことがダイヤモンドにかわります': ['この事がダイヤモンドに変わります', 'このことがダイヤモンドに変わります', 'この事がダイヤモンドにかわります'],
            'だんだんよくなる未来はあかるい': ['だんだん良くなる未来は明るい', '段々良くなる未来は明るい', 'だんだんよくなる未来は明るい'],
            '自分はすごいんだ': ['自分は凄いんだ'],
            'もっと自分を愛しますもっと自分をゆるします': ['もっと自分を愛しますもっと自分を許します', 'もっと自分を愛しますもっと自分を赦します'],
            'どうでもいいどっちでもいいどうせうまくいくから': ['どうでもいいどっちでもいいどうせ上手くいくから', 'どうでもいいどっちでもいいどうせ上手く行くから']
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
            childA: { type: 'image', src: '多邇具久.jpg', frames: 3, speed: 800, trim: 0.05, trimY: 0.05 },
            // Aルート：多邇具久っち（病気状態）
            childA_sick: { type: 'image', src: '多邇具久（病気）.jpg', frames: 3, speed: 1000, trim: 0.05, trimY: 0.05 },
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

        function getEnemyStats(myTotalCount) {
            let stats = {
                hp: 100,
                attack: 10,
                evasionRate: 5,
                criticalRate: 5
            };
            
            // 自分のごはんと同レベル〜やや強い/弱い敵を作る (0.8x 〜 1.2x)
            let enemyScore = Math.floor(myTotalCount * (0.8 + Math.random() * 0.4));
            
            // ポイントを4つのステータスにランダム配分
            let pDef = Math.random();
            let pAtk = Math.random();
            let pEva = Math.random();
            let pCrit = Math.random();
            let sum = pDef + pAtk + pEva + pCrit;
            
            let defScore = Math.floor(enemyScore * (pDef / sum));
            let atkScore = Math.floor(enemyScore * (pAtk / sum));
            let evaScore = Math.floor(enemyScore * (pEva / sum));
            let critScore = Math.floor(enemyScore * (pCrit / sum));
            
            stats.hp += defScore * 2;
            stats.attack += atkScore * 1;
            stats.evasionRate = Math.min(stats.evasionRate + (evaScore * 0.2), 50);
            stats.criticalRate = Math.min(stats.criticalRate + (critScore * 0.2), 50);
            
            return stats;
        }

        function saveState() {
            const state = {
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
            localStorage.setItem('kotodama_state', JSON.stringify(state));
        }

        function loadState() {
            try {
                const saved = localStorage.getItem('kotodama_state');
                if (saved) {
                    const state = JSON.parse(saved);
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

                    // 24時間（86400000ミリ秒）以上経過していたら病気にする
                    const now = Date.now();
                    if (now - lastInteractionTimestamp > 86400000 && !isSick) {
                        isSick = true;
                        sickRecoveryCount = 0;
                    }
                }
            } catch (e) {
                console.error("Failed to load state:", e);
            }
        }

        // --- 転生ロジック ---
        function checkRebirth() {
            if (finalEvolutionTimestamp) {
                const now = Date.now();
                if (currentStage === 3) {
                    // 第4段階：3日（3 * 24 * 60 * 60 * 1000 = 259,200,000 ミリ秒）経過で転生
                    if (now - finalEvolutionTimestamp >= 259200000) {
                        reincarnate();
                    }
                } else if (currentStage === 4) {
                    // 第5段階（シークレット）：寿命を1日延ばし、4日（4 * 24 * 60 * 60 * 1000 = 345,600,000 ミリ秒）経過で転生
                    if (now - finalEvolutionTimestamp >= 345600000) {
                        reincarnate();
                    }
                }
            }
        }

        function reincarnate() {
            const overlay = document.getElementById('rebirthOverlay');
            if(!overlay) return;
            
            // 転生サウンドと暗転開始
            playRebirthSound();
            overlay.classList.add('active');
            
            // 3秒後（完全に真っ黒になった瞬間）にデータをリセット
            setTimeout(() => {
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
                statusTextEl.textContent = "ふたたび たまごになった...";
                
                // ゆっくり明転させる
                overlay.classList.remove('active');
            }, 3000);
        }

        // --- 描画ロジック ---
        function init() {
            loadState();
            checkRebirth();
            if (isSick) {
                statusTextEl.textContent = "具合が悪そうです...";
            }
            renderCanvasArt(currentForm, ctx);
            updateUI();
            createTestButtons();
            renderPreviewGallery(); // ギャラリーの描画
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

            // メイン画面のステータス表示を更新
            const currentStats = getBattleStats();
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
                battleRecordDisplay.innerHTML = `戦歴<br>${battleWins}勝<br>${battleLosses}敗`;
            }

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
                
                // 3.0秒経過したとき（真っ黒のタイミング）で姿を切り替える
                setTimeout(() => {
                    callback();
                    
                    // 真っ黒になってから少し余韻を残してゆっくりと晴れる
                    setTimeout(() => {
                        overlay.classList.remove('flashing');
                    }, 1000);
                }, 3000);
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
                
                statusTextEl.textContent = `★ ${newName}！ ★`;
                canvas.classList.remove('bouncing');
            }, targetStage === 4);
        }

        function createWordEffect(count, word, isTen = false) {
            const container = document.querySelector('.art-container');
            if(!container) return;
            const fx = document.createElement('div');
            fx.textContent = '+' + count;
            fx.style.position = 'absolute';
            fx.style.left = (30 + Math.random() * 40) + '%';
            fx.style.top = '60%'; 
            const POP_COLORS = ['#ff4757', '#ffa502', '#2ed573', '#1e90ff', '#ff69b4', '#00ced1', '#ff2e93'];
            const color1 = POP_COLORS[Math.floor(Math.random() * POP_COLORS.length)];
            const color2 = POP_COLORS[Math.floor(Math.random() * POP_COLORS.length)];

            fx.style.color = color1;
            fx.style.textShadow = '2px 2px 0 #fff, -2px -2px 0 #fff, 2px -2px 0 #fff, -2px 2px 0 #fff';
            fx.style.fontWeight = 'bold';
            fx.style.fontFamily = "'DotGothic16', sans-serif";
            fx.style.fontSize = '2.5rem';
            fx.style.pointerEvents = 'none';
            fx.style.zIndex = 50;
            fx.style.transition = 'all 0.8s cubic-bezier(0.25, 1, 0.5, 1)';
            container.appendChild(fx);
            
            const EMOJI_MAP = {
                '愛してます': '♥',
                'ゆるします': '✦',
                'ありがとう': '✿',
                'うれしい': '☀',
                '楽しい': '♪',
                '感謝してます': '❀',
                'しあわせ': '♧',
                'ツイてる': '★'
            };

            const sparkle = document.createElement('div');
            sparkle.textContent = EMOJI_MAP[word] || '★';
            sparkle.style.position = 'absolute';
            sparkle.style.left = (parseFloat(fx.style.left) + 20) + '%';
            sparkle.style.top = '58%';
            sparkle.style.color = color2;
            sparkle.style.textShadow = '2px 2px 0 #fff, -2px -2px 0 #fff, 2px -2px 0 #fff, -2px 2px 0 #fff';
            sparkle.style.fontFamily = "'DotGothic16', sans-serif";
            sparkle.style.fontSize = '2.5rem';
            // 強制テキスト表示を削除し、絵文字本来の色やポップな色を活かす
            sparkle.style.pointerEvents = 'none';
            sparkle.style.zIndex = 49;
            sparkle.style.transition = 'all 0.8s ease-out';
            container.appendChild(sparkle);

            // ピコンというキャラクターの跳ねる動き
            const can = document.getElementById('pixelCanvas');
            if(can) {
                can.style.transition = 'transform 0.15s ease-out';
                can.style.transform = 'scale(1.15)';
                setTimeout(() => { can.style.transform = 'scale(1)'; }, 150);
            }

            // 「テロン」または10の倍数なら「テレレン」を鳴らす
            if (isTen) {
                playTenPopSound();
            } else {
                playWordPopSound();
            }

            // 浮上アニメーション開始
            requestAnimationFrame(() => {
                fx.style.top = '10%';
                fx.style.opacity = '0';
                fx.style.transform = 'scale(1.2)';
                
                sparkle.style.top = '5%';
                sparkle.style.opacity = '0';
                sparkle.style.transform = 'scale(1.5) rotate(45deg)';
            });
            setTimeout(() => { fx.remove(); sparkle.remove(); }, 800);
        }

        function addWordLog(word, count=1) {
            wordCounts[word] += count;
            let oldCount = totalCount;
            totalCount += count;
            
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


            // 100回ごとの区切りでお祝いを表示
            if (Math.floor(totalCount / 100) > Math.floor(oldCount / 100)) {
                showCelebration(Math.floor(totalCount / 100) * 100);
            }
            
            // 病気ステータスの場合の処理
            if (isSick) {
                sickRecoveryCount += count;
                if (sickRecoveryCount >= 100) {
                    recoverFromSick();
                } else {
                    lastInteractionTimestamp = Date.now();
                    saveState();
                    statusTextEl.textContent = `かいふくまで あと ${100 - sickRecoveryCount} 回...`;
                }
            } else {
                lastInteractionTimestamp = Date.now();
                checkRebirth(); // 音声入力などの相互作用時にも転生チェック
                saveState();

                const randomMessages = ["大満足", "喜んでいる", "パワーアップ"];
                const msg = randomMessages[Math.floor(Math.random() * randomMessages.length)];
                statusTextEl.textContent = msg;
                renderCanvasArt(currentForm, ctx); // 少し揺らす
                updateUI();
            }

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

        function toggleAButton() {
            playButtonSound();
            if (overlayState === 0) {
                overlayState = 1;
                statsOverlayEl.classList.add('visible');
                updateStatsList();
            } else if (overlayState === 1) {
                overlayState = 2;
                statsOverlayEl.classList.remove('visible');
                oyatsuOverlayEl.classList.add('visible');
                updateOyatsuList();
            } else if (overlayState === 2) {
                overlayState = 3;
                oyatsuOverlayEl.classList.remove('visible');
                zukanOverlayEl.classList.add('visible');
                renderZukan();
            } else {
                closeOverlays();
            }
        }

        function closeOverlays() {
            overlayState = 0;
            statsOverlayEl.classList.remove('visible');
            oyatsuOverlayEl.classList.remove('visible');
            zukanOverlayEl.classList.remove('visible');
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
            childA: { 
                text: '非常にかしこく「国土の隅々まで知り尽くしている存在」別名　少名毘古那神（すくなびこな　一寸帽子)日本神話において「知恵者で多才な小人神」非常に重要な神酒造の神で有名で大国主の命の相棒' 
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
                    
                    if (true || unlockedForms.includes(key)) { // FIXME: テスト確認用に全キャラ表示中
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

            // --- 秘密のアイテム枠 (テスト用6枠) ---
            const itemTitle = document.createElement('div');
            itemTitle.className = 'zukan-stage-title';
            itemTitle.style.marginTop = '15px';
            itemTitle.style.color = '#c0392b'; // 特別な色
            itemTitle.style.fontWeight = 'bold';
            itemTitle.textContent = '★ ひみつのアイテム ★';
            zukanListEl.appendChild(itemTitle);

            const itemGrid = document.createElement('div');
            itemGrid.className = 'zukan-grid';

            for (let i = 0; i < 6; i++) {
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
                
                if (itemData && (true || unlockedItems.includes(itemData.id))) {
                    nameEl.textContent = itemData.name;
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
                            applyPixelFilter(zctx, 192, 192, 'remove-white');
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

        function showCelebration(reachedCount) {
            celebrationTitleEl.textContent = `${reachedCount}回達成！`;
            
            // ランダムにメッセージを選択
            const randIdx = Math.floor(Math.random() * CELEBRATION_MESSAGES.length);
            celebrationMessageEl.innerHTML = CELEBRATION_MESSAGES[randIdx];

            celebrationOverlayEl.classList.add('visible');
            
            playCelebrateSound(); // テスト音源の再生

            // 紙吹雪エフェクト (ドット風)
            for(let i=0; i<30; i++) {
                createConfetti();
            }
        }

        function hideCelebration() {
            celebrationOverlayEl.classList.remove('visible');
        }

        function createConfetti() {
            const colors = ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#f39c12'];
            const conf = document.createElement('div');
            conf.className = 'confetti';
            conf.style.background = colors[Math.floor(Math.random() * colors.length)];
            conf.style.left = Math.random() * 100 + '%';
            conf.style.top = '-10px';
            // サイズをバラバラにする
            const size = Math.floor(Math.random() * 5) + 4; 
            conf.style.width = size + 'px';
            conf.style.height = size + 'px';
            
            const container = document.getElementById('celebrationOverlay');
            container.appendChild(conf);

            const startTime = Date.now();
            const duration = 2000;
            const horizontalVel = (Math.random() - 0.5) * 4;

            function fall() {
                const elapsed = Date.now() - startTime;
                const progress = elapsed / duration;
                if (progress >= 1) {
                    conf.remove();
                    return;
                }
                conf.style.top = (progress * 300) + 'px';
                conf.style.left = (parseFloat(conf.style.left) + horizontalVel * 0.1) + '%';
                requestAnimationFrame(fall);
            }
            requestAnimationFrame(fall);
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
            ictx.clearRect(0, 0, 24, 24);
            if (itemObj.src) {
                const img = new Image();
                img.src = itemObj.src;
                img.onload = () => {
                    itemPopupCanvas.width = 192;
                    itemPopupCanvas.height = 192;
                    itemPopupCanvas.style.imageRendering = 'auto'; // 滑らかに縮小
                    ictx.filter = "none";
                    
                    const t = itemObj.trim || 0;
                    const sx = img.width * t;
                    const sy = img.height * t;
                    const sW = img.width * (1 - t * 2);
                    const sH = img.height * (1 - t * 2);
                    
                    ictx.drawImage(img, sx, sy, sW, sH, 0, 0, 192, 192);
                    applyPixelFilter(ictx, 192, 192, 'remove-white');
                };
            }
        }

        function hideItemPopup() {
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
                else if (w === 'もっと自分を愛しますもっと自分をゆるします') displayWord = '<span style=\'font-size: 1.6rem; display: inline-block; transform: scale(0.75); transform-origin: left center; white-space: nowrap;\'>もっと自分を愛します<br>もっと自分をゆるします</span>';
                else if (w === 'どうでもいいどっちでもいいどうせうまくいくから') displayWord = '<span style=\'font-size: 1.6rem; display: inline-block; transform: scale(0.75); transform-origin: left center; white-space: nowrap;\'>どうでもいい<br>どっちでもいい<br>どうせうまくいくから</span>';
                
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
            if(confirm("データをリセットしてタマゴからやりなおしますか？")){
                currentStage = 0;
                currentForm = 'egg';
                totalCount = 0;
                allWords.forEach(w => wordCounts[w] = 0);
                isSick = false;
                sickRecoveryCount = 0;
                canvas.classList.remove('bouncing');
                statusTextEl.textContent = "マイクをオンにしてね";
                renderCanvasArt('egg', ctx);
                updateUI();
                closeOverlays();
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
                    addWordLog(w, currentMatchCount - previousMatchCount);
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
            if (!useNativeSpeech && !webRecognition) return alert('この環境は音声認識に非対応です');
            if(isListening) {
                stopMic();
            } else {
                if (useNativeSpeech) {
                    try {
                        const hasPerm = await window.Capacitor.Plugins.SpeechRecognition.hasPermission();
                        if (!hasPerm.permission) {
                            await window.Capacitor.Plugins.SpeechRecognition.requestPermission();
                        }
                    } catch (e) {
                        console.error('Permission request failed', e);
                    }
                }
                startMic();
            }
        }

        let nativeInterimMatchCounts = {};
        
        async function startMic(){ 
            if (useNativeSpeech) {
                isListening = true;
                micBtnEl.classList.add('mic-active');
                nativeInterimMatchCounts = {};
                
                window.Capacitor.Plugins.SpeechRecognition.addListener('partialResults', (data) => {
                    if (data && data.matches && data.matches.length > 0) {
                        processTranscript(data.matches[0], false, nativeInterimMatchCounts);
                    }
                });

                try {
                    await window.Capacitor.Plugins.SpeechRecognition.start({
                        language: "ja-JP",
                        maxResults: 1,
                        prompt: "言霊を唱えてください",
                        partialResults: true,
                        popup: false
                    });
                } catch(e) {
                    console.error('Speech recognition failed to start', e);
                    stopMic();
                }
            } else if (webRecognition) {
                try{ webRecognition.start(); }catch(e){} 
            }
        }

        async function stopMic(){ 
            isListening = false; 
            if (useNativeSpeech) {
                micBtnEl.classList.remove('mic-active');
                try {
                    await window.Capacitor.Plugins.SpeechRecognition.stop();
                    await window.Capacitor.Plugins.SpeechRecognition.removeAllListeners();
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
            sickBtn.textContent = '24H放置(病気)';
            sickBtn.onclick = () => {
                lastInteractionTimestamp -= 86400000 + 1000;
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
                sickRecoveryCount = 100;
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
            if (!audioCtx) initAudio();
            if (!audioCtx) return;
            const now = audioCtx.currentTime;
            playOscillator(880, now, 0.05, 0.05, 'square');
        }

        function playWordPopSound() {
            if (!audioCtx) initAudio();
            if (!audioCtx) return; // AudioContextが許可されていない場合は鳴らさない
            const now = audioCtx.currentTime;
            // 軽やかな「テロン♪」という音 (C5 -> E5)
            playOscillator(523.25, now, 0.08, 0.02, 'sine');
            playOscillator(659.25, now + 0.08, 0.15, 0.02, 'sine');
        }

        function playTenPopSound() {
            if (!audioCtx) initAudio();
            if (!audioCtx) return;
            const now = audioCtx.currentTime;
            // 10回ごとの「テレレン♪」という音 (C5 -> E5 -> G5) 少しだけ華やかに
            playOscillator(523.25, now, 0.08, 0.03, 'sine');
            playOscillator(659.25, now + 0.08, 0.08, 0.03, 'sine');
            playOscillator(783.99, now + 0.16, 0.20, 0.03, 'sine');
        }

        const battleMessageEl = document.getElementById('battleMessage');

        const battleBgList = [
            'Gemini_Generated_Image_2ht5i42ht5i42ht5.jpg',
            'Gemini_Generated_Image_5z0q9g5z0q9g5z0q.jpg',
            'Gemini_Generated_Image_9pseq69pseq69pse.jpg'
        ];

        let pendingChallengerData = null;

        function startBattle(forceMiracle = false, challengerData = null) {
            closePvpMenu(); // メニューが開いていれば閉じる

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
            const now = audioCtx ? audioCtx.currentTime : 0;
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
                    battleMessageEl.style.display = 'none';
                    battleFlashEl.classList.remove('active');
                    runBattleSequence(forceMiracle, challengerData);
                }, 1000);
            }, 2000);
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

        function runBattleSequence(forceMiracle = false, challengerData = null) {
            let myStats = getBattleStats();
            let enemyStats = challengerData ? {
                hp: challengerData.h,
                attack: challengerData.a,
                evasionRate: challengerData.e,
                criticalRate: challengerData.c
            } : getEnemyStats(totalCount);
            
            let myMaxHp = myStats.hp;
            let enemyMaxHp = enemyStats.hp;
            let myHp = myMaxHp;
            let enemyHp = enemyMaxHp;
            
            let turnCount = 0;
            const maxTurns = 15;
            let isBattleOver = false;

            function executeTurn() {
                if (isBattleOver) return;

                turnCount++;
                if (myHp <= 0 || enemyHp <= 0 || turnCount > maxTurns) {
                    isBattleOver = true;
                    finishBattle(myHp >= enemyHp);
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
                            setTimeout(executeTurn, 2500);
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
            setTimeout(executeTurn, 2500);
        }

        function finishBattle(isWin) {
            stopBattleBgm(); // バトル終了時にBGMを止める
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

        // --- URL通信対戦ロジック ---
        function openPvpMenu() {
            playButtonSound();
            document.getElementById('pvpMenuOverlay').classList.add('visible');
            document.getElementById('pvpMainMenu').style.display = 'flex';
            document.getElementById('urlContainer').style.display = 'none';
        }

        function closePvpMenu() {
            document.getElementById('pvpMenuOverlay').classList.remove('visible');
        }

        function generateChallengeUrl() {
            const stats = getBattleStats();
            // {h: 150, a: 20, e: 10.5, c: 5.5, f: 'childA_1'} のように軽量化する
            const payloadObj = {
                h: stats.hp,
                a: stats.attack,
                e: stats.evasionRate,
                c: stats.criticalRate,
                f: currentForm
            };
            const jsonStr = JSON.stringify(payloadObj);
            // btoaでは日本語などのマルチバイトが含まれない前提（今回全てASCII）
            const encodedStr = btoa(jsonStr);
            const url = window.location.origin + window.location.pathname + '?e=' + encodedStr;
            
            document.getElementById('challengeUrlText').value = url;
            document.getElementById('pvpMainMenu').style.display = 'none';
            document.getElementById('urlContainer').style.display = 'block';
        }

        function backToPvpMenu() {
            document.getElementById('urlContainer').style.display = 'none';
            document.getElementById('pvpMainMenu').style.display = 'flex';
        }

        function copyChallengeUrl() {
            const copyText = document.getElementById("challengeUrlText");
            copyText.select();
            copyText.setSelectionRange(0, 99999); /* For mobile devices */
            try {
                navigator.clipboard.writeText(copyText.value);
                alert("対戦URLをクリップボードにコピーしました！\nLINEやSNSで友達に送信してみよう！");
            } catch (err) {
                document.execCommand("copy"); // Fallback
                alert("対戦URLをコピーしました！");
            }
        }

        function shareOnLine() {
            const url = document.getElementById('challengeUrlText').value;
            const text = encodeURIComponent("言霊っちで通信対戦！私のゴーストを倒せるかな？\n");
            window.open(`https://line.me/R/msg/text/?${text}${encodeURIComponent(url)}`, '_blank');
        }

        function shareOnX() {
            const url = document.getElementById('challengeUrlText').value;
            const text = encodeURIComponent("【ことだまっち】私の育成したキャラクターと通信対戦しよう！勝負だ！\n#言霊っち #レトロゲーム\n");
            window.open(`https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(url)}`, '_blank');
        }

        function checkUrlChallenge() {
            const urlParams = new URLSearchParams(window.location.search);
            const enemyCode = urlParams.get('e');
            if (enemyCode) {
                try {
                    const decodedStr = atob(enemyCode);
                    const eData = JSON.parse(decodedStr);
                    // 正常なら挑戦状ダイアログを開く
                    if (eData && eData.h && eData.f) {
                        pendingChallengerData = eData;
                        const popup = document.getElementById('pvpChallengeOverlay');
                        const info = document.getElementById('challengerInfo');
                        const name = charNames[eData.f] || '謎のことだまっち';
                        info.innerHTML = `
                            【${name}】から<br>対戦を申し込まれた！<br>
                            <br>
                            <span style="font-size:0.8rem; color:#f1c40f;">
                            挑戦者の戦力：<br>
                            HP: ${eData.h} / 攻撃: ${eData.a}<br>
                            回避: ${Math.floor(eData.e)}% / 会心: ${Math.floor(eData.c)}%
                            </span>
                        `;
                        popup.classList.add('visible');
                        
                        // URLパラメータを掃除して、リロード時の無限ループを防ぐ
                        if (window.history.replaceState) {
                            window.history.replaceState({}, document.title, window.location.pathname);
                        }
                    }
                } catch (err) {
                    console.error("無効な対戦URLです", err);
                }
                
                // パラメータを消して再読み込み時に2回目が出ないようにクリーンアップする（任意）
                history.replaceState(null, '', window.location.pathname);
            }
        }

        function acceptChallenge() {
            document.getElementById('pvpChallengeOverlay').classList.remove('visible');
            startBattle(false, pendingChallengerData);
        }

        function rejectChallenge() {
            document.getElementById('pvpChallengeOverlay').classList.remove('visible');
            pendingChallengerData = null;
        }

        // --- 陰徳システム ---
        function openIntokuModal() {
            playButtonSound();
            const overlay = document.getElementById('intokuOverlay');
            if (overlay) overlay.classList.add('visible');
        }

        function closeIntokuModal() {
            const overlay = document.getElementById('intokuOverlay');
            if (overlay) overlay.classList.remove('visible');
        }

        function playIntokuSound() {
            if (!audioCtx) return;
            const t = audioCtx.currentTime;
            
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

        // 初回ロード
        window.onload = () => {
            init();
            checkUrlChallenge();
        };

document.addEventListener('DOMContentLoaded', () => { const btn = document.getElementById('closeZukanDetailBtn'); if(btn) btn.addEventListener('click', () => { playButtonSound(); document.getElementById('zukanDetailOverlay').classList.remove('visible'); }); });
