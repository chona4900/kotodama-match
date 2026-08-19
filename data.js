// --- サウンド（Web Audio API） ---
        let audioCtx = null;
        let nativeAudioRefreshPromise = null;
        let lastAudioRecoveryAt = 0;

        function refreshNativeAudioSession() {
            const speechPlugin = window.Capacitor?.Plugins?.SpeechRecognition;
            if (!window.Capacitor?.isNativePlatform?.() || !speechPlugin?.refreshAudioSession) {
                return Promise.resolve();
            }
            if (nativeAudioRefreshPromise) return nativeAudioRefreshPromise;

            nativeAudioRefreshPromise = Promise.resolve(speechPlugin.refreshAudioSession())
                .catch((error) => console.warn('Native audio session refresh failed:', error))
                .finally(() => { nativeAudioRefreshPromise = null; });
            return nativeAudioRefreshPromise;
        }

        function initAudio() {
            if (!audioCtx || audioCtx.state === 'closed') {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (soundEnabled && audioCtx.state !== 'running') {
                const resumeResult = audioCtx.resume();
                if (resumeResult && typeof resumeResult.catch === 'function') {
                    resumeResult.catch((error) => console.warn('AudioContext resume failed:', error));
                }
            } else if (!soundEnabled && audioCtx.state === 'running') {
                audioCtx.suspend();
            }
            return audioCtx;
        }

        function playWhenAudioReady(playback) {
            if (!soundEnabled || typeof playback !== 'function') return;
            const ctx = initAudio();
            if (!ctx) return;

            if (ctx.state === 'running') {
                playback(ctx);
                return;
            }

            Promise.resolve(ctx.resume())
                .then(() => {
                    if (ctx.state === 'running') {
                        playback(ctx);
                    }
                })
                .catch((error) => console.warn('Audio playback resume failed:', error));
        }
        
        function nudgeWebAudioOutput() {
            const ctx = initAudio();
            if (ctx && soundEnabled) {
                // iOSではセッション再開後も、ユーザー操作内でWeb Audioへ
                // 1サンプル流さないと出力が戻らない場合がある。
                const source = ctx.createBufferSource();
                source.buffer = ctx.createBuffer(1, 1, 22050);
                source.connect(ctx.destination);
                source.start(0);
            }
        }

        // iOS/WKWebViewでは、消音解除・通話・画面復帰などの後に音声セッションが
        // 古い状態のまま残ることがある。最初の1回だけでなく、その後の操作でも
        // ネイティブ側とWeb Audio側を再開できるようにする。
        const recoverAudioOutput = function({ force = false } = {}) {
            if (!soundEnabled) return;
            const now = Date.now();
            if (!force && now - lastAudioRecoveryAt < 500) return;
            lastAudioRecoveryAt = now;

            // Web Audioの再開はユーザー操作と同じ同期処理内でも実行する。
            nudgeWebAudioOutput();
            refreshNativeAudioSession().then(nudgeWebAudioOutput);
        };
        document.addEventListener('touchstart', recoverAudioOutput, { passive: true });
        document.addEventListener('click', recoverAudioOutput);
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) recoverAudioOutput({ force: true });
        });
        window.addEventListener('pageshow', () => recoverAudioOutput({ force: true }));

        function playOscillator(freq, startTime, duration, vol=0.1, type='square') {
            if(!audioCtx || !soundEnabled) return;
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
        
        function playToggleSound() {
            initAudio();
            const now = audioCtx.currentTime;
            // ピコピコピコという短い音を3回連続で鳴らす
            playOscillator(880, now, 0.05, 0.1, 'square');
            playOscillator(1108.73, now + 0.08, 0.05, 0.1, 'square');
            playOscillator(1318.51, now + 0.16, 0.05, 0.1, 'square');
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

            // 1. 背景のチャージ音（常に鳴っているBGM要素）
            // 低音から徐々に高音へ、音量も上がっていく
            const chargeOsc = audioCtx.createOscillator();
            const chargeGain = audioCtx.createGain();
            chargeOsc.type = 'sawtooth';
            chargeOsc.frequency.setValueAtTime(50, now);
            chargeOsc.frequency.exponentialRampToValueAtTime(300, now + 6.0);
            
            chargeGain.gain.setValueAtTime(0.005, now);
            chargeGain.gain.linearRampToValueAtTime(0.08, now + 6.0);
            chargeGain.gain.linearRampToValueAtTime(0.005, now + 6.5);
            
            chargeOsc.connect(chargeGain);
            chargeGain.connect(audioCtx.destination);
            chargeOsc.start(now);
            chargeOsc.stop(now + 6.5);

            // 2. 鼓動音（CSSの新しい20ステップ点滅に完全に同期）
            const flashTimes = [0.48, 1.20, 1.86, 2.46, 3.00, 3.36, 3.78, 4.08, 4.38, 4.56, 4.80, 4.98, 5.10, 5.28, 5.40, 5.58, 5.70, 5.79, 5.88, 6.00];

            flashTimes.forEach((t, i) => {
                // ドクンという鼓動音 (triangle は丸みのある音)
                const freq = 120 + (i * 10); 
                const duration = Math.max(0.05, 0.2 - (i * 0.005)); 
                playOscillator(freq, now + t, duration, 0.25, 'triangle'); 
                // ピッという短いパルス
                playOscillator(freq * 1.5, now + t, duration, 0.05, 'square');
            });

            // 3. ファンファーレ（進化完了、6.0秒で真っ黒、7.0秒で光る）
            const revealTime = now + 7.0;
            
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
        const SICKNESS_DELAY_MS = 72 * 60 * 60 * 1000;
        const SICKNESS_RECOVERY_GOAL = 10;
        
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
        
        let currentStage = 0;
        let currentForm = 'egg';
        let isSick = false;
        let sickRecoveryCount = 0;
        let lastInteractionTimestamp = Date.now();
        let soundEnabled = true;
        let unlockedForms = ['egg']; // 図鑑解放リスト
        let unlockedItems = []; // 獲得済み秘密のアイテムリスト
        let finalEvolutionTimestamp = null; // 最終進化に到達した時刻
        
        const SECRET_ITEMS_DATA = [
            { id: 'yata_no_kagami', name: '八咫鏡', src: '八咫鏡.jpg', desc: '日本神話の三種の神器の一つ天照大神が岩戸に隠れたとき、外へ誘うために使われたとされる神器天照大御神の「御神体」としての「八咫鏡」は神宮の内宮にある秘宝です' },
            { id: 'kusanagi_no_tsurugi', name: '草薙剣', src: '草薙剣.jpg', desc: '三種の神器の一つで天叢雲剣（あめのむらくものつるぎ）とも言われ神の魂が宿る（または神そのもの）とされているため、人間の目に触れること自体が畏れ多いとされているため、天皇陛下や熱田神宮の宮司でも実物を見ることは禁じられています。熱田神宮のご神体' },
            { id: 'yasakani_no_magatama', name: '八尺瓊勾玉', src: '八尺瓊勾玉.jpg', desc: '三種の神器のひとつ。天照大御神（あまてらすおおみかみ）が天の岩戸にお隠れになった際、玉祖命（たまのおやのみこと）が作った宝物。今でも宮中（皇居）に祀られているとされています。皇位継承の証として、新しい天皇に受け継がれる非常に神聖な宝物' },
            { id: 'houju', name: '宝珠', src: '宝珠.jpg', trim: 0.05, desc: '如意宝珠（にょいほうじゅ）とも呼ばれ意のままに宝や服、食べ物を出し、病気や苦しみを癒してくれるのだとか。また、悪いもの取り除き、濁った水を清らかにし、災いを防ぐなどの功徳（くどく）がある神聖な宝の珠（たま）のこと' },
            { id: 'sankosho', name: '三鈷杵', src: '三鈷杵.jpg', trim: 0.05, desc: '空海（弘法大師）が、唐（中国）から日本へ帰国する際、「密教を広めるのにふさわしい場所を示したまえ」と祈念して東の空へ三鈷杵を投げたという有名な伝説があります。三つの先端は、それぞれ仏の「知恵」「慈悲」「力」を表しているされ、三鈷杵を持つことで悪神による障りや災いを防ぎ、叶えたい願いがあるとき。三鈷杵を手に取り、仏の「知恵・慈悲・力」を念じることで、あなたの祈りは叶うでしょう' },
            { id: 'kagurasuzu', name: '神楽鈴', src: '神楽鈴.jpg', trim: 0.05, desc: '元来、鈴には魔除け、神様を呼ぶ効果があると言われ、神社の参拝時に鳴らす鈴にも同じ意味があります。この鈴は能楽や歌舞伎などで『三番叟（さんばそう）』を踊るときにも使用され三番叟鈴（さんばそうすず）。三番叟とは神事儀礼の舞曲の一つで五穀豊穣、延命長寿、子孫繁栄を祈り、この鈴を持って踊ります。神楽鈴の鈴は三段の輪状に付けられ、下から七個、五個、三個になっており、別名七五三鈴とも呼ばれてます' },
            { id: 'yatagarasu', name: '八咫烏', src: '八咫烏.png', trim: 0.05, filter: 'remove-grey', desc: '太陽の中に住む霊力を持つ鳥が｢八咫烏｣です。三本足のヤタガラスの八咫とは（大きいの意味）目的地へと安全に導くすぐれたナビゲーターで、道開くといわれています。3本の足はそれぞれ「天・地・人（あるいは太陽、月、星）」を表すとされています。' }
        ];
