(function () {
    'use strict';
    const android = window.Capacitor?.isNativePlatform?.() && window.Capacitor.getPlatform() === 'android';
    if (!android) {
        window.KotodamaBilling = { ready: Promise.resolve(), hasAccess: () => true };
        return;
    }
    let unlock;
    let state = { owned: false, reviewAccess: false, pending: false, busy: false, price: '', message: '' };
    window.KotodamaBilling = { ready: new Promise(resolve => { unlock = resolve; }), hasAccess: () => rules.hasAccess(state) };
    const rules = window.KotodamaBillingState;
    let plugin;
    let panel;
    let status;
    let buy;
    let restore;
    let reviewForm;
    let reviewCode;
    let reviewButton;
    let reviewBusy = false;
    let reviewMessage = '';
    let busy = false;
    const inertBefore = new Map();
    function render() {
        const hasAccess = rules.hasAccess(state);
        panel.hidden = hasAccess;
        for (const element of document.body.children) {
            if (element === panel || ['SCRIPT', 'STYLE', 'TEMPLATE'].includes(element.tagName)) continue;
            if (!inertBefore.has(element)) inertBefore.set(element, element.inert);
            element.inert = hasAccess ? inertBefore.get(element) : true;
        }
        buy.textContent = state.price ? `${state.price}で購入（買い切り）` : '価格を確認中…';
        buy.disabled = busy || !rules.canPurchase(state);
        restore.disabled = busy;
        if (reviewButton) reviewButton.disabled = reviewBusy || !plugin;
        if (reviewCode) reviewCode.disabled = reviewBusy;
        status.textContent = state.message || (state.pending ? '支払いの完了待ちです。再購入は不要です。' : '一度の購入でゲーム全体を利用できます。月額料金はありません。');
        if (reviewMessage) status.textContent = reviewMessage;
        if (hasAccess) unlock();
    }
    function apply(value) {
        const hadAccess = rules.hasAccess(state);
        state = rules.applyNativeState(state, value);
        if (hadAccess && !rules.hasAccess(state) && typeof window.stopMic === 'function') window.stopMic();
        render();
    }
    async function bounded(operation) {
        let timer;
        try {
            return await Promise.race([operation, new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error('接続に時間がかかっています。通信を確認して再試行してください。')), 20000);
            })]);
        } finally { clearTimeout(timer); }
    }
    async function refresh() {
        if (busy) return;
        busy = true; render();
        try {
            apply(await bounded(plugin.restore()));
            if (!rules.hasAccess(state) && !state.pending) apply(await bounded(plugin.getProduct()));
        } catch (error) { state.message = error.message || 'Google Playで購入情報を確認できません。再試行してください。'; }
        finally { busy = false; render(); }
    }
    async function purchase() {
        if (busy || !rules.canPurchase(state)) return;
        busy = true; render();
        try { await bounded(plugin.purchase()); }
        catch (error) { state.message = error.message || '購入を開始できませんでした。'; }
        finally { busy = false; render(); }
    }
    async function activateReview(event) {
        event.preventDefault();
        if (reviewBusy || !plugin) return;
        reviewBusy = true; reviewMessage = ''; render();
        try {
            apply(await bounded(plugin.activateReviewAccess({ code: reviewCode.value })));
            if (rules.hasAccess(state)) reviewCode.value = '';
        } catch (error) {
            reviewMessage = error.message || '審査用コードを確認してください。 / Check the review access code.';
        } finally { reviewBusy = false; render(); }
    }
    document.addEventListener('DOMContentLoaded', async () => {
        const style = document.createElement('style');
        style.textContent = '#kotodamaPaywall{position:fixed;inset:0;z-index:2147483647;background:#183c29;color:#fff;overflow:auto;padding:max(24px,env(safe-area-inset-top)) 24px max(24px,env(safe-area-inset-bottom));box-sizing:border-box;display:flex;align-items:center;justify-content:center;font-family:sans-serif}#kotodamaPaywall[hidden]{display:none}#kotodamaPaywall section{max-width:420px;width:100%;line-height:1.7}#kotodamaPaywall button{display:block;width:100%;min-height:48px;margin:12px 0;padding:12px;background:#f3df9e;color:#173724;border:0;border-radius:8px;font-size:16px;touch-action:manipulation}#kotodamaPaywall button:disabled{opacity:.55}#kotodamaPaywall a{color:#fff;text-decoration:underline}#kotodamaPaywall p{font-size:15px}@media(max-height:450px){#kotodamaPaywall{align-items:flex-start}}';
        document.head.appendChild(style);
        panel = document.createElement('div'); panel.id = 'kotodamaPaywall';
        panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-labelledby', 'kotodamaPaywallTitle');
        panel.innerHTML = '<section><h1 id="kotodamaPaywallTitle">コトダマっち</h1><p>ゲーム全体を買い切りで利用できます。既存の育成データはそのまま残ります。</p><p id="kotodamaPurchaseStatus" role="status" aria-live="polite"></p><button id="kotodamaPurchase" type="button">価格を確認中…</button><button id="kotodamaRestore" type="button">購入を復元・再確認</button><p>購入はGoogle Playの確認画面で確定します。同じGoogleアカウントで購入済みの場合、復元で再購入は不要です。</p><p><a href="privacy.html">プライバシーポリシー</a> · <a href="support.html">サポート</a></p></section>';
        panel.querySelector('section').insertAdjacentHTML('beforeend', '<details id="kotodamaReviewAccess"><summary>審査用アクセス / Review access</summary><p>Google Playの審査担当者は、提供されたコードで購入せずに同じゲーム全体を確認できます。 / Reviewers can use the supplied code to access the full game without payment.</p><form id="kotodamaReviewForm"><label for="kotodamaReviewCode">審査用コード / Review code</label><input id="kotodamaReviewCode" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="96" required><button id="kotodamaReviewSubmit" type="submit">審査用コードで開始 / Start review</button></form></details>');
        style.textContent += '#kotodamaReviewAccess{margin-top:20px}#kotodamaReviewAccess summary{cursor:pointer;padding:12px 0;min-height:24px}#kotodamaReviewCode{display:block;width:100%;box-sizing:border-box;min-height:48px;padding:10px;margin:8px 0;font-size:16px;border:1px solid #aaa;border-radius:6px}';
        document.body.appendChild(panel);
        status = document.getElementById('kotodamaPurchaseStatus');
        buy = document.getElementById('kotodamaPurchase'); restore = document.getElementById('kotodamaRestore');
        reviewForm = document.getElementById('kotodamaReviewForm');
        reviewCode = document.getElementById('kotodamaReviewCode');
        reviewButton = document.getElementById('kotodamaReviewSubmit');
        reviewForm.addEventListener('submit', activateReview);
        buy.addEventListener('click', purchase); restore.addEventListener('click', refresh);
        render(); restore.focus();
        plugin = window.Capacitor?.Plugins?.KotodamaBilling;
        if (!plugin) { state.message = 'Google Playの最新版へ更新してください。購入機能を読み込めませんでした。'; restore.disabled = true; status.textContent = state.message; return; }
        // Review entry is available before any Play service or network operation.
        render();
        try {
            await plugin.addListener('purchaseState', apply);
            apply(await bounded(plugin.getStatus()));
            render();
            if (!rules.hasAccess(state)) await refresh();
        }
        catch (error) { state.message = '購入情報を確認できません。アプリを開き直してください。'; render(); }
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(); });
    });
})();
