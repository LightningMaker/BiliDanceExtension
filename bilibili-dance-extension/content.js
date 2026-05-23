// 🌟 全局变量声明
let detector;
let isDancing = false;
let totalScore = 0;
let smoothMatchRate = 0;
let isCameraMirrored = localStorage.getItem('bili_dance_camera_mirrored') === 'true'; // 🎯 摄像头手动镜像状态
let scoringMode = localStorage.getItem('bili_dance_scoring_mode') || 'judgement'; // 'judgement' | 'realtime'
let lastFrameTime = 0; // 实时计分帧间隔时间戳

// 🌟 核心参数设置
const TIME_WINDOW_MS = 80;
let videoPoseBuffer = [];
let camPoseBuffer = [];

const SMOOTH_ALPHA = 0.75;
let lastVideoKeypoints = null;
let lastCamKeypoints = null;

// 🎯 区间平均分判定系统
const EVALUATION_INTERVAL_MS = 500; // 判定区间：每 0.5 秒结算一次
let intervalStartTime = 0;
let intervalScoreSum = 0;
let intervalFrameCount = 0;

let bVideoElement, camVideoElement, canvasElement, ctx;
let biliCanvas, biliCtx;

// ==========================================
// 1. 样式与 UI 初始化
// ==========================================

function injectStyles() {
    const style = document.createElement('style');
    style.innerHTML = `
        /* 右下角：玩家摄像机与骨骼 */
        #dance-cam-container {
            position: absolute; 
            bottom: 80px; 
            right: 30px;
            width: 320px;
            height: 240px;
            z-index: 20000;
            border: 3px solid #fb7299;
            border-radius: 12px;
            background: #000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.8);
            display: none;
        }
        
        /* 左下角：视频角色骨骼提取 */
        #video-skeleton-container {
            position: absolute; 
            bottom: 80px; 
            left: 30px;
            width: 320px;
            height: 240px;
            z-index: 20000;
            border: 3px solid #00ffff;
            border-radius: 12px;
            background: #000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.8);
            display: none;
        }

        #dance-video, #dance-canvas, #bili-video-canvas {
            position: absolute;
            top: 0; left: 0;
            width: 100%; height: 100%;
            border-radius: 10px;
            object-fit: contain;
        }

        /* B站原视频上覆盖的透明骨骼画布 */
        #bili-video-canvas {
            pointer-events: none; 
            z-index: 100;
        }

        /* 提升B站原视频控制栏及各类播放设置、音量调节面板层级，避免全屏时被我们的摄像机/骨骼提取框遮挡 */
        .bpx-player-control-wrap,
        .bilibili-player-video-control-wrap,
        .bpx-player-control-bottom,
        .bpx-player-control-entity,
        .bpx-player-ctrl-volume-box,
        .bpx-player-ctrl-playbackrate-menu,
        .bpx-player-ctrl-quality-menu,
        .bpx-player-ctrl-setting-box,
        .bpx-player-ctrl-subtitle-box,
        .bpx-player-ctrl-aspect-box {
            z-index: 100000 !important;
        }

        /* 匹配率单独放大 */
        .match-rate-text {
            font-size: 40px;
            font-weight: bold;
        }

        /* 得分UI：挂载在右下角的玩家框上方 */
        #dance-score-ui {
            position: absolute;
            top: -90px;
            left: -50%;
            width: 200%;
            text-align: center;
            color: #fff;
            font-size: 60px;
            font-weight: 900;
            text-shadow: 3px 3px 6px #000, 0 0 15px #fb7299;
            white-space: nowrap;
            pointer-events: none;
        }
        
        /* EXCELLENT / GREAT 弹字动画 */
        @keyframes popFade {
            0% { transform: translate(-50%, -50%) scale(0.3); opacity: 0; }
            20% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
            15% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
            80% { transform: translate(-50%, -80%) scale(1); opacity: 1; }
            100% { transform: translate(-50%, -100%) scale(0.8); opacity: 0; }
        }
        .combo-text {
            position: absolute;
            top: 12%;
            left: 50%;
            font-size: 80px;
            font-weight: 900;
            font-style: italic;
            pointer-events: none;
            z-index: 100000;
            animation: popFade 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
            text-shadow: 4px 4px 0px #000, 0 0 20px rgba(0,0,0,0.5);
            letter-spacing: 5px;
        }
        .text-excellent { color: #00ffcc; text-shadow: 4px 4px 0px #000, 0 0 30px #00ffcc; }
        .text-great { color: #ffcc00; text-shadow: 4px 4px 0px #000, 0 0 20px #ffcc00; }

        #dance-result-screen {
            position: absolute;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0,0,0,0.92);
            padding: 40px 60px;
            border-radius: 20px;
            color: #fff;
            z-index: 100000;
            text-align: center;
            display: none;
            min-width: 400px;
            border: 2px solid #fb7299;
            box-shadow: 0 0 40px rgba(251, 114, 153, 0.4);
        }
        
        /* 舞蹈结束！标题 */
        #dance-result-screen h1 {
            font-size: 26px;
            margin: 0 0 20px 0;
            color: #eee;
            font-weight: normal;
        }
        
        /* 本次得分 */
        #dance-result-screen p:nth-of-type(1) {
            font-size: 18px;
            margin: 0;
            color: #ddd;
        }
        
        /* 极其突出的超大“本次得分”数字 */
        #final-score {
            display: block; /* 独立成行 */
            font-size: 90px;
            font-weight: 900;
            color: #fb7299;
            text-shadow: 3px 3px 0 #000, 0 0 25px rgba(251, 114, 153, 0.8);
            margin: 5px 0 15px 0;
            line-height: 1;
        }
        
        /* 历史最高 */
        #dance-result-screen p:nth-of-type(2) {
            font-size: 18px;
            margin: 15px 0;
            color: #999;
        }
        #high-score {
            color: #fff;
            font-weight: bold;
        }
        
        #score-diff-text {
            margin-top: 25px;
            font-weight: 900;
        }
        
        /* 缩小破纪录与未破纪录的提示文字 */
        .new-record {
            color: #00ffcc !important;
            text-shadow: 0 0 15px #00ffcc;
            font-size: 26px !important;
            animation: pulse 1s infinite alternate;
        }
        .normal-diff {
            color: #aaa !important;
            font-size: 18px !important;
        }
        
        @keyframes pulse {
            from { transform: scale(1); }
            to { transform: scale(1.08); }
        }

        #btn-close-result {
            margin-top: 30px;
            font-size: 20px;
            padding: 10px 50px;
            cursor: pointer;
            border-radius: 50px;
            border: none;
            background: #fb7299;
            color: white;
            font-weight: bold;
            transition: 0.3s;
        }
        #btn-close-result:hover { 
            background: #ff85a2; 
            transform: scale(1.05);
            box-shadow: 0 0 15px #fb7299;
        }

        #dance-control-container {
            position: fixed;
            bottom: 30px;
            right: 30px;
            z-index: 9999999;
            display: none;
            align-items: center;
            gap: 12px;
        }

        .btn-dance-together {
            background-color: #fb7299;
            color: white;
            padding: 12px 24px;
            border-radius: 50px;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
            border: none;
            box-shadow: 0 6px 16px rgba(251, 114, 153, 0.5);
            transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        }
        .btn-dance-together:hover { 
            background-color: #ff85a2; 
            transform: translateY(-2px) scale(1.02);
            box-shadow: 0 8px 20px rgba(251, 114, 153, 0.7);
        }

        #btn-dance-settings {
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background-color: rgba(255, 255, 255, 0.9);
            border: 2px solid #fb7299;
            color: #fb7299;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
            transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
            padding: 0;
        }
        #btn-dance-settings:hover {
            background-color: #fb7299;
            color: white;
            box-shadow: 0 8px 20px rgba(251, 114, 153, 0.5);
        }
        #btn-dance-settings:hover svg {
            transform: rotate(45deg);
        }
        #btn-dance-settings svg {
            width: 24px;
            height: 24px;
            transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        }

        #dance-settings-panel {
            position: absolute;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.95);
            padding: 30px 40px;
            border-radius: 20px;
            color: #fff;
            z-index: 100000;
            display: none;
            min-width: 450px;
            border: 2px solid #fb7299;
            box-shadow: 0 0 40px rgba(251, 114, 153, 0.4);
            font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
        }
        
        #dance-settings-panel h2 {
            font-size: 22px;
            margin: 0 0 20px 0;
            color: #fb7299;
            text-align: center;
            font-weight: bold;
            letter-spacing: 2px;
        }
        
        #btn-close-settings {
            position: absolute;
            top: 15px;
            right: 20px;
            font-size: 24px;
            color: #aaa;
            cursor: pointer;
            transition: color 0.2s;
            line-height: 1;
        }
        #btn-close-settings:hover {
            color: #fb7299;
        }
        
        .settings-group {
            margin-bottom: 25px;
            text-align: left;
        }
        
        .settings-label {
            font-size: 15px;
            color: #ccc;
            display: block;
            margin-bottom: 10px;
            font-weight: bold;
        }
        
        .settings-options {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        
        .settings-options.horizontal {
            flex-direction: row;
            gap: 12px;
        }
        
        .settings-options.horizontal .settings-option {
            flex: 1;
            text-align: center;
            padding: 12px;
        }
        
        .settings-option {
            background: rgba(255, 255, 255, 0.05);
            border: 1.5px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 14px 18px;
            cursor: pointer;
            transition: all 0.25s ease;
            text-align: left;
        }
        
        .settings-option:hover {
            background: rgba(251, 114, 153, 0.1);
            border-color: rgba(251, 114, 153, 0.5);
        }
        
        .settings-option.active {
            background: rgba(251, 114, 153, 0.15);
            border-color: #fb7299;
            box-shadow: 0 0 10px rgba(251, 114, 153, 0.3);
        }
        
        .option-title {
            font-size: 16px;
            font-weight: bold;
            color: #fff;
            margin-bottom: 4px;
        }
        
        .settings-option.active .option-title {
            color: #fb7299;
        }
        
        .option-desc {
            font-size: 12px;
            color: #aaa;
            line-height: 1.4;
        }
        
        #btn-save-settings {
            display: block;
            width: 100%;
            margin-top: 10px;
            font-size: 18px;
            padding: 12px 0;
            cursor: pointer;
            border-radius: 50px;
            border: none;
            background: #fb7299;
            color: white;
            font-weight: bold;
            transition: 0.3s;
            text-align: center;
        }
        
        #btn-save-settings:hover {
            background: #ff85a2;
            transform: scale(1.02);
            box-shadow: 0 0 15px rgba(251, 114, 153, 0.6);
        }

    `;
    document.head.appendChild(style);
}

function updateSettingsActiveState(mode, mirrorMirrored) {
    const optJudgement = document.getElementById('opt-score-judgement');
    const optRealtime = document.getElementById('opt-score-realtime');
    if (optJudgement && optRealtime) {
        if (mode === 'judgement') {
            optJudgement.classList.add('active');
            optRealtime.classList.remove('active');
        } else {
            optRealtime.classList.add('active');
            optJudgement.classList.remove('active');
        }
    }

    const optMirrorOn = document.getElementById('opt-mirror-on');
    const optMirrorOff = document.getElementById('opt-mirror-off');
    if (optMirrorOn && optMirrorOff) {
        if (mirrorMirrored) {
            optMirrorOn.classList.add('active');
            optMirrorOff.classList.remove('active');
        } else {
            optMirrorOff.classList.add('active');
            optMirrorOn.classList.remove('active');
        }
    }
}

function openSettingsPanel() {
    const panel = document.getElementById('dance-settings-panel');
    if (!panel) return;

    // Load current settings
    const currentMode = localStorage.getItem('bili_dance_scoring_mode') || 'judgement';
    const currentMirror = localStorage.getItem('bili_dance_camera_mirrored') === 'true';
    updateSettingsActiveState(currentMode, currentMirror);

    // Show panel
    panel.style.display = 'block';
}

function initUI() {
    injectStyles();

    const injectInterval = setInterval(() => {
        bVideoElement = document.querySelector('video');
        const videoContainer = document.querySelector('.bpx-player-video-area');
        const playerContainer = document.querySelector('.bpx-player-container');

        if (bVideoElement && videoContainer && playerContainer) {
            clearInterval(injectInterval);

            // 右下角容器：玩家摄像头
            const container = document.createElement('div');
            container.id = 'dance-cam-container';
            container.innerHTML = `
                <div id="dance-score-ui"><span id="current-score">0</span></div>
                <video id="dance-video" autoplay playsinline></video>
                <canvas id="dance-canvas"></canvas>
            `;
            playerContainer.appendChild(container);

            // 左下角容器：视频角色骨骼提取
            const videoSkeletonContainer = document.createElement('div');
            videoSkeletonContainer.id = 'video-skeleton-container';
            videoSkeletonContainer.innerHTML = `
                <canvas id="bili-video-canvas"></canvas>
            `;
            playerContainer.appendChild(videoSkeletonContainer);

            // 带历史最高分的结算面板
            const resultScreen = document.createElement('div');
            resultScreen.id = 'dance-result-screen';
            resultScreen.innerHTML = `
                <h1>舞蹈结束</h1>
                <p>本次得分: <span id="final-score">0</span></p>
                <p>历史最高: <span id="high-score">0</span></p>
                <div id="score-diff-text"></div>
                <button id="btn-close-result">关闭</button>
            `;
            playerContainer.appendChild(resultScreen);

            document.getElementById('btn-close-result').onclick = () => {
                resultScreen.style.display = 'none';
                if (document.fullscreenElement) document.exitFullscreen();
            };

            camVideoElement = document.getElementById('dance-video');
            canvasElement = document.getElementById('dance-canvas');
            ctx = canvasElement.getContext('2d');

            biliCanvas = document.getElementById('bili-video-canvas');
            biliCtx = biliCanvas.getContext('2d');

            // 🎯 控制按钮容器（“一起跳”和“设置”按钮）
            const controlContainer = document.createElement('div');
            controlContainer.id = 'dance-control-container';

            const danceBtn = document.createElement('button');
            danceBtn.className = 'btn-dance-together';
            danceBtn.innerText = '一起跳';
            danceBtn.onclick = toggleDanceMode;

            const settingsBtn = document.createElement('button');
            settingsBtn.id = 'btn-dance-settings';
            settingsBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/></svg>`;
            settingsBtn.title = '设置';
            settingsBtn.onclick = openSettingsPanel;

            controlContainer.appendChild(danceBtn);
            controlContainer.appendChild(settingsBtn);
            playerContainer.appendChild(controlContainer);

            // 🎯 游戏设置面板
            const settingsPanel = document.createElement('div');
            settingsPanel.id = 'dance-settings-panel';
            settingsPanel.innerHTML = `
                <div id="btn-close-settings">×</div>
                <h2>游戏设置</h2>
                
                <div class="settings-group">
                    <label class="settings-label">计分方式</label>
                    <div class="settings-options">
                        <div class="settings-option active" id="opt-score-judgement">
                            <div class="option-title">判定点计分</div>
                            <div class="option-desc">经典模式：每0.5秒结算一次（Perfect 100分，Great 50分）</div>
                        </div>
                        <div class="settings-option" id="opt-score-realtime">
                            <div class="option-title">实时计分</div>
                            <div class="option-desc">动态模式：根据实时匹配度累加分数</div>
                        </div>
                    </div>
                </div>

                <div class="settings-group">
                    <label class="settings-label">摄像头镜像</label>
                    <div class="settings-options horizontal">
                        <div class="settings-option" id="opt-mirror-on">
                            <div class="option-title">开启</div>
                        </div>
                        <div class="settings-option" id="opt-mirror-off">
                            <div class="option-title">关闭</div>
                        </div>
                    </div>
                </div>
                
                <button id="btn-save-settings">确定</button>
            `;
            playerContainer.appendChild(settingsPanel);

            // 设置面板交互逻辑
            document.getElementById('btn-close-settings').onclick = () => {
                settingsPanel.style.display = 'none';
            };

            const optJudgement = document.getElementById('opt-score-judgement');
            const optRealtime = document.getElementById('opt-score-realtime');
            const optMirrorOn = document.getElementById('opt-mirror-on');
            const optMirrorOff = document.getElementById('opt-mirror-off');

            optJudgement.onclick = () => {
                const isMirror = document.getElementById('opt-mirror-on').classList.contains('active');
                updateSettingsActiveState('judgement', isMirror);
            };
            optRealtime.onclick = () => {
                const isMirror = document.getElementById('opt-mirror-on').classList.contains('active');
                updateSettingsActiveState('realtime', isMirror);
            };
            optMirrorOn.onclick = () => {
                const activeMode = document.getElementById('opt-score-realtime').classList.contains('active') ? 'realtime' : 'judgement';
                updateSettingsActiveState(activeMode, true);
            };
            optMirrorOff.onclick = () => {
                const activeMode = document.getElementById('opt-score-realtime').classList.contains('active') ? 'realtime' : 'judgement';
                updateSettingsActiveState(activeMode, false);
            };

            document.getElementById('btn-save-settings').onclick = () => {
                const selectedMode = document.getElementById('opt-score-realtime').classList.contains('active') ? 'realtime' : 'judgement';
                const selectedMirror = document.getElementById('opt-mirror-on').classList.contains('active');

                localStorage.setItem('bili_dance_scoring_mode', selectedMode);
                scoringMode = selectedMode;

                localStorage.setItem('bili_dance_camera_mirrored', selectedMirror.toString());
                isCameraMirrored = selectedMirror;

                // Sync camera feed transform immediately if camera is active
                const camVideo = document.getElementById('dance-video');
                if (camVideo) {
                    camVideo.style.transform = isCameraMirrored ? 'scaleX(-1)' : 'scaleX(1)';
                }

                settingsPanel.style.display = 'none';
            };

            bVideoElement.addEventListener('ended', onVideoEnded);

            document.addEventListener('fullscreenchange', () => {
                updateControlsVisibility();
                if (!document.fullscreenElement && isDancing) {
                    toggleDanceMode();
                }
            });

            // 🎯 使用 MutationObserver 实时监听 B 站网页全屏类名变化，消除隐藏延迟
            const fullscreenObserver = new MutationObserver(() => {
                updateControlsVisibility();
            });
            fullscreenObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
            if (playerContainer) {
                fullscreenObserver.observe(playerContainer, { attributes: true, attributeFilter: ['class'] });
            }

            // 🎯 调用视频分区检测
            startZoneMonitor();
        }
    }, 1000);
}

// 🎯 检测当前视频是否属于舞蹈区
function checkIsDanceVideo() {
    if (!window.location.href.includes('/video/')) return false;

    let isDance = false;
    const selectors = [
        '.video-info-detail-list a',
        '.tit-tr-1 a',
        '.tag-link',
        'a[href*="/v/dance/"]',
        'a[href*="tid=129"]',
        'a[href*="tid=20"]',
        'a[href*="tid=198"]',
        'a[href*="tid=154"]'
    ];

    try {
        for (let selector of selectors) {
            const elements = document.querySelectorAll(selector);
            for (let el of elements) {
                const text = el.innerText || '';
                if (text.includes('舞')) {
                    isDance = true;
                    break;
                }
            }
            if (isDance) break;
        }

        if (!isDance && window.__INITIAL_STATE__ && window.__INITIAL_STATE__.videoData) {
            const tname = window.__INITIAL_STATE__.videoData.tname || '';
            if (tname.includes('舞')) {
                isDance = true;
            }
        }
    } catch (e) {
        console.warn("舞蹈区检测出错:", e);
    }

    return isDance;
}

// 🎯 动态控制按钮显示与隐藏
// 🎯 更新游戏控制按钮的可见性
function updateControlsVisibility() {
    const container = document.getElementById('dance-control-container');
    const settingsBtn = document.getElementById('btn-dance-settings');
    if (!container) return;

    // 检测用户是否处于浏览器全屏或 B 站网页全屏状态
    const isBrowserFullscreen = !!document.fullscreenElement;
    const isWebFullscreen = document.body.classList.contains('player-mode-webfullscreen') ||
        document.querySelector('.bpx-player-container')?.classList.contains('bpx-state-web-fullscreen');
    const isFullscreen = isBrowserFullscreen || isWebFullscreen;

    // 🎯 游戏中（isDancing 为 true）或 手动全屏观看视频时隐藏按钮，避免影响正常观看
    if (isDancing || (!isDancing && isFullscreen)) {
        container.style.display = 'none';
        return;
    }
    if (checkIsDanceVideo()) {
        container.style.display = 'flex';
        if (settingsBtn) settingsBtn.style.display = 'flex';
    } else {
        container.style.display = 'none';
    }
}

// 🎯 动态控制按钮显示与隐藏
function startZoneMonitor() {
    setInterval(updateControlsVisibility, 1500);
}

// 弹出评价文字
function spawnComboText(type) {
    const playerContainer = document.querySelector('.bpx-player-container');
    if (!playerContainer) return;

    const textEl = document.createElement('div');
    textEl.className = `combo-text text-${type}`;
    textEl.innerText = type === 'excellent' ? 'EXCELLENT' : 'GREAT';

    playerContainer.appendChild(textEl);
    setTimeout(() => {
        if (textEl.parentNode) textEl.parentNode.removeChild(textEl);
    }, 850);
}

// ==========================================
// 2. AI 模型加载与摄像头初始化
// ==========================================

async function loadAIModel() {
    console.log("初始化 TensorFlow...");
    await tf.ready();
    const extDataElement = document.getElementById('dance-ext-data');
    if (!extDataElement) return;

    const extUrl = extDataElement.dataset.url;
    const localModelUrl = extUrl + 'model/movenet-lightning.json';

    const detectorConfig = {
        modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
        modelUrl: localModelUrl
    };
    try {
        detector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, detectorConfig);
        console.log("✅ AI 模型加载成功！");
    } catch (e) {
        console.error("模型加载失败：", e);
    }
}

async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
        camVideoElement.srcObject = stream;
        document.getElementById('dance-cam-container').style.display = 'block';

        // 🎯 应用保存的摄像头镜像状态
        if (isCameraMirrored) {
            camVideoElement.style.transform = 'scaleX(-1)';
        } else {
            camVideoElement.style.transform = 'scaleX(1)';
        }

        return new Promise((resolve) => {
            camVideoElement.onloadedmetadata = () => resolve();
        });
    } catch (err) {
        alert("无法访问摄像头，请检查浏览器权限设置！");
    }
}

// ==========================================
// 3. 游戏控制逻辑
// ==========================================

// === 新增：统一的结束游戏与结算逻辑 ===
function stopDancingAndShowResult() {
    if (!isDancing) return;

    isDancing = false;
    updateControlsVisibility();

    // 1. 恢复按钮状态
    const btn = document.querySelector('.btn-dance-together');
    if (btn) {
        btn.innerText = '一起跳';
        btn.style.backgroundColor = '#fb7299';
    }

    // 2. 隐藏游戏画布与骨架容器
    const camContainer = document.getElementById('dance-cam-container');
    const videoSkeleton = document.getElementById('video-skeleton-container');
    if (camContainer) camContainer.style.display = 'none';
    if (videoSkeleton) videoSkeleton.style.display = 'none';

    // 3. 恢复原视频画布镜像与清理
    if (bVideoElement) bVideoElement.style.transform = 'scaleX(1)';
    if (biliCtx && biliCanvas) biliCtx.clearRect(0, 0, biliCanvas.width, biliCanvas.height);

    // === 🏆 历史最高分结算逻辑 ===
    const idMatch = window.location.pathname.match(/(BV\w+|av\d+|ep\d+)/i);
    const videoId = idMatch ? idMatch[0] : 'global_dance';
    const storageKey = `bili_dance_highscore_${videoId}`;

    // 从本地读取历史最高分，没有则默认为 0
    let prevHighScore = parseInt(localStorage.getItem(storageKey)) || 0;

    const finalScoreEl = document.getElementById('final-score');
    const highScoreEl = document.getElementById('high-score');
    const diffTextEl = document.getElementById('score-diff-text');
    const resultScreen = document.getElementById('dance-result-screen');

    if (finalScoreEl && highScoreEl && diffTextEl && resultScreen) {
        const roundedScore = Math.round(totalScore);
        finalScoreEl.innerText = roundedScore;

        // 🌟 无论是否破纪录，“历史最高”这一栏都只显示玩这局【之前】的最高分
        highScoreEl.innerText = prevHighScore;

        // 对比分数并更新 UI
        if (roundedScore > prevHighScore) {
            // 🎉 打破记录
            let diff = roundedScore - prevHighScore;

            if (prevHighScore === 0) {
                diffTextEl.innerHTML = `🎉 初次游玩此歌曲 🎉`;
            } else {
                diffTextEl.innerHTML = `🎉 新纪录！+ ${diff} 分 🎉`;
            }
            diffTextEl.className = 'new-record';

            // 保存新分数到本地
            localStorage.setItem(storageKey, roundedScore.toString());
        } else {
            // 📉 未打破记录
            let diff = prevHighScore - roundedScore;

            diffTextEl.innerHTML = `距离最高纪录还差 ${diff} 分`;
            diffTextEl.className = 'normal-diff';
        }

        // 显示结算画面
        resultScreen.style.display = 'block';
    }
}

async function toggleDanceMode() {
    const btn = document.querySelector('.btn-dance-together');

    // 如果已经在跳舞被点击，则执行统一的【停止并结算】逻辑
    if (isDancing) {
        stopDancingAndShowResult();
        // 手动退出时退出全屏，结算面板会平滑回落到网页原始播放器上显示
        if (document.fullscreenElement) document.exitFullscreen();
        return;
    }

    if (!detector) await loadAIModel();
    await startCamera();

    const playerContainer = document.querySelector('.bpx-player-container');
    if (playerContainer && !document.fullscreenElement) {
        try { await playerContainer.requestFullscreen(); }
        catch (e) { console.log("浏览器全屏请求被拒绝:", e); }
    }

    document.getElementById('video-skeleton-container').style.display = 'block';

    const videoRatio = (bVideoElement.videoHeight || 1080) / (bVideoElement.videoWidth || 1920);
    document.getElementById('video-skeleton-container').style.height = (320 * videoRatio) + 'px';

    const camRatio = (camVideoElement.videoHeight || 480) / (camVideoElement.videoWidth || 640);
    document.getElementById('dance-cam-container').style.height = (320 * camRatio) + 'px';

    canvasElement.width = camVideoElement.videoWidth;
    canvasElement.height = camVideoElement.videoHeight;
    biliCanvas.width = bVideoElement.videoWidth;
    biliCanvas.height = bVideoElement.videoHeight;

    bVideoElement.style.transform = 'scaleX(-1)';
    bVideoElement.currentTime = 0;

    isDancing = true;
    updateControlsVisibility();
    totalScore = 0;
    smoothMatchRate = 0;
    lastFrameTime = performance.now();

    intervalStartTime = performance.now();
    intervalScoreSum = 0;
    intervalFrameCount = 0;

    videoPoseBuffer = [];
    camPoseBuffer = [];
    lastVideoKeypoints = null;
    lastCamKeypoints = null;

    document.getElementById('current-score').innerText = '0';

    bVideoElement.play();
    detectPoseLoop();
}

function onVideoEnded() {
    // 视频正常播放结束时，同样调用统一的【停止并结算】逻辑
    stopDancingAndShowResult();
}

// ==========================================
// 4. 核心推理与算法
// ==========================================

function mirrorPoseData(pose, videoWidth) {
    const swapMap = [0, 2, 1, 4, 3, 6, 5, 8, 7, 10, 9, 12, 11, 14, 13, 16, 15];
    let mirroredKeypoints = new Array(17);
    for (let i = 0; i < pose.keypoints.length; i++) {
        let pt = pose.keypoints[i];
        mirroredKeypoints[swapMap[i]] = { ...pt, x: videoWidth - pt.x };
    }
    return { ...pose, keypoints: mirroredKeypoints };
}

function smoothKeypoints(currentKps, lastKps) {
    if (!lastKps) return currentKps;
    return currentKps.map((pt, i) => {
        let lastPt = lastKps[i];
        if (pt.score < 0.3 || lastPt.score < 0.3) return pt;
        return {
            ...pt,
            x: pt.x * SMOOTH_ALPHA + lastPt.x * (1 - SMOOTH_ALPHA),
            y: pt.y * SMOOTH_ALPHA + lastPt.y * (1 - SMOOTH_ALPHA)
        };
    });
}

async function detectPoseLoop() {
    if (!isDancing || bVideoElement.paused || bVideoElement.ended) return;

    const now = performance.now();
    const deltaTimeSeconds = Math.min(0.1, (now - lastFrameTime) / 1000.0);
    lastFrameTime = now;

    try {
        const videoPoses = await detector.estimatePoses(bVideoElement);
        const camPoses = await detector.estimatePoses(camVideoElement);

        if (videoPoses.length > 0 && camPoses.length > 0) {
            let rawVideoPose = mirrorPoseData(videoPoses[0], bVideoElement.videoWidth);
            let rawCamPose = camPoses[0];

            if (isCameraMirrored) {
                rawCamPose = mirrorPoseData(rawCamPose, camVideoElement.videoWidth);
            }

            rawVideoPose.keypoints = smoothKeypoints(rawVideoPose.keypoints, lastVideoKeypoints);
            rawCamPose.keypoints = smoothKeypoints(rawCamPose.keypoints, lastCamKeypoints);

            lastVideoKeypoints = rawVideoPose.keypoints;
            lastCamKeypoints = rawCamPose.keypoints;

            drawSkeleton(biliCtx, biliCanvas, rawVideoPose.keypoints, '#00ffff');
            drawSkeleton(ctx, canvasElement, rawCamPose.keypoints, '#fb7299');

            videoPoseBuffer.push({ pose: rawVideoPose, time: now });
            camPoseBuffer.push({ pose: rawCamPose, time: now });

            videoPoseBuffer = videoPoseBuffer.filter(p => now - p.time <= TIME_WINDOW_MS);
            camPoseBuffer = camPoseBuffer.filter(p => now - p.time <= TIME_WINDOW_MS);

            let maxMatchRate = 0;
            for (let vData of videoPoseBuffer) {
                let score = calculateSimilarity(vData.pose.keypoints, rawCamPose.keypoints);
                if (score > maxMatchRate) maxMatchRate = score;
            }
            for (let cData of camPoseBuffer) {
                let score = calculateSimilarity(rawVideoPose.keypoints, cData.pose.keypoints);
                if (score > maxMatchRate) maxMatchRate = score;
            }

            smoothMatchRate = (smoothMatchRate * 0.7) + (maxMatchRate * 0.3);
            const displayRate = maxMatchRate === 0 ? 0 : smoothMatchRate;

            // 🎯 实时计分模式下，每帧累加分数
            if (scoringMode === 'realtime') {
                const pointsToAdd = Math.max(0, (displayRate - 50) * 5.7) * deltaTimeSeconds;
                totalScore += pointsToAdd;
                const scoreDisplay = document.getElementById('current-score');
                if (scoreDisplay) scoreDisplay.innerText = Math.round(totalScore);
            }

            intervalScoreSum += displayRate;
            intervalFrameCount++;

            if (now - intervalStartTime >= EVALUATION_INTERVAL_MS) {
                if (intervalFrameCount > 0) {
                    let averageRate = intervalScoreSum / intervalFrameCount;

                    if (averageRate >= 85) {
                        spawnComboText('excellent');
                        if (scoringMode === 'judgement') {
                            totalScore += 100;
                        }
                    } else if (averageRate >= 70) {
                        spawnComboText('great');
                        if (scoringMode === 'judgement') {
                            totalScore += 50;
                        }
                    }

                    if (scoringMode === 'judgement') {
                        const scoreDisplay = document.getElementById('current-score');
                        if (scoreDisplay) scoreDisplay.innerText = Math.round(totalScore);
                    }
                }

                intervalStartTime = now;
                intervalScoreSum = 0;
                intervalFrameCount = 0;
            }
        }
    } catch (e) {
        // 忽略推理中的偶发错误
    }

    requestAnimationFrame(detectPoseLoop);
}

// 🔥 严格版判定算法 
function calculateSimilarity(videoKp, camKp) {
    let totalScore = 0;
    let totalMaxWeight = 0;

    const segments = [
        { v1: 5, v2: 6, c1: 5, c2: 6, weight: 0 },
        { v1: 11, v2: 12, c1: 11, c2: 12, weight: 0 },
        { v1: 5, v2: 7, c1: 5, c2: 7, weight: 2 },
        { v1: 7, v2: 9, c1: 7, c2: 9, weight: 2 },
        { v1: 6, v2: 8, c1: 6, c2: 8, weight: 2 },
        { v1: 8, v2: 10, c1: 8, c2: 10, weight: 2 },
        { v1: 11, v2: 13, c1: 11, c2: 13, weight: 1.0 },
        { v1: 13, v2: 15, c1: 13, c2: 15, weight: 0.8 },
        { v1: 12, v2: 14, c1: 12, c2: 14, weight: 1.0 },
        { v1: 14, v2: 16, c1: 14, c2: 16, weight: 0.8 }
    ];

    function getAngle(p1, p2) { return Math.atan2(p2.y - p1.y, p2.x - p1.x); }

    segments.forEach(seg => {
        if (seg.weight === 0) return;

        const vPt1 = videoKp[seg.v1], vPt2 = videoKp[seg.v2];
        const cPt1 = camKp[seg.c1], cPt2 = camKp[seg.c2];

        if (vPt1.score > 0.35 && vPt2.score > 0.35) {
            totalMaxWeight += seg.weight;

            if (cPt1.score > 0.35 && cPt2.score > 0.35) {
                let diff = Math.abs((getAngle(vPt1, vPt2) - getAngle(cPt1, cPt2)) * 180 / Math.PI);
                if (diff > 180) diff = 360 - diff;

                let matchPercentage = Math.max(0, 100 - (Math.max(0, diff - 8) / 20 * 100));
                totalScore += (matchPercentage * seg.weight);
            }
        }
    });

    if (totalMaxWeight === 0) return 0;
    return totalScore / totalMaxWeight;
}

// ==========================================
// 5. 辅助绘图
// ==========================================

function drawSkeleton(ctx, canvas, keypoints, color) {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const adjacentKeyPoints = [
        [5, 7], [7, 9], [6, 8], [8, 10],
        [11, 13], [13, 15], [12, 14], [14, 16],
        [5, 6], [11, 12], [5, 11], [6, 12]
    ];

    ctx.strokeStyle = color;
    ctx.lineWidth = canvas.width > 1000 ? 8 : 4;
    ctx.lineCap = "round";

    adjacentKeyPoints.forEach(pair => {
        const p1 = keypoints[pair[0]];
        const p2 = keypoints[pair[1]];
        if (p1.score > 0.35 && p2.score > 0.35) {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
        }
    });

    ctx.fillStyle = "#ffffff";
    const radius = canvas.width > 1000 ? 10 : 5;
    for (let i = 5; i < keypoints.length; i++) {
        if (keypoints[i].score > 0.35) {
            ctx.beginPath();
            ctx.arc(keypoints[i].x, keypoints[i].y, radius, 0, 2 * Math.PI);
            ctx.fill();
        }
    }
}

window.addEventListener('load', initUI);