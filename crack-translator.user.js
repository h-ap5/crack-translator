// ==UserScript==
// @name         크랙 초월 번역기
// @namespace    http://tampermonkey.net/
// @version      2.5
// @description  웹에서 즉석으로 번역을 확인하고 복사하는 확장 프로그램 입니다
// @match        https://crack.wrtn.ai/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @connect      generativelanguage.googleapis.com
// ==/UserScript==

(function() {
    'use strict';

    // 1. 번역 지침서의 근간
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
- 번역 외의 부연 설명, 인사말, 감상 등은 절대 출력하지 마십시오. 오직 결과물만 제공하십시오. `;

    // 2. 화면 꾸미기
    GM_addStyle(`
        #trans-setting-btn {
            position: fixed; bottom: 20px; right: 20px; z-index: 999999;
            background-color: #FF4432; color: white; border: none; border-radius: 50%;
            width: 48px; height: 48px; font-size: 24px; cursor: move; /* 움직일 수 있다는 표시 */
            box-shadow: 0 4px 10px rgba(0,0,0,0.2); transition: background-color 0.3s; 
            display: flex; align-items: center; justify-content: center;
            touch-action: none; /* 모바일에서 드래그 시 화면 멈춤 방지 */
        }
        #trans-setting-btn:hover { background-color: #e03c2a; }
        
        /* 설정창도 이제 화면 정중앙에 우아하게 뜹니다 */
        #trans-setting-panel {
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            z-index: 9999999; background-color: #F7F7F5; border: 1px solid #C7C5BD; 
            border-radius: 12px; padding: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); 
            display: none; width: 300px; max-width: 85vw;
        }
        #trans-setting-panel h4 { margin: 0 0 12px 0; color: #1A1918; font-family: sans-serif; font-size: 16px; text-align: center; }
        .trans-label { font-size: 13px; color: #61605A; margin-bottom: 4px; display: block; font-family: sans-serif; font-weight: bold; }
        #trans-api-key, #trans-model-select, #trans-mode-select, #trans-custom-prompt {
            width: 100%; box-sizing: border-box; padding: 8px; margin-bottom: 12px;
            border: 1px solid #C7C5BD; border-radius: 4px; font-size: 13px; font-family: sans-serif;
        }
        #trans-custom-prompt { resize: vertical; }
        .trans-btn-group { display: flex; gap: 8px; margin-top: 8px; }
        #trans-reset-btn {
            flex: 1; background-color: #61605A; color: white; border: none;
            padding: 10px; border-radius: 6px; cursor: pointer; font-size: 13px;
        }
        #trans-reset-btn:hover { background-color: #42413D; }
        #trans-save-btn {
            flex: 2; background-color: #FF4432; color: white; border: none;
            padding: 10px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 13px;
        }
        #trans-save-btn:hover { background-color: #e03c2a; }
        
        /* ✨ 화면 정중앙에 뜨는 번역 대기창 */
        .trans-tooltip {
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background-color: white; border: 1px solid #C7C5BD; border-radius: 12px;
            padding: 16px 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); z-index: 999999; 
            width: max-content; max-width: 85vw; color: #1A1918; font-size: 14px;
            line-height: 1.6; font-family: sans-serif; white-space: pre-wrap; text-align: center;
        }
        /* ✨ 다시 앙증맞아진 번역 단추 */
        .trans-action-btn {
            background-color: #FF4432; color: white; border: none; padding: 8px 16px;
            border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-top: 8px;
        }
        .trans-action-btn:hover { background-color: #e03c2a; }

        /* 화면 중앙에 뜨는 우아한 결과창 */
        #trans-result-overlay {
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background-color: rgba(0, 0, 0, 0.4); z-index: 9999998; display: none;
        }
        #trans-result-modal {
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background-color: #FFFFFF; border-radius: 12px; padding: 24px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2); z-index: 9999999;
            width: 85%; max-width: 600px; display: none; flex-direction: column; gap: 16px;
        }
        #trans-result-modal h3 { margin: 0; color: #1A1918; font-family: sans-serif; font-size: 18px; }
        #trans-result-content {
            background-color: #F7F7F5; padding: 16px; border-radius: 8px;
            font-size: 14px; line-height: 1.6; color: #1A1918; border: 1px solid #E5E5E1;
            max-height: 50vh; overflow-y: auto; white-space: pre-wrap; font-family: sans-serif;
        }
        .trans-modal-btns { display: flex; justify-content: flex-end; gap: 8px; }
        .trans-close-btn {
            background-color: #E5E5E1; color: #1A1918; border: none; padding: 10px 20px;
            border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px;
        }
        .trans-close-btn:hover { background-color: #D4D4D0; }
        .trans-copy-btn {
            background-color: #FF4432; color: white; border: none; padding: 10px 20px;
            border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px;
        }
        .trans-copy-btn:hover { background-color: #e03c2a; }
    `);

    // 3. 뼈대 만들기
    const btn = document.createElement('button');
    btn.id = 'trans-setting-btn';
    btn.innerHTML = '⚙️';
    
    // 이전에 옮겨둔 위치가 있다면 기억해 냅니다
    const savedLeft = GM_getValue('btnPosX', '');
    const savedTop = GM_getValue('btnPosY', '');
    if (savedLeft && savedTop) {
        btn.style.left = savedLeft;
        btn.style.top = savedTop;
        btn.style.bottom = 'auto';
        btn.style.right = 'auto';
    }
    document.body.appendChild(btn);

    const panel = document.createElement('div');
    panel.id = 'trans-setting-panel';
    panel.innerHTML = `
        <h4>초월 번역 설정</h4>
        
        <span class="trans-label">제미나이 마법 선택:</span>
        <select id="trans-model-select">
            <option value="gemini-3.1-pro-preview">제미나이 3.1 프로 프리뷰 (최상급/권장)</option>
            <option value="gemini-3-flash-preview">제미나이 3 플래시 프리뷰 (최신 다목적)</option>
            <option value="gemini-2.5-flash">제미나이 2.5 플래시 (가장 빠름)</option>
        </select>

        <span class="trans-label">API 키:</span>
        <input type="text" id="trans-api-key" placeholder="AIza... 로 시작하는 열쇠를 넣어주세요">
        
        <span class="trans-label">번역 방식:</span>
        <select id="trans-mode-select">
            <option value="ko">한글 전용 (기본)</option>
            <option value="en">영문 혼용 (영어/한국어)</option>
        </select>

        <span class="trans-label">번역 지침서 (마음껏 수정하셔요):</span>
        <textarea id="trans-custom-prompt" rows="8"></textarea>

        <div class="trans-btn-group">
            <button id="trans-reset-btn">기본값 복구</button>
            <button id="trans-save-btn">저장하기</button>
        </div>
    `;
    document.body.appendChild(panel);

    const overlay = document.createElement('div');
    overlay.id = 'trans-result-overlay';
    document.body.appendChild(overlay);

    const resultModal = document.createElement('div');
    resultModal.id = 'trans-result-modal';
    resultModal.innerHTML = `
        <h3>✨ 초월 번역 결과</h3>
        <div id="trans-result-content"></div>
        <div class="trans-modal-btns">
            <button class="trans-close-btn" id="trans-close-modal">닫기</button>
            <button class="trans-copy-btn" id="trans-copy-modal">복사하기</button>
        </div>
    `;
    document.body.appendChild(resultModal);

    const apiKeyInput = document.getElementById('trans-api-key');
    const modelSelect = document.getElementById('trans-model-select');
    const modeSelect = document.getElementById('trans-mode-select');
    const customPromptInput = document.getElementById('trans-custom-prompt');
    const saveBtn = document.getElementById('trans-save-btn');
    const resetBtn = document.getElementById('trans-reset-btn');
    const resultContent = document.getElementById('trans-result-content');
    const closeModalBtn = document.getElementById('trans-close-modal');
    const copyModalBtn = document.getElementById('trans-copy-modal');

    apiKeyInput.value = GM_getValue('apiKey', '');
    modelSelect.value = GM_getValue('apiModel', 'gemini-3.1-pro-preview');
    modeSelect.value = GM_getValue('transMode', 'ko');
    customPromptInput.value = GM_getValue('customPrompt', baseSystemPrompt);

    resetBtn.addEventListener('click', () => {
        if(confirm("지침서를 제가 처음 드린 기본 상태로 되돌리시겠어요?")) {
            customPromptInput.value = baseSystemPrompt;
        }
    });

    saveBtn.addEventListener('click', () => {
        GM_setValue('apiKey', apiKeyInput.value.trim());
        GM_setValue('apiModel', modelSelect.value);
        GM_setValue('transMode', modeSelect.value);
        GM_setValue('customPrompt', customPromptInput.value);
        
        saveBtn.innerText = '저장 완료!';
        setTimeout(() => {
            saveBtn.innerText = '저장하기';
            panel.style.display = 'none';
            overlay.style.display = 'none'; // 설정창 뒤의 어두운 배경도 치워줍니다
        }, 1000);
    });

    const closeResultModal = () => {
        overlay.style.display = 'none';
        resultModal.style.display = 'none';
        panel.style.display = 'none';
        copyModalBtn.innerText = '복사하기'; 
    };
    closeModalBtn.addEventListener('click', closeResultModal);
    overlay.addEventListener('click', closeResultModal);

    copyModalBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(resultContent.innerText).then(() => {
            copyModalBtn.innerText = '복사 완료! ✔️';
            setTimeout(() => {
                copyModalBtn.innerText = '복사하기';
            }, 2000);
        }).catch(() => {
            copyModalBtn.innerText = '복사 실패 ❌';
        });
    });

    // ✨ 단추를 이리저리 끌고 다니는 드래그 마법
    let isDragging = false;
    let dragMoved = false;
    let startX, startY, initialLeft, initialTop;

    function startDrag(e) {
        if (e.type === 'mousedown' && e.button !== 0) return; // 왼쪽 클릭만 허용
        isDragging = true;
        dragMoved = false;
        
        const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        
        startX = clientX;
        startY = clientY;
        
        const rect = btn.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
        
        btn.style.bottom = 'auto';
        btn.style.right = 'auto';
    }

    function moveDrag(e) {
        if (!isDragging) return;
        
        const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        
        const dx = clientX - startX;
        const dy = clientY - startY;
        
        // 살짝만 움직여도 드래그로 판정합니다
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
            dragMoved = true;
        }
        
        if (dragMoved) {
            e.preventDefault(); // 휴대전화에서 화면이 같이 구르는 것을 막습니다
            let newLeft = initialLeft + dx;
            let newTop = initialTop + dy;
            
            // 단추가 화면 밖으로 도망가지 못하게 울타리를 칩니다
            const maxX = window.innerWidth - btn.offsetWidth;
            const maxY = window.innerHeight - btn.offsetHeight;
            
            btn.style.left = Math.max(0, Math.min(newLeft, maxX)) + 'px';
            btn.style.top = Math.max(0, Math.min(newTop, maxY)) + 'px';
        }
    }

    function stopDrag(e) {
        if (!isDragging) return;
        isDragging = false;
        
        if (dragMoved) {
            // 위치를 기억해 둡니다
            GM_setValue('btnPosX', btn.style.left);
            GM_setValue('btnPosY', btn.style.top);
        }
    }

    btn.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', moveDrag, { passive: false });
    document.addEventListener('mouseup', stopDrag);

    btn.addEventListener('touchstart', startDrag, { passive: false });
    document.addEventListener('touchmove', moveDrag, { passive: false });
    document.addEventListener('touchend', stopDrag);

    // 단추를 '클릭'했을 때만 설정창이 열리도록 합니다 (드래그와 구분)
    btn.addEventListener('click', (e) => {
        if (dragMoved) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        panel.style.display = panel.style.display === 'none' || panel.style.display === '' ? 'block' : 'none';
        overlay.style.display = panel.style.display === 'block' ? 'block' : 'none'; // 배경을 우아하게 어둡게
    });

    let tooltip = null;

    const handleTextSelection = (event) => {
        if (panel.contains(event.target) || btn.contains(event.target) || resultModal.contains(event.target)) return;
        if (tooltip && tooltip.contains(event.target)) return;

        setTimeout(() => {
            const selectedText = window.getSelection().toString().trim();

            if (!selectedText) {
                if (tooltip) { tooltip.remove(); tooltip = null; }
                return;
            }

            if (tooltip) tooltip.remove();

            tooltip = document.createElement('div');
            tooltip.className = 'trans-tooltip';
            
            const actionBtn = document.createElement('button');
            actionBtn.className = 'trans-action-btn';
            actionBtn.innerText = '✨ 번역하기';
            
            actionBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                
                const apiKey = GM_getValue('apiKey', '').trim();
                if (!apiKey) {
                    tooltip.innerHTML = "설정 단추(⚙️)를 눌러 <b>API 키</b>를 먼저 꽂아주셔요.";
                    return;
                }

                tooltip.innerText = "마법이 문장을 다시 쓰는 중이랍니다... ⏳";

                let currentModel = GM_getValue('apiModel', 'gemini-3.1-pro-preview');
                if (currentModel === 'gemini-3.0-flash' || currentModel === 'gemini-1.5-pro') {
                    currentModel = 'gemini-3.1-pro-preview';
                }
                
                const currentMode = GM_getValue('transMode', 'ko');
                let finalPrompt = GM_getValue('customPrompt', baseSystemPrompt);
                
                if (currentMode === 'en') {
                    finalPrompt += `\n- 대사 형식: 영어 대사는 "영어"(한국어) 형식으로 출력하십시오.`;
                }

                GM_xmlhttpRequest({
                    method: "POST",
                    url: `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`,
                    headers: { "Content-Type": "application/json" },
                    data: JSON.stringify({
                        system_instruction: { parts: [{ text: finalPrompt }] },
                        contents: [{ parts: [{ text: selectedText }] }],
                        generationConfig: { temperature: 0.7 }
                    }),
                    onload: function(response) {
                        try {
                            const data = JSON.parse(response.responseText);
                            let resultText = "";

                            if (data.candidates && data.candidates.length > 0) {
                                resultText = data.candidates[0].content.parts[0].text;
                            } else if (data.error) {
                                resultText = `어머, 마법이 실패했군요.\n(사유: ${data.error.message})`;
                            } else {
                                resultText = "마법이 빗나갔군요. API 키와 모델을 다시 확인해 보셔요.";
                            }

                            tooltip.remove();
                            tooltip = null;
                            
                            resultContent.innerText = resultText.replace(/```/g, '').trim();
                            overlay.style.display = 'block';
                            resultModal.style.display = 'flex';

                        } catch (err) {
                            tooltip.innerText = "결과를 읽어 들이는 중에 엉킴이 발생했답니다.";
                        }
                    },
                    onerror: function(error) {
                        tooltip.innerText = "통신에 문제가 생겼답니다. 연결 상태를 확인해 주시지요.";
                    }
                });
            });

            // 안내 창 텍스트 없이 앙증맞은 버튼만 딱 보여줍니다
            tooltip.appendChild(actionBtn);
            document.body.appendChild(tooltip);
        }, 100);
    };

    document.addEventListener('mouseup', handleTextSelection);
    document.addEventListener('touchend', handleTextSelection);

    const closeTooltip = (event) => {
        if (tooltip && !tooltip.contains(event.target) && window.getSelection().toString().trim() === '') {
            tooltip.remove();
            tooltip = null;
        }
    };

    document.addEventListener('mousedown', closeTooltip);
    document.addEventListener('touchstart', closeTooltip);
})();
