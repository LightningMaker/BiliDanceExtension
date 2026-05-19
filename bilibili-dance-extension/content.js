// 🌟 全局变量声明
let detector;
let isDancing = false;
let totalScore = 0;
let smoothMatchRate = 0; 
let isCameraMirrored = false; // 🎯 摄像头手动镜像状态

// 🌟 核心参数设置 (🔥 变态级严格)
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
            z-index: 99999;
            border: 3px solid #fb7299;
            border-radius: 12px;
            background: #000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.8);
            display: none;
        }
        
        /* 镜像开关按钮样式 */
        #btn-mirror-cam {
            position: absolute;
            top: 10px;
            right: 10px;
            z-index: 100000;
            background: rgba(0, 0, 0, 0.6);
            color: #fff;
            border: 1px solid #fb7299;
            padding: 4px 10px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s;
        }
        #btn-mirror-cam:hover { background: #fb7299; }
        #btn-mirror-cam.active {
            background: #fb7299;
            color: white;
            box-shadow: 0 0 8px #fb7299;
        }
        
        /* 左下角：视频角色骨骼提取 */
        #video-skeleton-container {
            position: absolute; 
            bottom: 80px; 
            left: 30px;
            width: 320px;
            height: 240px;
            z-index: 99999;
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

        /* 得分UI：挂载在右下角的玩家框上方 */
        #dance-score-ui {
            position: absolute;
            top: -90px;
            left: 0;
            width: 100%;
            text-align: center;
            color: #fff;
            font-size: 60px;
            font-weight: 900;
            text-shadow: 3px 3px 6px #000, 0 0 15px #fb7299;
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
            background: rgba(0,0,0,0.9);
            padding: 40px;
            border-radius: 20px;
            color: #fb7299;
            font-size: 40px;
            z-index: 100000;
            text-align: center;
            display: none;
        }
        #btn-close-result {
            margin-top: 20px;
            font-size: 24px;
            padding: 10px 30px;
            cursor: pointer;
            border-radius: 8px;
            border: none;
            background: #fb7299;
            color: white;
        }
        .btn-dance-together {
            position: fixed;
            bottom: 30px;
            right: 30px;
            z-index: 9999999;
            background-color: #fb7299;
            color: white;
            padding: 12px 20px;
            border-radius: 50px;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
            border: none;
            box-shadow: 0 6px 16px rgba(251, 114, 153, 0.5);
            transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
            display: none; /* 🎯 默认隐藏，只有舞蹈区才显示 */
        }
        .btn-dance-together:hover { 
            background-color: #ff85a2; 
            transform: translateY(-5px) scale(1.05);
            box-shadow: 0 10px 24px rgba(251, 114, 153, 0.7);
        }
    `;
    document.head.appendChild(style);
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
                <button id="btn-mirror-cam">镜像：关</button>
                <video id="dance-video" autoplay playsinline></video>
                <canvas id="dance-canvas"></canvas>
            `;
            playerContainer.appendChild(container); 

            // 镜像按钮点击逻辑
            const mirrorBtn = document.getElementById('btn-mirror-cam');
            mirrorBtn.onclick = () => {
                isCameraMirrored = !isCameraMirrored;
                camVideoElement = document.getElementById('dance-video'); 
                if (isCameraMirrored) {
                    mirrorBtn.innerText = '镜像：开';
                    mirrorBtn.classList.add('active');
                    camVideoElement.style.transform = 'scaleX(-1)'; // 视觉翻转
                } else {
                    mirrorBtn.innerText = '镜像：关';
                    mirrorBtn.classList.remove('active');
                    camVideoElement.style.transform = 'scaleX(1)';  // 恢复正常
                }
            };

            // 左下角容器：视频角色骨骼提取
            const videoSkeletonContainer = document.createElement('div');
            videoSkeletonContainer.id = 'video-skeleton-container';
            videoSkeletonContainer.innerHTML = `
                <canvas id="bili-video-canvas"></canvas>
            `;
            playerContainer.appendChild(videoSkeletonContainer); 

            const resultScreen = document.createElement('div');
            resultScreen.id = 'dance-result-screen';
            resultScreen.innerHTML = `
                <h1>舞蹈结束！</h1>
                <p>你的总分: <span id="final-score">0</span></p>
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

            const danceBtn = document.createElement('button');
            danceBtn.className = 'btn-dance-together';
            danceBtn.innerText = '一起跳';
            danceBtn.onclick = toggleDanceMode;
            document.body.appendChild(danceBtn);
            
            bVideoElement.addEventListener('ended', onVideoEnded);
            
            document.addEventListener('fullscreenchange', () => {
                if (!document.fullscreenElement && isDancing) {
                    toggleDanceMode();
                }
            });

            // 🎯 启动分区监控
            startZoneMonitor();
        }
    }, 1000);
}

// 🎯 增强版：检测当前视频是否属于舞蹈区
function checkIsDanceVideo() {
    // 如果不在视频播放页（比如首页），直接返回 false
    if (!window.location.href.includes('/video/')) return false;

    let isDance = false;

    // 1. 扫描网页中的面包屑导航和标签（兼容 B 站新旧版 UI）
    const selectors = [
        '.video-info-detail-list a', // 新版标题下方的分类面包屑
        '.tit-tr-1 a',               // 老版分类面包屑
        '.tag-link',                 // 视频下方的用户标签 (Tag)
        'a[href*="/v/dance/"]',      // 链接中直接包含舞蹈区路由
        'a[href*="tid=129"]',        // 链接包含舞蹈区主分类ID
        'a[href*="tid=20"]',         // 宅舞分类ID
        'a[href*="tid=198"]',        // 街舞分类ID
        'a[href*="tid=154"]'         // 舞蹈综合分类ID
    ];

    try {
        for (let selector of selectors) {
            const elements = document.querySelectorAll(selector);
            for (let el of elements) {
                const text = el.innerText || '';
                const href = el.href || '';
                
                // 只要分类名称或标签里带“舞”，或者是跳舞游戏(舞力全开)，或者是直接指向舞蹈区的链接
                if (text.includes('舞')) {
                    isDance = true;
                    break; // 只要找到一个特征，就认定为舞蹈相关，跳出循环
                }
            }
            if (isDance) break;
        }

        // 2. 兜底策略：如果刚才刚刷新页面，DOM还没渲染完，读取全局变量
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

// 🎯 动态控制按钮显示与隐藏（适配B站无刷新页面跳转）
function startZoneMonitor() {
    setInterval(() => {
        const btn = document.querySelector('.btn-dance-together');
        if (!btn) return;

        // 如果正在跳舞中，绝对不要隐藏按钮
        if (isDancing) {
            btn.style.display = 'block';
            return;
        }

        // 检测是否在舞蹈区
        if (checkIsDanceVideo()) {
            btn.style.display = 'block';
        } else {
            btn.style.display = 'none';
        }
    }, 1500); // 每1.5秒检查一次
}

// 弹出评价文字
function spawnComboText(type) {
    const playerContainer = document.querySelector('.bpx-player-container');
    if (!playerContainer) return;

    const textEl = document.createElement('div');
    textEl.className = `combo-text text-${type}`;
    textEl.innerText = type === 'excellent' ? 'EXCELLENT' : 'GREAT';

    playerContainer.appendChild(textEl);

    // 动画结束后清理DOM
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

async function toggleDanceMode() {
    const btn = document.querySelector('.btn-dance-together');
    
    if (isDancing) {
        isDancing = false;
        btn.innerText = '一起跳';
        btn.style.backgroundColor = '#fb7299';
        document.getElementById('dance-cam-container').style.display = 'none';
        document.getElementById('video-skeleton-container').style.display = 'none'; // 隐藏视频骨架
        bVideoElement.style.transform = 'scaleX(1)'; 
        biliCtx.clearRect(0, 0, biliCanvas.width, biliCanvas.height);
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
    
    btn.innerText = '⏹ 停止跳舞';
    btn.style.backgroundColor = '#ff3333';
    
    // 显示左下角的视频骨骼容器
    document.getElementById('video-skeleton-container').style.display = 'block';

    // 动态计算宽高比
    const videoRatio = (bVideoElement.videoHeight || 1080) / (bVideoElement.videoWidth || 1920);
    document.getElementById('video-skeleton-container').style.height = (320 * videoRatio) + 'px';

    const camRatio = (camVideoElement.videoHeight || 480) / (camVideoElement.videoWidth || 640);
    document.getElementById('dance-cam-container').style.height = (320 * camRatio) + 'px';

    // 设置画板内在分辨率
    canvasElement.width = camVideoElement.videoWidth;
    canvasElement.height = camVideoElement.videoHeight;
    biliCanvas.width = bVideoElement.videoWidth;
    biliCanvas.height = bVideoElement.videoHeight;
    
    bVideoElement.style.transform = 'scaleX(-1)'; 
    bVideoElement.currentTime = 0; 
    
    isDancing = true;
    totalScore = 0;
    smoothMatchRate = 0;
    
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
    if (!isDancing) return;
    
    const btn = document.querySelector('.btn-dance-together');
    btn.innerText = '一起跳';
    btn.style.backgroundColor = '#fb7299';
    
    isDancing = false;
    document.getElementById('dance-cam-container').style.display = 'none';
    document.getElementById('video-skeleton-container').style.display = 'none'; 
    bVideoElement.style.transform = 'scaleX(1)'; 
    biliCtx.clearRect(0, 0, biliCanvas.width, biliCanvas.height);
    
    document.getElementById('final-score').innerText = totalScore;
    document.getElementById('dance-result-screen').style.display = 'block';
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

    try {
        const videoPoses = await detector.estimatePoses(bVideoElement);
        const camPoses = await detector.estimatePoses(camVideoElement);

        if (videoPoses.length > 0 && camPoses.length > 0) {
            const now = performance.now(); 
            
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

            intervalScoreSum += displayRate;
            intervalFrameCount++;

            if (now - intervalStartTime >= EVALUATION_INTERVAL_MS) {
                if (intervalFrameCount > 0) {
                    let averageRate = intervalScoreSum / intervalFrameCount;
                    
                    if (averageRate >= 85) { 
                        spawnComboText('excellent');
                        totalScore += 100; 
                    } else if (averageRate >= 70) {
                        spawnComboText('great');
                        totalScore += 50;  
                    }

                    document.getElementById('current-score').innerText = totalScore;
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

// 🔥 变态严格版判定算法 
function calculateSimilarity(videoKp, camKp) {
    let totalScore = 0;
    let totalMaxWeight = 0; 

    const segments = [
        { v1: 5, v2: 6, c1: 5, c2: 6, weight: 0 },     // 肩膀 
        { v1: 11, v2: 12, c1: 11, c2: 12, weight: 0 }, // 胯部
        { v1: 5, v2: 7, c1: 5, c2: 7, weight: 2 },   // 左大臂
        { v1: 7, v2: 9, c1: 7, c2: 9, weight: 2 },   // 左小臂
        { v1: 6, v2: 8, c1: 6, c2: 8, weight: 2 },   // 右大臂
        { v1: 8, v2: 10, c1: 8, c2: 10, weight: 2 }, // 右小臂
        { v1: 11, v2: 13, c1: 11, c2: 13, weight: 1.0 }, // 左大腿
        { v1: 13, v2: 15, c1: 13, c2: 15, weight: 0.8 }, // 左小腿
        { v1: 12, v2: 14, c1: 12, c2: 14, weight: 1.0 }, // 右大腿
        { v1: 14, v2: 16, c1: 14, c2: 16, weight: 0.8 }  // 右小腿
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
        [5,7], [7,9], [6,8], [8,10], // 手臂
        [11,13], [13,15], [12,14], [14,16], // 腿部
        [5,6], [11,12], [5,11], [6,12] // 躯干框架
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