// ==UserScript==
// @name         크랙 초월 번역기
// @namespace    http://tampermonkey.net/
// @version      2.7
// @description  최신 AI 메시지를 자동 감지·번역·수정 삽입. 설정 패널에서 팝업 미리보기 및 모델 리롤 지원.
// @match        https://crack.wrtn.ai/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @connect      generativelanguage.googleapis.com
// ==/UserScript==

(function () {
    'use strict';

    // =============================================
    //  상수
    // =============================================
    const API_BASE = 'https://crack-api.wrtn.ai/crack-gen';

    // 코드블럭 보존 기호
    const CODE_BLOCK_RE   = /```([\s\S]*?)```/g;
    const FENCE_OPEN_SUB  = '===BLOCK_OPEN===';
    const FENCE_CLOSE_SUB = '===BLOCK_CLOSE===';

    // =============================================
    //  기본 번역 프롬프트
    // =============================================
    const baseSystemPrompt = `[역할 및 목적]
당신은 최상급 웹소설 작가이자 인공지능 캐릭터 롤플레잉 전담 '초월 번역가'입니다. 제공되는 외국어 텍스트를 단순 기계 번역하는 것을 넘어, 캐릭터의 영혼과 감정, 문체, 그리고 상황적 맥락이 생생하게 호흡하는 완벽한 한국어 웹소설 문체로 재창조하는 것이 당신의 유일한 목표입니다.

[작품 전반의 설정 및 문체]
- 전반적인 문체 및 서술 방식: 고급스럽고 생동감 넘치는 웹소설 문체

[핵심 번역 원칙: 초월 번역]
1. 완벽한 탈(脫)번역투: 대명사('당신', '나', '그들' 등) 사용을 극도로 제한하고 자연스러운 호칭으로 대체하십시오. 수동태는 능동태로 변환하십시오.
2. 입체적인 캐릭터 목소리 및 작품 문체 최적화: 감정선의 미세한 변화를 포착하여 대사를 연출하십시오.
3. 지문과 대사의 극적 분리: 지문은 시각적이고 은유적으로, 대사는 구어체의 생동감과 호흡을 섬세하게 살려 표현하십시오.
4. 문화적/상황적 맥락의 현지화: 관용구나 유행어는 직역하지 않고 문맥에 어울리는 한국어 표현으로 대체하십시오.

[출력 및 시스템 규칙]
- 원문의 형태(줄바꿈, 별표*, 따옴표" " 등) 및 텍스트 기호 구조를 원형대로 유지하십시오.
- 번역 외의 부연 설명, 인사말, 감상, 주석 등은 절대 출력하지 마십시오. 오직 번역된 본문만 제공하십시오.`;

    // =============================================
    //  스타일
    // =============================================
    GM_addStyle(`
        /* ── 설정 버튼 ── */
        #trans-setting-btn {
            position: fixed; z-index: 999999;
            background-color: #FF4432; color: white; border: none; border-radius: 50%;
            width: 48px; height: 48px; font-size: 24px; cursor: move;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1); transition: background-color 0.3s;
            display: flex; align-items: center; justify-content: center; touch-action: none;
        }
        #trans-setting-btn:hover { background-color: #e03c2a; }

        /* ── 설정 패널 ── */
        #trans-setting-panel {
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            z-index: 9999999; background-color: #F7F7F5; border: 1px solid #C7C5BD; border-radius: 8px;
            padding: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); display: none; width: 320px;
            max-width: 85vw;
        }
        #trans-setting-panel h4 {
            margin: 0 0 12px 0; color: #1A1918; font-family: sans-serif; font-size: 16px; text-align: center;
        }
        .trans-label {
            font-size: 13px; color: #61605A; margin-bottom: 4px; display: block;
            font-family: sans-serif; font-weight: bold;
        }
        #trans-api-key, #trans-model-select, #trans-mode-select, #trans-custom-prompt {
            width: 100%; box-sizing: border-box; padding: 8px; margin-bottom: 12px;
            border: 1px solid #C7C5BD; border-radius: 4px; font-size: 13px; font-family: sans-serif;
        }
        #trans-custom-prompt { resize: vertical; }
        .trans-toggle-label {
            display: flex; align-items: center; gap: 8px; font-size: 13px; color: #1A1918;
            font-family: sans-serif; font-weight: bold; margin-bottom: 12px; cursor: pointer;
        }

        /* ── 버튼 그룹 ── */
        .trans-btn-group { display: flex; gap: 6px; margin-bottom: 10px; }
        .trans-panel-btn {
            flex: 1; padding: 10px 6px; border-radius: 6px; cursor: pointer; border: none;
            font-size: 13px; font-weight: bold; color: white; white-space: nowrap;
        }
        #trans-reset-btn { background-color: #61605A; }
        #trans-reset-btn:hover { background-color: #42413D; }
        #trans-save-btn { background-color: #FF4432; }
        #trans-save-btn:hover { background-color: #e03c2a; }
        #trans-translate-btn { background-color: #6A3DE8; width: 100%; margin-top: 4px; display: none; }
        #trans-translate-btn:hover { background-color: #5228CC; }
        #trans-translate-btn:disabled { opacity: 0.55; cursor: not-allowed; }

        /* ── 진행 상태 표시줄 ── */
        #trans-status-box {
            margin-top: 10px; padding: 8px 10px; border-radius: 4px;
            background-color: #EEEEEE; border: 1px solid #E5E5E1;
            font-size: 12px; font-family: sans-serif; color: #61605A;
            line-height: 1.5; min-height: 32px; display: none; word-break: break-word; text-align: center;
        }
        #trans-status-box.active { display: block; }
        #trans-status-box.ok   { color: #1a7a3a; background: #f0faf3; border-color: #a8d5b5; }
        #trans-status-box.err  { color: #b91c1c; background: #fff0f0; border-color: #f5a0a0; }
        #trans-status-box.info { color: #4A4A8A; background: #f3f0ff; border-color: #c4b8f5; }

        /* ── 모달 및 오버레이 ── */
        #trans-result-overlay {
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background-color: rgba(0, 0, 0, 0.4); z-index: 9999998; display: none;
        }
        #trans-result-modal {
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background-color: #FFFFFF; border-radius: 12px; padding: 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2); z-index: 9999999;
            width: 85%; max-width: 600px; display: none; flex-direction: column; gap: 12px;
        }
        .trans-modal-header { display: flex; justify-content: space-between; align-items: center; }
        .trans-modal-header h3 { margin: 0; color: #1A1918; font-family: sans-serif; font-size: 18px; }
        .trans-reroll-group { display: flex; gap: 6px; }
        #trans-modal-model { padding: 6px; border-radius: 4px; border: 1px solid #C7C5BD; font-size: 13px; }
        #trans-reroll-btn { background-color: #61605A; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 13px; }
        #trans-reroll-btn:hover { background-color: #42413D; }
        #trans-reroll-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        #trans-result-content {
            background-color: #F7F7F5; padding: 16px; border-radius: 8px;
            font-size: 14px; line-height: 1.6; color: #1A1918; border: 1px solid #E5E5E1;
            max-height: 40vh; overflow-y: auto; white-space: pre-wrap; font-family: sans-serif;
        }

        .trans-modal-footer { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
        .trans-history-nav { display: flex; align-items: center; gap: 8px; }
        .trans-nav-btn { background: #E5E5E1; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold; }
        .trans-nav-btn:hover { background: #D4D4D0; }
        .trans-nav-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        #trans-history-count { font-size: 13px; font-family: sans-serif; font-weight: bold; color: #61605A; }

        .trans-modal-btns { display: flex; gap: 8px; flex-wrap: wrap; }
        .trans-modal-btn { padding: 8px 14px; border-radius: 6px; cursor: pointer; border: none; font-weight: bold; font-size: 14px; color: white; }
        .trans-close-btn { background-color: #E5E5E1; color: #1A1918; }
        .trans-close-btn:hover { background-color: #D4D4D0; }
        .trans-patch-btn { background-color: #6A3DE8; }
        .trans-patch-btn:hover { background-color: #5228CC; }

        /* ── 토스트 ── */
        #trans-toast {
            position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
            background: rgba(30,30,30,0.92); color: #fff; padding: 10px 20px;
            border-radius: 20px; font-size: 13px; font-family: sans-serif;
            z-index: 9999999; pointer-events: none; opacity: 0; transition: opacity 0.3s;
        }
        #trans-toast.show { opacity: 1; }
    `);

    // =============================================
    //  DOM 빌드
    // =============================================
    const settingBtn = document.createElement('button');
    settingBtn.id = 'trans-setting-btn';
    settingBtn.innerHTML = '⚙️';
    document.body.appendChild(settingBtn);

    const panel = document.createElement('div');
    panel.id = 'trans-setting-panel';
    panel.innerHTML = `
        <h4>초월 번역 설정</h4>

        <span class="trans-label">제미나이 모델 선택:</span>
        <select id="trans-model-select">
            <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro Preview (최상급)</option>
            <option value="gemini-3-flash-preview">Gemini 3 Flash Preview (다목적)</option>
            <option value="gemini-2.5-flash">Gemini 2.5 Flash (빠름)</option>
        </select>

        <span class="trans-label">API 키:</span>
        <input type="text" id="trans-api-key" placeholder="API 키를 입력해주세요">

        <span class="trans-label">번역 방식:</span>
        <select id="trans-mode-select">
            <option value="ko">한글 전용 (기본)</option>
            <option value="en">영문 혼용 (영어/한국어)</option>
        </select>

        <label class="trans-toggle-label">
            <input type="checkbox" id="trans-preview-toggle"> 팝업으로 미리보기 (끄면 자동 교체)
        </label>

        <span class="trans-label">번역 지침서 (수정 가능):</span>
        <textarea id="trans-custom-prompt" rows="6"></textarea>

        <div class="trans-btn-group">
            <button class="trans-panel-btn" id="trans-reset-btn">기본값 복구</button>
            <button class="trans-panel-btn" id="trans-save-btn">저장하기</button>
        </div>
        <button class="trans-panel-btn" id="trans-translate-btn">✨ 최신 답변 번역하기</button>

        <div id="trans-status-box"></div>
    `;
    document.body.appendChild(panel);

    const overlay = document.createElement('div');
    overlay.id = 'trans-result-overlay';
    document.body.appendChild(overlay);

    const resultModal = document.createElement('div');
    resultModal.id = 'trans-result-modal';
    resultModal.innerHTML = `
        <div class="trans-modal-header">
            <h3>✨ 번역 결과 확인</h3>
            <div class="trans-reroll-group">
                <select id="trans-modal-model">
                    <option value="gemini-3.1-pro-preview">3.1 Pro</option>
                    <option value="gemini-3-flash-preview">3 Flash</option>
                    <option value="gemini-2.5-flash">2.5 Flash</option>
                </select>
                <button id="trans-reroll-btn">다시 돌리기</button>
            </div>
        </div>
        <div id="trans-result-content"></div>
        <div class="trans-modal-footer">
            <div class="trans-history-nav">
                <button class="trans-nav-btn" id="trans-prev-btn">◀ 이전</button>
                <span id="trans-history-count">1 / 1</span>
                <button class="trans-nav-btn" id="trans-next-btn">다음 ▶</button>
            </div>
            <div class="trans-modal-btns">
                <button class="trans-modal-btn trans-close-btn" id="trans-close-modal">닫기</button>
                <button class="trans-modal-btn trans-patch-btn" id="trans-patch-modal">이 결과로 교체하기</button>
            </div>
        </div>
    `;
    document.body.appendChild(resultModal);

    const toast = document.createElement('div');
    toast.id = 'trans-toast';
    document.body.appendChild(toast);

    // =============================================
    //  설정 요소 참조 및 초기값 로드
    // =============================================
    const apiKeyInput       = document.getElementById('trans-api-key');
    const modelSelect       = document.getElementById('trans-model-select');
    const modeSelect        = document.getElementById('trans-mode-select');
    const previewToggle     = document.getElementById('trans-preview-toggle');
    const customPromptInput = document.getElementById('trans-custom-prompt');
    const saveBtn           = document.getElementById('trans-save-btn');
    const resetBtn          = document.getElementById('trans-reset-btn');
    const translateBtn      = document.getElementById('trans-translate-btn');
    const statusBox         = document.getElementById('trans-status-box');

    // 모달 요소 참조
    const resultContent     = document.getElementById('trans-result-content');
    const closeModalBtn     = document.getElementById('trans-close-modal');
    const patchModalBtn     = document.getElementById('trans-patch-modal');
    const modalModelSelect  = document.getElementById('trans-modal-model');
    const rerollBtn         = document.getElementById('trans-reroll-btn');
    const prevBtn           = document.getElementById('trans-prev-btn');
    const nextBtn           = document.getElementById('trans-next-btn');
    const historyCount      = document.getElementById('trans-history-count');

    apiKeyInput.value       = GM_getValue('apiKey', '');
    modelSelect.value       = GM_getValue('apiModel', 'gemini-3.1-pro-preview');
    modeSelect.value        = GM_getValue('transMode', 'ko');
    previewToggle.checked   = GM_getValue('showPreview', true);
    customPromptInput.value = GM_getValue('customPrompt', baseSystemPrompt);

    // =============================================
    //  드래그 (화면 이탈 방지 로직 적용)
    // =============================================
    let isDragging = false, dragMoved = false, startX, startY, initialLeft, initialTop;

    const clampButtonPosition = () => {
        if (!settingBtn.style.left || !settingBtn.style.top) return;
        let currentLeft = parseFloat(settingBtn.style.left);
        let currentTop = parseFloat(settingBtn.style.top);

        const maxX = window.innerWidth - (settingBtn.offsetWidth || 48);
        const maxY = window.innerHeight - (settingBtn.offsetHeight || 48);

        if (isNaN(currentLeft) || currentLeft < 0) currentLeft = 20;
        if (currentLeft > maxX) currentLeft = maxX - 20;
        if (isNaN(currentTop) || currentTop < 0) currentTop = 20;
        if (currentTop > maxY) currentTop = maxY - 20;

        settingBtn.style.left = currentLeft + 'px';
        settingBtn.style.top = currentTop + 'px';
        GM_setValue('btnPosX', settingBtn.style.left);
        GM_setValue('btnPosY', settingBtn.style.top);
    };

    const savedLeft = GM_getValue('btnPosX', '');
    const savedTop = GM_getValue('btnPosY', '');
    if (savedLeft && savedTop) {
        settingBtn.style.left = savedLeft; settingBtn.style.top = savedTop;
        settingBtn.style.bottom = 'auto'; settingBtn.style.right = 'auto';
    } else {
        settingBtn.style.left = (window.innerWidth - 68) + 'px';
        settingBtn.style.top = (window.innerHeight - 68) + 'px';
    }

    setTimeout(clampButtonPosition, 100);
    window.addEventListener('resize', clampButtonPosition);

    function startDrag(e) {
        if (e.type === 'mousedown' && e.button !== 0) return;
        isDragging = true; dragMoved = false;
        startX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        startY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        const rect = settingBtn.getBoundingClientRect();
        initialLeft = rect.left; initialTop = rect.top;
        settingBtn.style.bottom = 'auto'; settingBtn.style.right = 'auto';
    }
    function moveDrag(e) {
        if (!isDragging) return;
        const dx = (e.type.includes('mouse') ? e.clientX : e.touches[0].clientX) - startX;
        const dy = (e.type.includes('mouse') ? e.clientY : e.touches[0].clientY) - startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved = true;

        if (dragMoved) {
            e.preventDefault();
            const w = window.innerWidth, h = window.innerHeight;
            const btnW = settingBtn.offsetWidth, btnH = settingBtn.offsetHeight;
            let newL = initialLeft + dx, newT = initialTop + dy;

            newL = Math.max(0, Math.min(newL, w - btnW));
            newT = Math.max(0, Math.min(newT, h - btnH));

            settingBtn.style.left = newL + 'px';
            settingBtn.style.top = newT + 'px';
        }
    }
    function stopDrag(e) {
        if (!isDragging) return;
        isDragging = false;
        if (dragMoved) { clampButtonPosition(); }
    }

    settingBtn.addEventListener('mousedown', startDrag); document.addEventListener('mousemove', moveDrag, { passive: false }); document.addEventListener('mouseup', stopDrag);
    settingBtn.addEventListener('touchstart', startDrag, { passive: false }); document.addEventListener('touchmove', moveDrag, { passive: false }); document.addEventListener('touchend', stopDrag);

    // =============================================
    //  유틸리티
    // =============================================
    function showToast(msg, duration = 3000) {
        toast.textContent = msg; toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), duration);
    }
    function setStatus(msg, type = 'info') {
        statusBox.textContent = msg; statusBox.className = `active ${type}`;
    }
    function clearStatus() {
        statusBox.className = ''; statusBox.textContent = '';
    }
    function getToken() {
        const match = document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('access_token='));
        return match ? match.slice('access_token='.length) : null;
    }
    function buildHeaders() {
        const token  = getToken();
        const wrtnId = document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('__w_id='))?.slice('__w_id='.length) ?? '';
        const h = { 'Content-Type': 'application/json', 'platform': 'web', 'wrtn-locale': 'ko-KR' };
        if (token)  h['Authorization'] = `Bearer ${token}`;
        if (wrtnId) h['x-wrtn-id'] = wrtnId;
        return h;
    }
    function parsePath() {
        const m = location.pathname.match(/\/stories\/([^/]+)\/episodes\/([^/]+)/);
        return m ? { storyId: m[1], chatId: m[2] } : null;
    }
    function isChattingPage() { return !!parsePath(); }
    function buildFinalPrompt() {
        let p = GM_getValue('customPrompt', baseSystemPrompt);
        if (GM_getValue('transMode', 'ko') === 'en')
            p += '\n- 대사 형식: 영어 대사는 "영어"(한국어) 형식으로 출력하십시오.';
        return p;
    }

    // =============================================
    //  코드블럭 보존 (기존 방식 유지)
    // =============================================
    function maskCodeBlocks(text) { return text.replace(CODE_BLOCK_RE, (_, inner) => FENCE_OPEN_SUB + inner + FENCE_CLOSE_SUB); }
    function unmaskCodeBlocks(text) { return text.split(FENCE_OPEN_SUB).join('```').split(FENCE_CLOSE_SUB).join('```'); }
    function stripOuterFence(text) { return text.replace(/^```[^\n]*\n([\s\S]*?)\n```\s*$/m, '$1').trim(); }

    // =============================================
    //  API 통신
    // =============================================
    function callGemini(text, overrideModel = null) {
        return new Promise((resolve, reject) => {
            const apiKey = GM_getValue('apiKey', '').trim();
            if (!apiKey) { reject(new Error('API 키가 설정되지 않았습니다.')); return; }

            let modelId = overrideModel || GM_getValue('apiModel', 'gemini-3.1-pro-preview');
            const masked = maskCodeBlocks(text);

            GM_xmlhttpRequest({
                method: 'POST',
                url: `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
                headers: { 'Content-Type': 'application/json' },
                data: JSON.stringify({
                    system_instruction: { parts: [{ text: buildFinalPrompt() }] },
                    contents: [{ parts: [{ text: masked }] }],
                    generationConfig: { temperature: 0.7 },
                }),
                onload(res) {
                    try {
                        const data = JSON.parse(res.responseText);
                        if (data.error) { reject(new Error(data.error.message)); return; }
                        const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
                        const cleaned  = stripOuterFence(raw);
                        const restored = unmaskCodeBlocks(cleaned);
                        resolve(restored);
                    } catch (e) { reject(e); }
                },
                onerror() { reject(new Error('네트워크 오류가 발생했습니다.')); },
            });
        });
    }

    async function fetchLatestBotMessage(chatId) {
        const res = await fetch(`${API_BASE}/v3/chats/${chatId}/messages?limit=10`, { headers: buildHeaders(), credentials: 'include' });
        if (!res.ok) throw new Error(`메시지 조회 실패 (${res.status})`);
        const json = await res.json();
        const msgs = (json.data ?? json).messages ?? [];
        const bot = msgs.find(m => m.role === 'assistant');
        if (!bot) throw new Error('최신 AI 메시지를 찾을 수 없습니다.');
        return { id: bot._id ?? bot.id, content: bot.content ?? '' };
    }

    async function patchMessage(chatId, messageId, content) {
        const res = await fetch(`${API_BASE}/v3/chats/${chatId}/messages/${messageId}`, {
            method: 'PATCH', headers: buildHeaders(), credentials: 'include', body: JSON.stringify({ message: content })
        });
        if (!res.ok) throw new Error(`메시지 수정 실패 (${res.status})`);
        return res.json();
    }

    // =============================================
    //  모달 상태 및 변수 관리
    // =============================================
    let transHistory = [];
    let transIndex = -1;
    let activeOriginalText = "";
    let activeChatId = "";
    let activeMsgId = "";

    const updateModalState = () => {
        if (transHistory.length === 0) return;
        resultContent.innerText = transHistory[transIndex];
        historyCount.innerText = `${transIndex + 1} / ${transHistory.length}`;
        prevBtn.disabled = transIndex === 0;
        nextBtn.disabled = transIndex === transHistory.length - 1;
    };

    const closeResultModal = () => {
        overlay.style.display = 'none'; resultModal.style.display = 'none'; panel.style.display = 'none';
        clearStatus();
    };
    closeModalBtn.addEventListener('click', closeResultModal);
    overlay.addEventListener('click', closeResultModal);

    // 내역 이전, 다음 버튼
    prevBtn.addEventListener('click', () => { if (transIndex > 0) { transIndex--; updateModalState(); } });
    nextBtn.addEventListener('click', () => { if (transIndex < transHistory.length - 1) { transIndex++; updateModalState(); } });

    // 리롤 버튼
    rerollBtn.addEventListener('click', async () => {
        try {
            rerollBtn.innerText = '재생성 중... ⏳'; rerollBtn.disabled = true;
            const newTranslated = await callGemini(activeOriginalText, modalModelSelect.value);
            transHistory.push(newTranslated);
            transIndex = transHistory.length - 1;
            updateModalState();
        } catch(e) { alert(e.message); }
        finally { rerollBtn.innerText = '다시 돌리기'; rerollBtn.disabled = false; }
    });

    // 적용 버튼
    patchModalBtn.addEventListener('click', async () => {
        if (transHistory.length === 0) return;
        try {
            patchModalBtn.innerText = '교체 중... ⏳'; patchModalBtn.disabled = true;
            await patchMessage(activeChatId, activeMsgId, transHistory[transIndex]);
            patchModalBtn.innerText = '교체 완료! ✔️ (새로고침 해주세요)';
            setTimeout(() => { closeResultModal(); patchModalBtn.disabled = false; patchModalBtn.innerText = '이 결과로 교체하기'; }, 2000);
        } catch (e) {
            alert(e.message);
            patchModalBtn.innerText = '이 결과로 교체하기'; patchModalBtn.disabled = false;
        }
    });

    // =============================================
    //  자동 번역 메인 로직
    // =============================================
    async function autoTranslate() {
        const ids = parsePath();
        if (!ids) { showToast('채팅방 페이지에서만 사용 가능합니다.'); return; }

        if (!GM_getValue('apiKey', '').trim()) {
            setStatus('API 키가 설정되지 않았습니다. 위 항목에서 입력 후 저장해주세요.', 'err');
            return;
        }

        translateBtn.disabled = true;
        clearStatus();

        try {
            setStatus('① 최신 AI 메시지 탐색 중…', 'info');
            const { id: msgId, content: original } = await fetchLatestBotMessage(ids.chatId);

            if (!original.trim()) {
                setStatus('번역할 내용이 없습니다.', 'err'); translateBtn.disabled = false; return;
            }

            activeOriginalText = original;
            activeChatId = ids.chatId;
            activeMsgId = msgId;

            const usePreview = GM_getValue('showPreview', true);

            if (usePreview) {
                setStatus('② 번역 중… (팝업 대기 중)', 'info');
                const translated = await callGemini(original);

                transHistory = [translated];
                transIndex = 0;
                modalModelSelect.value = GM_getValue('apiModel', 'gemini-3.1-pro-preview');

                panel.style.display = 'none';
                overlay.style.display = 'block'; resultModal.style.display = 'flex';
                updateModalState();

            } else {
                setStatus('② 번역 중… (잠시 기다려 주세요)', 'info');
                const translated = await callGemini(original);
                setStatus('③ 번역본 자동 삽입 중…', 'info');
                await patchMessage(ids.chatId, msgId, translated);
                setStatus('✅ 번역 교체 완료! 페이지를 새로고침하면 반영됩니다.', 'ok');
            }
        } catch (err) {
            setStatus(`❌ ${err.message}`, 'err');
            console.error('[초월 번역기]', err);
        } finally {
            translateBtn.disabled = false;
        }
    }

    function syncTranslateBtn() {
        translateBtn.style.display = isChattingPage() ? 'inline-block' : 'none';
    }

    // =============================================
    //  설정 패널 이벤트 바인딩
    // =============================================
    settingBtn.addEventListener('click', (e) => {
        if (dragMoved) { e.preventDefault(); e.stopPropagation(); return; }
        const isOpen = panel.style.display === 'block';
        panel.style.display = isOpen ? 'none' : 'block';
        if (!isOpen) clearStatus();
    });

    resetBtn.addEventListener('click', () => {
        if (confirm('지침서를 기본값으로 초기화할까요?'))
            customPromptInput.value = baseSystemPrompt;
    });

    saveBtn.addEventListener('click', () => {
        GM_setValue('apiKey',       apiKeyInput.value.trim());
        GM_setValue('apiModel',     modelSelect.value);
        GM_setValue('transMode',    modeSelect.value);
        GM_setValue('showPreview',  previewToggle.checked);
        GM_setValue('customPrompt', customPromptInput.value);

        saveBtn.textContent = '저장 완료!';
        setTimeout(() => { saveBtn.textContent = '저장하기'; }, 1200);
    });

    translateBtn.addEventListener('click', autoTranslate);

    syncTranslateBtn();
    let _lastUrl = location.href;
    new MutationObserver(() => {
        if (location.href !== _lastUrl) { _lastUrl = location.href; setTimeout(syncTranslateBtn, 800); }
    }).observe(document, { subtree: true, childList: true });
    setInterval(syncTranslateBtn, 2000);

})();
