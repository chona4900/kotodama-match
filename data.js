// --- サウンド（Web Audio API） ---
        let audioCtx = null;
        function initAudio() {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
        }
        
        // iOS/WKWebView向けに、最初のタップでAudioContextを強制起動・ロック解除する
        const unlockAudio = function() {
            initAudio();
            document.removeEventListener('touchstart', unlockAudio);
            document.removeEventListener('click', unlockAudio);
        };
        document.addEventListener('touchstart', unlockAudio, { once: true });
        document.addEventListener('click', unlockAudio, { once: true });

        function playOscillator(freq, startTime, duration, vol=0.1, type='square') {
            if(!audioCtx) return;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, startTime);
            gain.gain.setValueAtTime(vol, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(startTime);
            osc.stop(startTime + duration);
        }
        function playCelebrateSound() {
            initAudio();
            const now = audioCtx.currentTime;
            
            // ドラクエ/FF風のファンファーレ（1オクターブ上げて明るくハッピーな高音へ！）
            const notes = [
                { f: 1046.50, d: 0.12 }, // テ (C6)
                { f: 1046.50, d: 0.12 }, // ケ
                { f: 1046.50, d: 0.12 }, // テ
                { f: 1046.50, d: 0.25 }, // ケ
                { f: 830.61,  d: 0.25 }, // テッ (G#5)
                { f: 932.33,  d: 0.25 }, // テ (A#5)
                { f: 1046.50, d: 0.70 }  // テー！ (C6)
            ];
            
            let timeOffset = 0;
            notes.forEach((note, i) => {
                // 主旋律（四角波でファミコン風の明るい音）
                playOscillator(note.f, now + timeOffset, note.d, 0.15, 'square');
                // 完全5度上をうっすら重ねて、明るいハーモニーに
                playOscillator(note.f * 1.5, now + timeOffset, note.d, 0.08, 'square');
                
                timeOffset += note.d + 0.03; // 次の音符までの間合い
            });
        }
        function playEvolutionSound() {
            initAudio();
            const now = audioCtx.currentTime;

            // 暗転（黒になる）タイミングリスト（CSSでのopacity:1の秒数）
            const flashTimes = [0.45, 1.05, 1.50, 1.86, 2.16, 2.40, 2.61, 2.76, 2.85, 2.94, 3.00];

            flashTimes.forEach((t, i) => {
                // ドクンという鼓動音 (triangle は丸みのある音)
                const freq = 120 + (i * 15); 
                const duration = Math.max(0.05, 0.2 - (i * 0.015)); 
                playOscillator(freq, now + t, duration, 0.2, 'triangle'); 
                // ピッという短い電子パルス音
                playOscillator(freq * 1.5, now + t, duration, 0.05, 'square');
            });

            // 3.0秒で完全に黒。4.0秒のタイミングでフェードアウトが始まる（進化完了）
            const revealTime = now + 4.0;
            
            // パッ！と明るくなる瞬間の進化完了ファンファーレ
            playOscillator(523.25, revealTime, 0.1, 0.15); // C5
            playOscillator(587.33, revealTime + 0.1, 0.1, 0.15); // D5
            playOscillator(659.25, revealTime + 0.2, 0.1, 0.15); // E5
            
            playOscillator(698.46, revealTime + 0.35, 0.15, 0.15); // F5
            playOscillator(587.33, revealTime + 0.55, 0.15, 0.15); // D5
            playOscillator(659.25, revealTime + 0.75, 0.15, 0.15); // E5
            playOscillator(523.25, revealTime + 0.95, 0.15, 0.15); // C5
            
            // 最後のキメ和音
            playOscillator(659.25, revealTime + 1.15, 0.8, 0.2); // E5
            playOscillator(783.99, revealTime + 1.15, 0.8, 0.2); // G5
            playOscillator(1046.50, revealTime + 1.15, 0.8, 0.2); // C6
        }

        function playUltimateEvolutionSound() {
            initAudio();
            const now = audioCtx.currentTime;

            // 激しい重低音の地鳴り（ゴゴゴゴゴ）
            playOscillator(40, now, 8.0, 0.4, 'sawtooth');
            playOscillator(45, now, 8.0, 0.4, 'square');
            
            // 徐々に間隔が狭まる雷
            // 点滅（チカチカ→パパパパッ）に合わせてだんだん激しく
            const thunders = [
                0.5, 1.5, 2.5, 3.5, // ゆっくり
                4.3, 5.0, 5.5, 6.0, 6.4, 6.8, // 早くなる
                7.1, 7.3, 7.5, 7.7, 7.9, // さらに早く
                8.0, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9 // クライマックス
            ];
            thunders.forEach((t, i) => {
                let duration = Math.max(0.1, 0.4 - i * 0.015);
                playOscillator(100 + Math.random()*200, now + t, duration, 0.3, 'sawtooth');
                playOscillator(200 + Math.random()*300, now + t, duration, 0.3, 'square');
            });

            // 9.0秒の閃光後の超大迫力ファンファーレ (オーケストラ風)
            const revealTime = now + 9.0;
            
            // 駆け上がり
            playOscillator(523.25, revealTime, 0.15, 0.2); // C5
            playOscillator(659.25, revealTime + 0.15, 0.15, 0.2); // E5
            playOscillator(783.99, revealTime + 0.3, 0.15, 0.2); // G5
            playOscillator(987.77, revealTime + 0.45, 0.15, 0.2); // B5

            // 超絶豪華なキメ和音(C major add 9 + オクターブ上)
            const chordTime = revealTime + 0.6;
            const durations = 2.5; // 長く伸ばす
            ['square', 'triangle', 'sawtooth'].forEach(w => {
                playOscillator(523.25, chordTime, durations, 0.2, w); // C5
                playOscillator(659.25, chordTime, durations, 0.2, w); // E5
                playOscillator(783.99, chordTime, durations, 0.2, w); // G5
                playOscillator(1046.50, chordTime, durations, 0.2, w); // C6
                playOscillator(1318.51, chordTime, durations, 0.15, w); // E6
                playOscillator(1567.98, chordTime, durations, 0.1, w); // G6
            });
        }

        function playItemGetSound() {
            initAudio();
            const now = audioCtx.currentTime;
            
            // 下から上へ一気に駆け上がるアルペジオ（ハープのグリッサンド風）
            const notes = [
                261.63, // C4
                329.63, // E4
                392.00, // G4
                523.25, // C5
                659.25, // E5
                783.99, // G5
                1046.50 // C6
            ];
            
            notes.forEach((freq, i) => {
                // 駆け上がり部分は0.08秒間隔で非常に速く
                playOscillator(freq, now + (i * 0.08), 0.2, 0.1, 'square');
                playOscillator(freq, now + (i * 0.08), 0.2, 0.2, 'triangle'); // 重厚感
            });
            
            const finishTime = now + (notes.length * 0.08);
            
            // 最後に非常に豪華で長いキメ和音（ド・ミ・ソ・ド）
            playOscillator(523.25, finishTime, 1.5, 0.15, 'square');
            playOscillator(659.25, finishTime, 1.5, 0.15, 'square');
            playOscillator(783.99, finishTime, 1.5, 0.15, 'square');
            playOscillator(1046.50, finishTime, 1.5, 0.2, 'square');
            
            // キラキラ感(高音)をプラスして豪華に
            playOscillator(1567.98, finishTime, 1.5, 0.05, 'square'); // G6
            playOscillator(2093.00, finishTime, 1.5, 0.05, 'square'); // C7
        }

        function playRebirthSound() {
            initAudio();
            const now = audioCtx.currentTime;
            
            // ゆっくりと神秘的な和音が鳴り、暗転に合わせる（サイン波で癒やし系の音）
            playOscillator(523.25, now, 3.0, 0.1, 'sine');      // C5
            playOscillator(440.00, now + 0.5, 2.5, 0.1, 'sine'); // A4
            playOscillator(349.23, now + 1.0, 2.0, 0.1, 'sine'); // F4
            playOscillator(261.63, now + 1.5, 1.5, 0.1, 'sine'); // C4
        }

        // --- 設定・状態 ---
        const STAGE1_GOAL = 1000;
        const STAGE2_GOAL = 2000;
        const STAGE3_GOAL = 3000;
        const STAGE4_GOAL = 4900;
        
        const CELEBRATION_MESSAGES = [
            "おめでとう！<br>金運アップしてるよ♪",
            "偉い！！<br>継続は力なり！",
            "バンザーイ！<br>良いこと山ほどくる♪",
            "さすが天才！<br>ツイている人は<br>どこまでもツイている♪",
            "波動アップ中♪<br>神の愛により<br>全てのことがうまくいってます♪",
            "あなたに全ての<br>良き事が<br>雪崩の如く起きます♪",
            "一寸先は光！<br>明日が楽しみだね♪",
            "私には福の神が<br>ついている♪",
            "頭がどんどん<br>良くなる♪",
            "今日は良い日だ♪<br>最高♪",
            "私は前進します！<br>みんなが待っている<br>ところまで♪",
            "図太くいこう！<br>負けたらダメ！",
            "今神の愛により<br>全てのことが<br>うまくいっています♪",
            "人は愛する人の<br>ためならガンバレる♪",
            "今起きていることは<br>私を成功に導く<br>チャンスです♪",
            "辛くても最後には<br>あなたが必ず勝ちますよ♪",
            "いつも笑顔でいる<br>あなたには<br>悪いことは絶対に起きない",
            "仲間がいるから楽しい<br>仲間がいるから前進できる♪",
            "良いこと聞いたら<br>すぐ実行！！<br>本当にすぐだぜ！！",
            "今日一日自分に優しく<br>人に優しくでいこう♪"
        ];
        
        let currentStage = 3; // 最終 Stage
        let currentForm = 'childA_2_2'; // テスト用に白虎っちを表示
        let isSick = false;
        let sickRecoveryCount = 0;
        let lastInteractionTimestamp = Date.now();
        let unlockedForms = []; // 図鑑解放リスト
        let unlockedItems = []; // 獲得済み秘密のアイテムリスト
        let finalEvolutionTimestamp = null; // 最終進化に到達した時刻
        
        const SECRET_ITEMS_DATA = [
            { id: 'yata_no_kagami', name: '八咫鏡', src: '八咫鏡.jpg' },
            { id: 'kusanagi_no_tsurugi', name: '草薙剣', src: '草薙剣.jpg' },
            { id: 'yasakani_no_magatama', name: '八尺瓊勾玉', src: '八尺瓊勾玉.jpg' },
            { id: 'houju', name: '宝珠', src: '宝珠.jpg', trim: 0.05 },
            { id: 'sankosho', name: '三鈷杵', src: '三鈷杵.jpg', trim: 0.05 },
            { id: 'kagurasuzu', name: '神楽鈴', src: '神楽鈴.jpg', trim: 0.05 }
        ];