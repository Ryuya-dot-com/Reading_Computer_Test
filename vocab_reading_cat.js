/**
 * Vocabulary Size CAT + Reading Comprehension Test
 */

// Simple CSV parser function
function parseCSV(text) {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/\r$/, ''));
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        if (values.length === headers.length) {
            const row = {};
            headers.forEach((header, index) => {
                let value = values[index].trim().replace(/\r$/, '');
                
                // Convert numeric fields for vocabulary items
                if (header === 'Level') {
                    row[header] = parseInt(value);
                } else if (header === 'Dscrimination' || header === 'Difficulty' || header === 'Guessing') {
                    row[header] = parseFloat(value);
                } else {
                    row[header] = value;
                }
            });
            data.push(row);
        }
    }
    return data;
}

// Enhanced CSV parser for reading texts (handles quoted text with commas)
function parseReadingCSV(text) {
    // Use Papa Parse for more robust CSV parsing
    return text; // Will be parsed with Papa.parse in loadData
}

// Data Collection and Analysis Class
class DataCollector {
    constructor() {
        this.sessions = [];
        this.currentSession = {
            sessionId: this.generateSessionId(),
            startTime: new Date(),
            browserInfo: this.getBrowserInfo(),
            screenInfo: this.getScreenInfo(),
            interactions: [],
            detailedResponses: [],
            mouseMovements: [],
            focusEvents: [],
            checkpoints: [], // NEW: For partial save points
            participantInfo: {
                name: '',
                identifier: '',
                englishQualifications: '',
                studyAbroadExperience: '',
                childhoodEnglishUsage: ''
            }
        };
        this.initializeEventListeners();
    }

    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    getBrowserInfo() {
        return {
            userAgent: navigator.userAgent,
            language: navigator.language,
            platform: navigator.platform,
            cookieEnabled: navigator.cookieEnabled,
            onlineStatus: navigator.onLine,
            timestamp: new Date().toISOString()
        };
    }

    getScreenInfo() {
        return {
            width: window.screen.width,
            height: window.screen.height,
            availWidth: window.screen.availWidth,
            availHeight: window.screen.availHeight,
            colorDepth: window.screen.colorDepth,
            pixelRatio: window.devicePixelRatio || 1
        };
    }

    initializeEventListeners() {
        // Mouse movement tracking (sampled)
        let lastMouseLog = 0;
        document.addEventListener('mousemove', (e) => {
            const now = Date.now();
            if (now - lastMouseLog > 100) { // Sample every 100ms
                this.currentSession.mouseMovements.push({
                    x: e.clientX,
                    y: e.clientY,
                    timestamp: now
                });
                lastMouseLog = now;
            }
        });

        // Focus/Blur events
        window.addEventListener('blur', () => {
            this.currentSession.focusEvents.push({
                type: 'blur',
                timestamp: Date.now()
            });
        });

        window.addEventListener('focus', () => {
            this.currentSession.focusEvents.push({
                type: 'focus',
                timestamp: Date.now()
            });
        });

        // Page unload warning
        window.addEventListener('beforeunload', (e) => {
            if (this.currentSession.interactions.length > 0) {
                e.preventDefault();
                e.returnValue = 'テストが進行中です。このページを離れると、データが失われる可能性があります。';
            }
        });
    }

    logInteraction(action, data) {
        this.currentSession.interactions.push({
            action: action,
            data: data,
            timestamp: Date.now(),
            relativeTime: Date.now() - this.currentSession.startTime.getTime()
        });
    }

    logDetailedResponse(responseData) {
        this.currentSession.detailedResponses.push({
            ...responseData,
            timestamp: Date.now(),
            relativeTime: Date.now() - this.currentSession.startTime.getTime()
        });
    }

    setParticipantInfo(participantInfo = {}) {
        const sanitizedInfo = {
            name: (participantInfo.name || '').trim(),
            identifier: (participantInfo.identifier || '').trim(),
            englishQualifications: (participantInfo.englishQualifications || '').trim(),
            studyAbroadExperience: (participantInfo.studyAbroadExperience || '').trim(),
            childhoodEnglishUsage: (participantInfo.childhoodEnglishUsage || '').trim()
        };

        this.currentSession.participantInfo = sanitizedInfo;
        this.logInteraction('participant_registered', { ...sanitizedInfo });
    }

    // NEW: Save checkpoint for partial data
    saveCheckpoint(checkpointName, testData) {
        try {
            const checkpoint = {
                name: checkpointName,
                timestamp: new Date().toISOString(),
                // testData is already cleaned in the calling methods
                testData: testData
            };
            
            // Only add minimal session data for the final JSON export
            this.currentSession.checkpoints.push({
                name: checkpointName,
                timestamp: checkpoint.timestamp
            });
            
            // Optionally export checkpoint data
            if (checkpointName === 'vocabulary_completed' || 
                checkpointName === 'narrative_completed' || 
                checkpointName === 'expository_completed') {
                this.exportCheckpointData(checkpoint);
            }
        } catch (error) {
            console.error('Error saving checkpoint:', error);
            console.error('Checkpoint name:', checkpointName);
            console.error('Test data:', testData);
            // Continue without throwing - checkpoint is optional
            this.currentSession.checkpoints.push({
                name: checkpointName,
                timestamp: new Date().toISOString(),
                error: error.message
            });
        }
    }

    exportCheckpointData(checkpoint) {
        try {
            // Create a safe copy for JSON serialization
            const safeCheckpoint = {
                name: checkpoint.name,
                timestamp: checkpoint.timestamp,
                testData: checkpoint.testData // This is already cleaned in saveCheckpoint
            };
            
            // Add minimal session data
            if (checkpoint.sessionData) {
                safeCheckpoint.sessionData = {
                    sessionId: checkpoint.sessionData.sessionId,
                    startTime: checkpoint.sessionData.startTime,
                    totalDuration: checkpoint.sessionData.totalDuration,
                    interactionCount: checkpoint.sessionData.interactionCount,
                    responseCount: checkpoint.sessionData.responseCount
                };
            }
            
            const jsonString = JSON.stringify(safeCheckpoint, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `checkpoint_${checkpoint.name}_${this.currentSession.sessionId}.json`;
            // Silent save - don't click automatically, just prepare the link
            setTimeout(() => URL.revokeObjectURL(url), 100);
            
            console.log(`Checkpoint ${checkpoint.name} prepared for export`);
        } catch (error) {
            console.error('Error exporting checkpoint data:', error);
            console.error('Checkpoint data:', checkpoint);
            // Continue without throwing - checkpoint is optional
        }
    }

    getSessionSummary() {
        return {
            sessionId: this.currentSession.sessionId,
            startTime: this.currentSession.startTime.toISOString(),
            browserInfo: this.currentSession.browserInfo,
            screenInfo: this.currentSession.screenInfo,
            interactions: this.currentSession.interactions,
            detailedResponses: this.currentSession.detailedResponses,
            mouseMovements: this.currentSession.mouseMovements,
            focusEvents: this.currentSession.focusEvents,
            checkpoints: this.currentSession.checkpoints,
            endTime: new Date().toISOString(),
            totalDuration: Date.now() - this.currentSession.startTime.getTime(),
            interactionCount: this.currentSession.interactions.length,
            responseCount: this.currentSession.detailedResponses.length,
            participantInfo: this.currentSession.participantInfo
        };
    }
}

// Enhanced Main Test Class
class VocabReadingCATTest {
    constructor() {
        this.vocabularyItems = [];
        this.readingTexts = [];
        this.dataCollector = new DataCollector();
        this.catConfig = {
            abilityGridMin: -6,
            abilityGridMax: 6,
            abilityGridStep: 0.01,
            priorMean: 0,
            priorSD: 1,
            minItems: 25,
            targetItems: 30,
            maxItems: 35,
            targetSE: 0.35,
            highLevelThreshold: 7,
            requiredHighLevelItems: 2
        };
        this.participantInfo = {
            name: '',
            identifier: '',
            englishQualifications: '',
            studyAbroadExperience: '',
            childhoodEnglishUsage: ''
        };
        this.preTestStep = 'participant';
        this.stylesInjected = false;
        this.injectStyles();
        this.loadData();
    }

    async loadDataWithRetry(url, maxRetries = 3) {
        let lastError;
        for (let i = 0; i < maxRetries; i++) {
            try {
                const response = await fetch(url, { cache: 'no-cache' });
                if (!response.ok) {
                    throw new Error(`Failed to load data: ${response.status}`);
                }
                return await response.text();
            } catch (error) {
                lastError = error;
                console.warn(`Attempt ${i + 1} failed for ${url}:`, error);
                if (i < maxRetries - 1) {
                    // Wait before retry (exponential backoff)
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
                }
            }
        }
        throw lastError;
    }

    async loadData() {
        try {
            // GitHub Pages や他の環境でも動作するようにベースパスを取得
            const path = window.location.pathname;
            let basePath = path;

            if (!path.endsWith('/')) {
                basePath = path.replace(/\/[^\/]*$/, '');
            }

            if (basePath.endsWith('/')) {
                basePath = basePath.slice(0, -1);
            }

            if (basePath === '/') {
                basePath = '';
            }
            
            // CSVファイルのパスを構築
            const vocabPath = basePath ? `${basePath}/jacet_parameters.csv` : 'jacet_parameters.csv';
            const readingPath = basePath ? `${basePath}/reading_texts.csv` : 'reading_texts.csv';
            
            console.log('Loading CSV files from:', { vocabPath, readingPath });
            
            // Load vocabulary data with retry
            const vocabText = await this.loadDataWithRetry(vocabPath);
            this.vocabularyItems = parseCSV(vocabText);
            this.updateCatParametersFromData();

            // Load reading texts data with retry
            const readingText = await this.loadDataWithRetry(readingPath);
            
            // Use Papa Parse for robust parsing of reading texts
            if (typeof Papa !== 'undefined') {
                const parsed = Papa.parse(readingText, {
                    header: true,
                    skipEmptyLines: true,
                    dynamicTyping: true,
                    quoteChar: '"',
                    escapeChar: '"'
                });
                this.readingTexts = parsed.data.map(row => ({
                    ...row,
                    // levelを確実に数値に変換
                    level: parseInt(row.level, 10),
                    text: row.text ? this.cleanText(row.text) : '',
                    question1: row.question1 ? this.cleanText(row.question1) : '',
                    question2: row.question2 ? this.cleanText(row.question2) : ''
                }));
            } else {
                // Fallback if Papa Parse not available
                this.readingTexts = parseCSV(readingText);
            }
            
            console.log(`Loaded ${this.vocabularyItems.length} vocabulary items`);
            console.log(`Loaded ${this.readingTexts.length} reading texts`);
            
            this.dataCollector.logInteraction('data_loaded', {
                vocabCount: this.vocabularyItems.length,
                readingCount: this.readingTexts.length
            });
            
            this.reset();
            this.render();
        } catch (error) {
            console.error('Failed to load data:', error);
            this.dataCollector.logInteraction('data_load_error', {
                error: error.message
            });
            this.showError(error);
        }
    }

    showError(error = null) {
        const app = document.getElementById('app');
        app.innerHTML = `
            <div class="error fade-in">
                <h3>データの読み込みに失敗しました</h3>
                ${error ? `<p class="text-danger">エラー: ${error.message}</p>` : ''}
                <p>以下の点を確認してください：</p>
                <ul class="text-start" style="max-width: 600px; margin: 0 auto;">
                    <li>jacet_parameters.csv と reading_texts.csv ファイルが同じディレクトリにあること</li>
                    <li>ローカルサーバーを使用していること（file:// プロトコルでは動作しません）</li>
                    <li>サーバー例: <code>python -m http.server 8000</code> または <code>npx serve .</code></li>
                    <li>ネットワーク接続が安定していること</li>
                </ul>
                <button id="retryBtn" class="btn btn-primary mt-3">再試行</button>
            </div>
        `;
        
        document.getElementById('retryBtn').addEventListener('click', () => {
            location.reload();
        });
    }

    reset() {
        // CAT Phase variables
        this.started = false;
        this.catDone = false;
        this.administeredItems = [];
        this.responses = [];
        this.responseDetails = []; // Detailed response tracking
        this.theta = this.catConfig.priorMean;
        this.se = this.catConfig.priorSD;
        this.nextItem = this.selectInitialItem();
        this.participantInfo = {
            name: '',
            identifier: '',
            englishQualifications: '',
            studyAbroadExperience: '',
            childhoodEnglishUsage: ''
        };
        this.preTestStep = 'participant';
        
        // Reading Phase variables
        this.phase = 'cat'; // 'cat', 'reading_narrative', 'reading_expository', 'final'
        this.readingLevel = 2;
        this.readingStep = 'text'; // 'text', 'question1', 'question2'
        this.currentReadingText = null;
        this.readingAnswers = {
            narrative: { question1: '', question2: '' },
            expository: { question1: '', question2: '' }
        };
        this.readingTimes = {
            narrative: { 
                textStart: null, 
                question1Start: null, 
                question1End: null,
                question2Start: null, 
                question2End: null 
            },
            expository: { 
                textStart: null, 
                question1Start: null, 
                question1End: null,
                question2Start: null, 
                question2End: null 
            }
        };
        
        // Enhanced tracking
        this.detailedReadingData = {
            narrative: { textInteractions: [], questionInteractions: [] },
            expository: { textInteractions: [], questionInteractions: [] }
        };
        
        this.allCompleted = false;
    }

    // Clean text from CSV artifacts
    cleanText(text) {
        if (typeof text !== 'string') {
            return '';
        }

        let cleaned = text.replace(/\r\n?/g, '\n');

        // Support legacy rows like "Paragraph\n""Next paragraph\n" by unwrapping
        const legacyPattern = /"([\s\S]*?)\\n"(?:\n)?/g;
        cleaned = cleaned.replace(legacyPattern, (_, segment) => {
            const unescaped = segment.replace(/""/g, '"');
            return `${unescaped}\n\n`;
        });

        // Convert any remaining escaped newlines to actual ones
        if (cleaned.includes('\\n')) {
            cleaned = cleaned.replace(/\\n/g, '\n');
        }

        return cleaned.trim();
    }

    // HTML escape function
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatParticipantLabel() {
        if (!this.participantInfo || !this.participantInfo.name) return '';
        const name = this.escapeHtml(this.participantInfo.name);
        if (this.participantInfo.identifier) {
            return `${name}（${this.escapeHtml(this.participantInfo.identifier)}）`;
        }
        return name;
    }

    // Determine reading level from vocabulary size
    getReadingLevel(vocabSize) {
        if (vocabSize < 2000) return 2;
        if (vocabSize < 3000) return 2;
        if (vocabSize < 4000) return 3;
        if (vocabSize < 5000) return 4;
        if (vocabSize < 6000) return 5;
        if (vocabSize < 7000) return 6;
        return 7;
    }

    // Get reading text by level and type
    getReadingText(level, type) {
        const text = this.readingTexts.find(text => 
            text.level === level && text.type === type
        );
        
        if (!text) {
            console.error(`Reading text not found for level ${level} and type ${type}`);
            console.log('Available texts:', this.readingTexts.map(t => ({level: t.level, type: t.type})));
            // フォールバック：最も近いレベルのテキストを返す
            const fallback = this.readingTexts.find(text => text.type === type);
            if (fallback) {
                console.warn(`Using fallback text at level ${fallback.level}`);
                return fallback;
            }
        }
        
        return text;
    }

    selectInitialItem() {
        if (!this.vocabularyItems.length) return 0;

        const targetAbility = this.catConfig.priorMean;
        let bestIndex = 0;
        let bestScore = -Infinity;

        for (let i = 0; i < this.vocabularyItems.length; i++) {
            const item = this.vocabularyItems[i];
            const info = this.itemInfo3PL(targetAbility, item.Dscrimination, item.Difficulty, item.Guessing);
            const proximity = -Math.abs(item.Difficulty - targetAbility);
            const score = info * 0.7 + proximity * 0.3 + Math.random() * 0.01;
            if (score > bestScore) {
                bestScore = score;
                bestIndex = i;
            }
        }

        return bestIndex;
    }

    updateCatParametersFromData() {
        if (!this.vocabularyItems.length) return;

        const stats = this.computeItemStatistics(this.vocabularyItems);
        const weightedMean = stats.weightedDifficultyMean;
        const weightedStd = Math.max(stats.weightedDifficultyStd, 0.8);

        this.catConfig.priorMean = weightedMean;
        this.catConfig.priorSD = weightedStd;

        const gridPadding = 4 * weightedStd;
        this.catConfig.abilityGridMin = Math.min(-6, weightedMean - gridPadding);
        this.catConfig.abilityGridMax = Math.max(6, weightedMean + gridPadding);

        const targetItems = this.catConfig.targetItems;
        const expectedInfo = this.estimateExpectedInformation(weightedMean, targetItems);
        const calibratedSE = Math.sqrt(1 / Math.max(expectedInfo, 1e-6));
        this.catConfig.targetSE = Math.min(Math.max(calibratedSE, 0.25), 0.4);

        this.catConfig.minItems = Math.max(24, Math.floor(targetItems * 0.8));
        this.catConfig.maxItems = Math.max(targetItems + 5, this.catConfig.minItems + 5);

        this.dataCollector.logInteraction('cat_parameters_calibrated', {
            priorMean: this.catConfig.priorMean,
            priorSD: this.catConfig.priorSD,
            gridMin: this.catConfig.abilityGridMin,
            gridMax: this.catConfig.abilityGridMax,
            targetSE: this.catConfig.targetSE,
            minItems: this.catConfig.minItems,
            maxItems: this.catConfig.maxItems
        });
    }

    computeItemStatistics(items) {
        let weightSum = 0;
        let weightedMean = 0;
        let weightedSqSum = 0;

        for (const item of items) {
            const weight = Math.max(item.Dscrimination || 0, 0.1);
            const difficulty = item.Difficulty || 0;
            weightSum += weight;
            weightedMean += weight * difficulty;
        }

        weightedMean = weightSum > 0 ? weightedMean / weightSum : 0;

        for (const item of items) {
            const weight = Math.max(item.Dscrimination || 0, 0.1);
            const difficulty = item.Difficulty || 0;
            const diff = difficulty - weightedMean;
            weightedSqSum += weight * diff * diff;
        }

        const weightedVariance = weightSum > 0 ? weightedSqSum / weightSum : 1;

        return {
            weightedDifficultyMean: weightedMean,
            weightedDifficultyStd: Math.sqrt(Math.max(weightedVariance, 1e-6))
        };
    }

    estimateExpectedInformation(theta, sampleSize) {
        if (!this.vocabularyItems.length) return 1;

        const infos = this.vocabularyItems.map(item => 
            this.itemInfo3PL(theta, item.Dscrimination, item.Difficulty, item.Guessing)
        ).filter(info => Number.isFinite(info) && info > 0);

        if (!infos.length) return 1;

        infos.sort((a, b) => b - a);
        const usable = infos.slice(0, Math.max(sampleSize, 1));
        const averageInfo = usable.reduce((sum, value) => sum + value, 0) / usable.length;

        // Assume we can achieve about 85% of the ideal information across the test.
        return averageInfo * sampleSize * 0.85;
    }

    injectStyles() {
        if (typeof document === 'undefined') return;
        if (this.stylesInjected || document.getElementById('cat-enhanced-styles')) {
            this.stylesInjected = true;
            return;
        }

        const style = document.createElement('style');
        style.id = 'cat-enhanced-styles';
        style.textContent = `
:root {
    --cat-accent: #0d6efd;
}

.fade-in {
    animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
}

.info-summary-card {
    background: #f8f9fb;
    border-radius: 12px;
    padding: 1.5rem;
    border: 1px solid rgba(13, 110, 253, 0.08);
    box-shadow: 0 6px 18px rgba(13, 110, 253, 0.08);
}

.info-summary-card h5 {
    font-weight: 600;
    margin-bottom: 1rem;
}

.cat-instruction-list {
    list-style: none;
    padding-left: 0;
    margin-bottom: 0;
}

.cat-instruction-list li {
    position: relative;
    padding-left: 1.6rem;
    margin-bottom: 0.75rem;
    font-size: 0.95rem;
    color: #495057;
}

.cat-instruction-list li::before {
    content: '\\f00c';
    font-family: "Font Awesome 5 Free";
    font-weight: 900;
    position: absolute;
    left: 0;
    top: 0.05rem;
    color: var(--cat-accent);
}

.start-card {
    border-radius: 14px;
}

.start-card .btn {
    min-width: 220px;
}

.vocab-question-card button.option-btn {
    padding: 0.9rem 1rem;
    font-size: 1.05rem;
    text-align: left;
    border-radius: 0.75rem;
    transition: transform 0.15s ease;
}

.vocab-question-card button.option-btn:hover {
    transform: translateX(3px);
}

.vocab-progress-bar {
    height: 0.85rem;
    border-radius: 999px;
}

.reading-layout .reading-text-pane {
    background: #f8f9fc;
    border-radius: 14px;
    border: 1px solid rgba(13, 110, 253, 0.08);
    padding: 1.75rem;
    box-shadow: 0 6px 18px rgba(15, 36, 84, 0.04);
    line-height: 1.85;
    font-size: 1.05rem;
    min-height: 60vh;
    max-height: 72vh;
    overflow-y: scroll;
    position: relative;
}

.reading-layout .reading-text-pane h6 {
    font-weight: 600;
}

.reading-layout .reading-text-pane p {
    margin-bottom: 1.15rem;
}

.reading-layout .reading-text-pane::-webkit-scrollbar {
    width: 10px;
}

.reading-layout .reading-text-pane::-webkit-scrollbar-thumb {
    background: rgba(13, 110, 253, 0.35);
    border-radius: 999px;
}

.reading-layout .reading-text-pane::-webkit-scrollbar-track {
    background: transparent;
}

.reading-scroll-indicator {
    position: relative;
    width: 100%;
    height: 6px;
    background: rgba(13, 110, 253, 0.08);
    border-radius: 999px;
    overflow: hidden;
}

.reading-scroll-progress {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    width: 0%;
    background: linear-gradient(135deg, rgba(13,110,253,0.9) 0%, rgba(32,201,151,0.9) 100%);
    transition: width 0.2s ease-out;
}

.reading-scroll-hint {
    display: block;
    margin-top: 0.35rem;
}

.reading-scroll-hint .status-icon {
    color: var(--cat-accent);
    transition: transform 0.2s ease;
}

.reading-scroll-hint.complete .status-icon {
    transform: scale(1.1);
    color: #20c997;
}

.reading-layout .reading-question-pane {
    border-radius: 14px;
    box-shadow: 0 8px 24px rgba(33, 37, 41, 0.08);
}

.reading-layout .reading-question-pane textarea {
    min-height: 240px;
    font-size: 1.05rem;
}

.reading-layout .sticky-lg-top {
    top: 80px;
}

@media (max-width: 991.98px) {
    .reading-layout .reading-text-pane {
        max-height: none;
        margin-bottom: 1.5rem;
    }

    .reading-layout .reading-question-pane textarea {
        min-height: 200px;
    }
}
`;
        document.head.appendChild(style);
        this.stylesInjected = true;
    }

    // 3PL probability function
    prob3PL(theta, a, b, c) {
        return c + (1 - c) / (1 + Math.exp(-a * (theta - b)));
    }

    // Item information function
    itemInfo3PL(theta, a, b, c) {
        const p = this.prob3PL(theta, a, b, c);
        const q = 1 - p;
        if (p <= c || p >= 1) return 0;
        return (a * a * q * Math.pow(p - c, 2)) / (p * Math.pow(1 - c, 2));
    }

    // EAP estimation
    estimateAbilityEAP(items, responses) {
        if (!items.length) return {theta: 0, se: Infinity};

        const {
            abilityGridMin,
            abilityGridMax,
            abilityGridStep,
            priorMean,
            priorSD
        } = this.catConfig;

        const steps = Math.max(1, Math.round((abilityGridMax - abilityGridMin) / abilityGridStep));
        const grid = [];
        for (let i = 0; i <= steps; i++) {
            grid.push(abilityGridMin + i * abilityGridStep);
        }

        const prior = grid.map(x => this.normalDensity(x, priorMean, priorSD));
        const logLikelihood = new Array(grid.length).fill(0);
        const PROB_FLOOR = 1e-6;

        for (let i = 0; i < items.length; i++) {
            const item = this.vocabularyItems[items[i]];
            for (let j = 0; j < grid.length; j++) {
                const p = this.prob3PL(grid[j], item.Dscrimination, item.Difficulty, item.Guessing);
                const boundedP = Math.min(Math.max(p, PROB_FLOOR), 1 - PROB_FLOOR);
                logLikelihood[j] += responses[i] ? Math.log(boundedP) : Math.log(1 - boundedP);
            }
        }

        const logPosterior = new Array(grid.length);
        let maxLogPosterior = -Infinity;
        for (let i = 0; i < grid.length; i++) {
            const value = Math.log(prior[i]) + logLikelihood[i];
            logPosterior[i] = value;
            if (value > maxLogPosterior) {
                maxLogPosterior = value;
            }
        }

        const posterior = new Array(grid.length);
        let sum = 0;
        for (let i = 0; i < grid.length; i++) {
            const value = Math.exp(logPosterior[i] - maxLogPosterior);
            posterior[i] = value;
            sum += value;
        }

        if (sum <= 0 || !isFinite(sum)) {
            const priorSum = prior.reduce((a, b) => a + b, 0);
            for (let i = 0; i < grid.length; i++) {
                posterior[i] = prior[i] / priorSum;
            }
        } else {
            for (let i = 0; i < grid.length; i++) {
                posterior[i] = posterior[i] / sum;
            }
        }

        let theta = 0;
        let variance = 0;
        for (let i = 0; i < grid.length; i++) {
            theta += grid[i] * posterior[i];
        }
        for (let i = 0; i < grid.length; i++) {
            variance += Math.pow(grid[i] - theta, 2) * posterior[i];
        }

        return {theta: theta, se: Math.sqrt(Math.max(variance, 0))};
    }

    normalDensity(x, mean = 0, sd = 1) {
        return (1 / (sd * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - mean) / sd, 2));
    }

    // Select next item
    selectNext(theta, administered, needHigh) {
        let pool = [];
        for (let i = 0; i < this.vocabularyItems.length; i++) {
            if (!administered.includes(i)) {
                pool.push(i);
            }
        }

        if (needHigh) {
            const highLevelThreshold = this.catConfig.highLevelThreshold;
            const highLevel = pool.filter(i => this.vocabularyItems[i].Level >= highLevelThreshold);
            if (highLevel.length > 0) {
                pool = highLevel;
            }
        }

        if (pool.length === 0) return -1;

        let maxInfo = -1;
        let bestItem = -1;

        for (const itemIdx of pool) {
            const item = this.vocabularyItems[itemIdx];
            const info = this.itemInfo3PL(theta, item.Dscrimination, item.Difficulty, item.Guessing);
            if (info > maxInfo) {
                maxInfo = info;
                bestItem = itemIdx;
            }
        }

        return bestItem;
    }

    // Convert theta to vocabulary size
    vocabFromTheta(theta) {
        const difficulties = [-2.206, -1.512, -0.701, -0.075, 0.748, 1.152, 1.504, 2.089];
        return difficulties.reduce((sum, diff) => {
            return sum + 1000 / (1 + Math.exp(-(theta - diff)));
        }, 0);
    }

    handleVocabResponse(selectedOption) {
        const startTime = this.lastQuestionStartTime || Date.now();
        const responseTime = Date.now() - startTime;
        const item = this.vocabularyItems[this.nextItem];
        const correct = selectedOption === item.CorrectAnswer ? 1 : 0;

        // Store detailed response data
        this.responseDetails.push({
            itemIndex: this.nextItem,
            item: item.Item,
            level: item.Level,
            partOfSpeech: item.PartOfSpeech,
            correctAnswer: item.CorrectAnswer,
            selectedAnswer: selectedOption,
            correct: correct,
            responseTime: responseTime,
            itemParameters: {
                discrimination: item.Dscrimination,
                difficulty: item.Difficulty,
                guessing: item.Guessing
            },
            abilityBeforeResponse: this.theta,
            seBeforeResponse: this.se,
            timestamp: Date.now()
        });

        this.administeredItems.push(this.nextItem);
        this.responses.push(correct);

        // Update ability estimate
        const estimate = this.estimateAbilityEAP(this.administeredItems, this.responses);
        this.theta = estimate.theta;
        this.se = estimate.se;

        // Log interaction
        this.dataCollector.logInteraction('vocab_response', {
            item: item.Item,
            correct: correct,
            responseTime: responseTime,
            newTheta: this.theta,
            newSE: this.se
        });

        // Check termination conditions with configurable thresholds
        const {
            minItems,
            targetItems,
            maxItems,
            targetSE,
            highLevelThreshold,
            requiredHighLevelItems
        } = this.catConfig;

        const itemCount = this.administeredItems.length;
        const highLevelCount = this.administeredItems.filter(i => this.vocabularyItems[i].Level >= highLevelThreshold).length;
        const needHigh = highLevelCount < requiredHighLevelItems;

        let shouldContinue = false;
        if (itemCount < minItems) {
            shouldContinue = true;
        } else if (itemCount < targetItems) {
            shouldContinue = true;
        } else if (this.se > targetSE) {
            shouldContinue = true;
        } else if (needHigh) {
            shouldContinue = true;
        }

        if (shouldContinue && itemCount < maxItems) {
            this.nextItem = this.selectNext(this.theta, this.administeredItems, needHigh);
            if (this.nextItem === -1) {
                this.finishCAT();
            }
        } else {
            this.finishCAT();
        }

        this.render();
    }

    finishCAT() {
        this.catDone = true;
        const vocabSize = this.vocabFromTheta(this.theta);
        this.readingLevel = this.getReadingLevel(vocabSize);
        this.phase = 'reading_narrative';
        this.readingStep = 'text';
        this.currentReadingText = this.getReadingText(this.readingLevel, 'narrative');
        // Record reading start time
        this.readingTimes.narrative.textStart = new Date();
        
        // Log CAT completion
        this.dataCollector.logInteraction('cat_completed', {
            finalTheta: this.theta,
            finalSE: this.se,
            vocabSize: vocabSize,
            readingLevel: this.readingLevel,
            totalItems: this.administeredItems.length,
            correctItems: this.responses.filter(r => r === 1).length,
            participantName: this.participantInfo.name,
            participantIdentifier: this.participantInfo.identifier
        });

        // Save checkpoint for vocabulary completion
        this.dataCollector.saveCheckpoint('vocabulary_completed', {
            theta: this.theta,
            se: this.se,
            vocabSize: vocabSize,
            participant: { ...this.participantInfo },
            // Only save essential data to avoid circular references
            responses: this.responseDetails.map(detail => ({
                itemIndex: detail.itemIndex,
                item: detail.item,
                level: detail.level,
                partOfSpeech: detail.partOfSpeech,
                correctAnswer: detail.correctAnswer,
                selectedAnswer: detail.selectedAnswer,
                correct: detail.correct,
                responseTime: detail.responseTime,
                abilityBeforeResponse: detail.abilityBeforeResponse,
                seBeforeResponse: detail.seBeforeResponse,
                timestamp: detail.timestamp
            })),
            administeredItems: [...this.administeredItems], // Create a copy
            totalItems: this.administeredItems.length,
            correctItems: this.responses.filter(r => r === 1).length
        });
    }

    handleReadingAnswer(answer) {
        const currentType = this.phase.replace('reading_', '');
        const currentTime = new Date();
        
        // Detailed response logging
        const responseData = {
            phase: this.phase,
            type: currentType,
            level: this.readingLevel,
            step: this.readingStep,
            question: this.readingStep === 'question1' ? 
                this.currentReadingText.question1 : 
                this.currentReadingText.question2,
            answer: answer,
            answerLength: answer.split(' ').length,
            answerSentences: answer.split(/[.!?]+/).filter(s => s.trim()).length,
            timeToAnswer: currentTime - (this.readingStep === 'question1' ? 
                this.readingTimes[currentType].question1Start : 
                this.readingTimes[currentType].question2Start),
            textContent: this.currentReadingText.text,
            timestamp: currentTime.toISOString()
        };
        
        this.dataCollector.logDetailedResponse(responseData);
        
        if (this.readingStep === 'question1') {
            this.readingAnswers[currentType].question1 = answer;
            this.readingTimes[currentType].question1End = currentTime;
            this.readingStep = 'question2';
            this.readingTimes[currentType].question2Start = currentTime;
        } else if (this.readingStep === 'question2') {
            this.readingAnswers[currentType].question2 = answer;
            this.readingTimes[currentType].question2End = currentTime;
            
            if (this.phase === 'reading_narrative') {
                // Save checkpoint for narrative completion
                this.dataCollector.saveCheckpoint('narrative_completed', {
                    readingLevel: this.readingLevel,
                    participant: { ...this.participantInfo },
                    narrativeAnswers: {
                        question1: this.readingAnswers.narrative.question1,
                        question2: this.readingAnswers.narrative.question2
                    },
                    narrativeTimes: {
                        textStart: this.readingTimes.narrative.textStart ? this.readingTimes.narrative.textStart.toISOString() : null,
                        question1Start: this.readingTimes.narrative.question1Start ? this.readingTimes.narrative.question1Start.toISOString() : null,
                        question1End: this.readingTimes.narrative.question1End ? this.readingTimes.narrative.question1End.toISOString() : null,
                        question2Start: this.readingTimes.narrative.question2Start ? this.readingTimes.narrative.question2Start.toISOString() : null,
                        question2End: this.readingTimes.narrative.question2End ? this.readingTimes.narrative.question2End.toISOString() : null
                    }
                });
                
                // Move to expository
                this.phase = 'reading_expository';
                this.readingStep = 'text';
                this.currentReadingText = this.getReadingText(this.readingLevel, 'expository');
                this.readingTimes.expository.textStart = currentTime;
            } else {
                // Save checkpoint for expository completion
                this.dataCollector.saveCheckpoint('expository_completed', {
                    readingLevel: this.readingLevel,
                    participant: { ...this.participantInfo },
                    allAnswers: {
                        narrative: {
                            question1: this.readingAnswers.narrative.question1,
                            question2: this.readingAnswers.narrative.question2
                        },
                        expository: {
                            question1: this.readingAnswers.expository.question1,
                            question2: this.readingAnswers.expository.question2
                        }
                    },
                    allTimes: {
                        narrative: {
                            textStart: this.readingTimes.narrative.textStart ? this.readingTimes.narrative.textStart.toISOString() : null,
                            question1Start: this.readingTimes.narrative.question1Start ? this.readingTimes.narrative.question1Start.toISOString() : null,
                            question1End: this.readingTimes.narrative.question1End ? this.readingTimes.narrative.question1End.toISOString() : null,
                            question2Start: this.readingTimes.narrative.question2Start ? this.readingTimes.narrative.question2Start.toISOString() : null,
                            question2End: this.readingTimes.narrative.question2End ? this.readingTimes.narrative.question2End.toISOString() : null
                        },
                        expository: {
                            textStart: this.readingTimes.expository.textStart ? this.readingTimes.expository.textStart.toISOString() : null,
                            question1Start: this.readingTimes.expository.question1Start ? this.readingTimes.expository.question1Start.toISOString() : null,
                            question1End: this.readingTimes.expository.question1End ? this.readingTimes.expository.question1End.toISOString() : null,
                            question2Start: this.readingTimes.expository.question2Start ? this.readingTimes.expository.question2Start.toISOString() : null,
                            question2End: this.readingTimes.expository.question2End ? this.readingTimes.expository.question2End.toISOString() : null
                        }
                    }
                });
                
                // All completed
                this.phase = 'final';
                this.allCompleted = true;
            }
        }
        
        this.render();
    }

    // Enhanced export functions
    exportToExcel() {
        try {
            // Check if XLSX library is loaded
            if (typeof XLSX === 'undefined') {
                alert('Excelライブラリが読み込まれていません。ページを再読み込みしてください。');
                console.error('XLSX library not loaded');
                return;
            }

            // Vocabulary responses with enhanced data
            const vocabResponses = this.responseDetails.map((detail, i) => ({
                item_id: detail.itemIndex,
                word: detail.item,
                level: detail.level,
                part_of_speech: detail.partOfSpeech,
                correct_answer: detail.correctAnswer,
                selected_answer: detail.selectedAnswer,
                response: detail.correct,
                correct: detail.correct === 1 ? "正解" : "不正解",
                response_time_ms: detail.responseTime,
                discrimination: detail.itemParameters.discrimination,
                difficulty: detail.itemParameters.difficulty,
                guessing: detail.itemParameters.guessing,
                ability_before: detail.abilityBeforeResponse,
                se_before: detail.seBeforeResponse,
                item_order: i + 1
            }));

            // Reading responses with timing data (in milliseconds)
            const readingResponses = [
                {
                    type: 'narrative',
                    level: this.readingLevel,
                    question1: this.readingAnswers.narrative.question1,
                    question1_length: this.readingAnswers.narrative.question1.split(' ').length,
                    question2: this.readingAnswers.narrative.question2,
                    question2_length: this.readingAnswers.narrative.question2.split(' ').length,
                    text_read_time_ms: this.readingTimes.narrative.question1Start && this.readingTimes.narrative.textStart ? 
                        (this.readingTimes.narrative.question1Start - this.readingTimes.narrative.textStart) : 0,
                    question1_time_ms: this.readingTimes.narrative.question1End && this.readingTimes.narrative.question1Start ?
                        (this.readingTimes.narrative.question1End - this.readingTimes.narrative.question1Start) : 0,
                    question2_time_ms: this.readingTimes.narrative.question2End && this.readingTimes.narrative.question2Start ?
                        (this.readingTimes.narrative.question2End - this.readingTimes.narrative.question2Start) : 0,
                    total_time_ms: this.readingTimes.narrative.question2End && this.readingTimes.narrative.textStart ?
                        (this.readingTimes.narrative.question2End - this.readingTimes.narrative.textStart) : 0
                },
                {
                    type: 'expository', 
                    level: this.readingLevel,
                    question1: this.readingAnswers.expository.question1,
                    question1_length: this.readingAnswers.expository.question1.split(' ').length,
                    question2: this.readingAnswers.expository.question2,
                    question2_length: this.readingAnswers.expository.question2.split(' ').length,
                    text_read_time_ms: this.readingTimes.expository.question1Start && this.readingTimes.expository.textStart ? 
                        (this.readingTimes.expository.question1Start - this.readingTimes.expository.textStart) : 0,
                    question1_time_ms: this.readingTimes.expository.question1End && this.readingTimes.expository.question1Start ?
                        (this.readingTimes.expository.question1End - this.readingTimes.expository.question1Start) : 0,
                    question2_time_ms: this.readingTimes.expository.question2End && this.readingTimes.expository.question2Start ?
                        (this.readingTimes.expository.question2End - this.readingTimes.expository.question2Start) : 0,
                    total_time_ms: this.readingTimes.expository.question2End && this.readingTimes.expository.textStart ?
                        (this.readingTimes.expository.question2End - this.readingTimes.expository.textStart) : 0
                }
            ];

            // Summary with enhanced metrics
            const totalReadingTime = 
                (this.readingTimes.narrative.question2End && this.readingTimes.narrative.textStart ? 
                    (this.readingTimes.narrative.question2End - this.readingTimes.narrative.textStart) : 0) +
                (this.readingTimes.expository.question2End && this.readingTimes.expository.textStart ? 
                    (this.readingTimes.expository.question2End - this.readingTimes.expository.textStart) : 0);

            const summary = [{
                test_date: new Date().toLocaleString('ja-JP'),
                session_id: this.dataCollector.currentSession.sessionId,
                participant_name: this.participantInfo.name || '',
                participant_identifier: this.participantInfo.identifier || '',
                participant_english_qualifications: this.participantInfo.englishQualifications || '',
                participant_study_abroad_experience_3m_plus: this.participantInfo.studyAbroadExperience || '',
                participant_childhood_english_usage: this.participantInfo.childhoodEnglishUsage || '',
                theta: Math.round(this.theta * 100) / 100,
                standard_error: Math.round(this.se * 100) / 100,
                vocabulary_size: Math.round(this.vocabFromTheta(this.theta)),
                reading_level: this.readingLevel,
                total_vocab_items: this.administeredItems.length,
                correct_vocab_answers: this.responses.filter(r => r === 1).length,
                vocab_accuracy_percent: Math.round((this.responses.filter(r => r === 1).length / this.responses.length) * 100 * 10) / 10,
                avg_vocab_response_time_ms: Math.round(vocabResponses.reduce((sum, r) => sum + r.response_time_ms, 0) / vocabResponses.length),
                total_reading_time_ms: totalReadingTime,
                total_test_duration_ms: Date.now() - this.dataCollector.currentSession.startTime.getTime()
            }];

            const surveyDetails = [{
                session_id: this.dataCollector.currentSession.sessionId,
                participant_name: this.participantInfo.name || '',
                participant_identifier: this.participantInfo.identifier || '',
                english_qualifications: this.participantInfo.englishQualifications || '',
                study_abroad_experience_3m_plus: this.participantInfo.studyAbroadExperience || '',
                childhood_english_usage: this.participantInfo.childhoodEnglishUsage || ''
            }];

            const wb = XLSX.utils.book_new();
            const wsSummary = XLSX.utils.json_to_sheet(summary);
            const wsSurvey = XLSX.utils.json_to_sheet(surveyDetails);
            const wsVocab = XLSX.utils.json_to_sheet(vocabResponses);
            const wsReading = XLSX.utils.json_to_sheet(readingResponses);

            XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");
            XLSX.utils.book_append_sheet(wb, wsSurvey, "Participant_Survey");
            XLSX.utils.book_append_sheet(wb, wsVocab, "Vocabulary_Responses");
            XLSX.utils.book_append_sheet(wb, wsReading, "Reading_Responses");

            const date = new Date().toISOString().split('T')[0];
            XLSX.writeFile(wb, `vocab_reading_cat_result_${date}.xlsx`);
            
            console.log('Excel file exported successfully');
            
        } catch (error) {
            console.error('Error exporting Excel:', error);
            alert('Excelファイルの作成中にエラーが発生しました。コンソールを確認してください。');
        }
    }

    // Export detailed JSON for analysis
    exportSummaryCSV() {
        try {
            const escape = (value) => {
                if (value === null || value === undefined) return '';
                const str = String(value).replace(/\r?\n/g, ' ').trim();
                return /[",]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
            };

            const vocabResponses = this.responseDetails;
            const correctCount = this.responses.filter(r => r === 1).length;
            const averageResponseTime = vocabResponses.length
                ? Math.round(vocabResponses.reduce((sum, r) => sum + r.responseTime, 0) / vocabResponses.length)
                : 0;

            const totalReadingTime =
                (this.readingTimes.narrative.question2End && this.readingTimes.narrative.textStart ?
                    (this.readingTimes.narrative.question2End - this.readingTimes.narrative.textStart) : 0) +
                (this.readingTimes.expository.question2End && this.readingTimes.expository.textStart ?
                    (this.readingTimes.expository.question2End - this.readingTimes.expository.textStart) : 0);

            const summaryData = {
                'テスト日時': new Date().toLocaleString('ja-JP'),
                'セッションID': this.dataCollector.currentSession.sessionId,
                '受験者名': this.participantInfo.name || '',
                '受験番号': this.participantInfo.identifier || '',
                '英語資格・スコア': this.participantInfo.englishQualifications || '',
                '3ヶ月以上の留学・海外滞在経験': this.participantInfo.studyAbroadExperience || '',
                '幼少期の英語使用状況': this.participantInfo.childhoodEnglishUsage || '',
                '推定θ': Math.round(this.theta * 100) / 100,
                '標準誤差': Math.round(this.se * 100) / 100,
                '推定語彙サイズ': Math.round(this.vocabFromTheta(this.theta)),
                '読解レベル': this.readingLevel,
                '出題数': this.administeredItems.length,
                '正答数': correctCount,
                '正答率': this.responses.length ? Math.round((correctCount / this.responses.length) * 1000) / 10 : 0,
                '平均回答時間ms': averageResponseTime,
                '読解合計時間ms': totalReadingTime,
                'テスト所要時間ms': Date.now() - this.dataCollector.currentSession.startTime.getTime()
            };

            const lines = [];
            lines.push('セクション,項目,値');
            Object.entries(summaryData).forEach(([key, value]) => {
                lines.push(['Summary', key, value].map(escape).join(','));
            });

            if (vocabResponses.length) {
                lines.push('');
                lines.push('Vocabulary,番号,語,選択肢,正誤,レベル,品詞,回答時間ms');
                vocabResponses.forEach((detail, index) => {
                    lines.push([
                        'Vocabulary',
                        index + 1,
                        detail.item,
                        detail.selectedAnswer,
                        detail.correct === 1 ? '正解' : '不正解',
                        detail.level,
                        detail.partOfSpeech,
                        detail.responseTime
                    ].map(escape).join(','));
                });
            }

            lines.push('');
            lines.push('Reading,種類,問い,回答文字数,回答内容,回答時間ms');
            const readingSections = [
                { type: '物語文', key: 'narrative' },
                { type: '説明文', key: 'expository' }
            ];

            readingSections.forEach(({ type, key }) => {
                ['question1', 'question2'].forEach((q) => {
                    const answer = this.readingAnswers[key][q] || '';
                    const startKey = `${q}Start`;
                    const endKey = `${q}End`;
                    const duration = this.readingTimes[key][endKey] && this.readingTimes[key][startKey]
                        ? (this.readingTimes[key][endKey] - this.readingTimes[key][startKey])
                        : 0;
                    lines.push([
                        'Reading',
                        type,
                        q,
                        answer.length,
                        answer,
                        duration
                    ].map(escape).join(','));
                });
            });

            const csvContent = lines.join('\r\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const date = new Date().toISOString().split('T')[0];
            a.download = `vocab_reading_cat_summary_${date}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error exporting CSV:', error);
            alert('CSVの出力中にエラーが発生しました。コンソールを確認してください。');
        }
    }

    exportDetailedJSON() {
        const detailedData = {
            sessionInfo: this.dataCollector.getSessionSummary(),
            testResults: {
                participant: { ...this.participantInfo },
                vocabulary: {
                    theta: this.theta,
                    se: this.se,
                    vocabSize: this.vocabFromTheta(this.theta),
                    responses: this.responseDetails,
                    itemOrder: this.administeredItems
                },
                reading: {
                    level: this.readingLevel,
                    answers: this.readingAnswers,
                    timings: this.readingTimes,
                    texts: {
                        narrative: this.getReadingText(this.readingLevel, 'narrative'),
                        expository: this.getReadingText(this.readingLevel, 'expository')
                    }
                }
            },
            analysisMetadata: {
                testVersion: '2.0-enhanced',
                exportTime: new Date().toISOString(),
                completionStatus: this.allCompleted ? 'completed' : 'incomplete',
                checkpoints: this.dataCollector.currentSession.checkpoints
            }
        };

        const blob = new Blob([JSON.stringify(detailedData, null, 2)], 
            { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cat_detailed_data_${this.dataCollector.currentSession.sessionId}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    render() {
        const app = document.getElementById('app');
        const namePrefill = this.escapeHtml(this.participantInfo.name || '');
        const identifierPrefill = this.escapeHtml(this.participantInfo.identifier || '');
        const qualificationsPrefill = this.escapeHtml(this.participantInfo.englishQualifications || '');
        const studyAbroadPrefill = this.escapeHtml(this.participantInfo.studyAbroadExperience || '');
        const childhoodPrefill = this.escapeHtml(this.participantInfo.childhoodEnglishUsage || '');
        const participantLabel = this.formatParticipantLabel();
        const formatSurveyAnswer = (text) => {
            if (!text) {
                return '<span class="text-muted">未回答</span>';
            }
            return this.escapeHtml(text).replace(/\n/g, '<br>');
        };

        if (this.phase === 'cat' && !this.started) {
            const currentPreTestStep = this.preTestStep || 'participant';

            if (currentPreTestStep === 'survey') {
                app.innerHTML = `
                    <div class="container py-5 fade-in">
                        <div class="row justify-content-center mb-4">
                            <div class="col-xl-7 col-lg-8">
                                <div class="card shadow-sm border-0">
                                    <div class="card-body p-4 text-center text-lg-start">
                                        <h4 class="mb-2">英語に関するアンケート</h4>
                                        <p class="text-muted mb-0">テスト前に英語資格や経験について教えてください。</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="row justify-content-center">
                            <div class="col-xl-6 col-lg-7">
                                <div class="card shadow-lg border-primary start-card">
                                    <div class="card-body p-4">
                                        ${participantLabel ? `<div class="alert alert-light border text-start mb-3"><strong>受験者:</strong> ${participantLabel}</div>` : ''}
                                        <div class="mb-3">
                                            <label for="englishQualifications" class="form-label">英語に関する資格・スコア</label>
                                            <textarea id="englishQualifications" class="form-control form-control-lg" rows="3" placeholder="例：英検準1級、TOEIC 850点、IELTS 6.5など">${qualificationsPrefill}</textarea>
                                            <small class="text-muted">保有している資格や直近のスコアがあれば記入してください。（空欄でも構いません）</small>
                                        </div>
                                        <div class="mb-3">
                                            <label for="studyAbroadExperience" class="form-label">3ヶ月以上の留学・海外滞在経験</label>
                                            <textarea id="studyAbroadExperience" class="form-control form-control-lg" rows="3" placeholder="例：2019年にカナダへ6か月留学">${studyAbroadPrefill}</textarea>
                                            <small class="text-muted">期間や場所、使用した言語などをご自由に記入してください。（空欄でも構いません）</small>
                                        </div>
                                        <div class="mb-4">
                                            <label for="childhoodEnglishUsage" class="form-label">幼少期の英語使用状況</label>
                                            <textarea id="childhoodEnglishUsage" class="form-control form-control-lg" rows="3" placeholder="例：幼稚園で英語を週1回学習">${childhoodPrefill}</textarea>
                                            <small class="text-muted">家庭や学校などで英語を使用していた場合は詳細をご記入ください。（空欄でも構いません）</small>
                                        </div>
                                        <div class="d-flex flex-column flex-md-row gap-3 justify-content-between">
                                            <button id="backToInfoBtn" class="btn btn-outline-secondary btn-lg">
                                                <i class="fas fa-arrow-left me-2"></i>戻る
                                            </button>
                                            <button id="startTestBtn" class="btn btn-primary btn-lg">
                                                <i class="fas fa-play me-2"></i>テストを開始
                                            </button>
                                        </div>
                                        <small class="text-muted d-block mt-3">結果はExcelファイルとしてダウンロードできます。</small>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;

                const backBtn = document.getElementById('backToInfoBtn');
                if (backBtn) {
                    backBtn.addEventListener('click', () => {
                        const qualificationsInput = document.getElementById('englishQualifications');
                        const studyAbroadInput = document.getElementById('studyAbroadExperience');
                        const childhoodInput = document.getElementById('childhoodEnglishUsage');

                        this.participantInfo = {
                            ...this.participantInfo,
                            englishQualifications: qualificationsInput ? qualificationsInput.value : this.participantInfo.englishQualifications,
                            studyAbroadExperience: studyAbroadInput ? studyAbroadInput.value : this.participantInfo.studyAbroadExperience,
                            childhoodEnglishUsage: childhoodInput ? childhoodInput.value : this.participantInfo.childhoodEnglishUsage
                        };

                        this.preTestStep = 'participant';
                        this.dataCollector.logInteraction('participant_survey_back', {
                            timestamp: Date.now()
                        });
                        this.render();
                    });
                }

                const startTestBtn = document.getElementById('startTestBtn');
                if (startTestBtn) {
                    startTestBtn.addEventListener('click', () => {
                        const qualificationsInput = document.getElementById('englishQualifications');
                        const studyAbroadInput = document.getElementById('studyAbroadExperience');
                        const childhoodInput = document.getElementById('childhoodEnglishUsage');

                        const englishQualifications = qualificationsInput ? qualificationsInput.value.trim() : '';
                        const studyAbroadExperience = studyAbroadInput ? studyAbroadInput.value.trim() : '';
                        const childhoodEnglishUsage = childhoodInput ? childhoodInput.value.trim() : '';

                        this.participantInfo = {
                            ...this.participantInfo,
                            englishQualifications,
                            studyAbroadExperience,
                            childhoodEnglishUsage
                        };

                        this.dataCollector.logInteraction('participant_survey_submitted', {
                            englishQualifications,
                            studyAbroadExperience,
                            childhoodEnglishUsage
                        });
                        this.dataCollector.setParticipantInfo(this.participantInfo);

                        this.started = true;
                        this.preTestStep = null;
                        this.dataCollector.logInteraction('test_started', {
                            timestamp: Date.now(),
                            participant: { ...this.participantInfo }
                        });
                        this.render();
                    });
                }

            } else {
                app.innerHTML = `
                    <div class="container py-5 fade-in">
                        <div class="row justify-content-center mb-4">
                            <div class="col-xl-7 col-lg-8">
                                <div class="card shadow-sm border-0">
                                    <div class="card-body p-5 text-center">
                                        <h1 class="mb-3">JACET 語彙・読解テスト</h1>
                                        <p class="text-muted mb-0">Computer Adaptive Test (CAT) で語彙力と読解力を効率的に測定します。</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="row justify-content-center g-4 mb-4">
                            <div class="col-md-6 col-lg-4">
                                <div class="info-summary-card h-100">
                                    <h5><i class="fas fa-bolt me-2 text-primary"></i>テスト概要</h5>
                                    <ul class="cat-instruction-list">
                                        <li>語彙4択問題を順番に回答（約30問）</li>
                                        <li>回答に応じて難易度が自動調整</li>
                                        <li>続けてレベル別読解問題を2題実施</li>
                                    </ul>
                                </div>
                            </div>
                            <div class="col-md-6 col-lg-4">
                                <div class="info-summary-card h-100">
                                    <h5><i class="fas fa-user-check me-2 text-success"></i>受験時のポイント</h5>
                                    <ul class="cat-instruction-list">
                                        <li>わからなくても必ず回答</li>
                                        <li>途中で戻る・修正はできません</li>
                                        <li>静かな環境で集中して取り組みましょう</li>
                                    </ul>
                                </div>
                            </div>
                            <div class="col-md-6 col-lg-4">
                                <div class="info-summary-card h-100">
                                    <h5><i class="fas fa-laptop me-2 text-info"></i>受験前の準備</h5>
                                    <ul class="cat-instruction-list">
                                        <li>最新ブラウザ・安定した通信環境</li>
                                        <li>15〜20分ほどの時間を確保</li>
                                        <li>結果はExcelファイルで取得できます</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        <div class="row justify-content-center">
                            <div class="col-xl-6 col-lg-7">
                                <div class="card shadow-lg border-primary start-card text-center">
                                    <div class="card-body p-4">
                                        <h4 class="mb-3">受験者情報を入力してください</h4>
                                        <p class="text-muted mb-3">続くステップで英語経験アンケートにご回答いただきます。</p>
                                        <div class="row g-3 mb-3 text-start">
                                            <div class="col-md-7">
                                                <label for="participantName" class="form-label">氏名 <span class="text-danger">*</span></label>
                                                <input type="text" id="participantName" class="form-control form-control-lg" placeholder="例：山田 太郎" value="${namePrefill}" required>
                                            </div>
                                            <div class="col-md-5">
                                                <label for="participantNumber" class="form-label">受験番号</label>
                                                <input type="text" id="participantNumber" class="form-control form-control-lg" placeholder="例：A1234" value="${identifierPrefill}">
                                            </div>
                                        </div>
                                        <button id="proceedSurveyBtn" class="btn btn-primary btn-lg">
                                            <i class="fas fa-arrow-right me-2"></i>アンケートへ進む
                                        </button>
                                        <small class="text-muted d-block mt-3">アンケート完了後にテストが開始され、結果はExcelにまとめられます。</small>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;

                const proceedBtn = document.getElementById('proceedSurveyBtn');
                if (proceedBtn) {
                    proceedBtn.addEventListener('click', () => {
                        const nameInput = document.getElementById('participantName');
                        const identifierInput = document.getElementById('participantNumber');
                        const participantName = nameInput ? nameInput.value.trim() : '';
                        if (!participantName) {
                            alert('氏名を入力してください。');
                            if (nameInput) nameInput.focus();
                            return;
                        }
                        const participantIdentifier = identifierInput ? identifierInput.value.trim() : '';
                        this.participantInfo = {
                            ...this.participantInfo,
                            name: participantName,
                            identifier: participantIdentifier
                        };
                        this.preTestStep = 'survey';
                        this.dataCollector.logInteraction('participant_info_collected', {
                            name: participantName,
                            identifier: participantIdentifier
                        });
                        this.render();
                    });
                }
            }

        } else if (this.phase === 'cat' && !this.catDone) {
            // Vocabulary test question page
            const item = this.vocabularyItems[this.nextItem];
            const options = [item.CorrectAnswer, item.Distractor_1, item.Distractor_2, item.Distractor_3]
                .sort(() => Math.random() - 0.5); // Shuffle options
            const progressTarget = this.catConfig.targetItems;
            const denominator = progressTarget > 0 ? progressTarget : 1;
            const progressPct = Math.min(100, Math.round(100 * Math.min(this.administeredItems.length, denominator) / denominator));
            const nextQuestionNumber = this.administeredItems.length + 1;
            const totalLabel = nextQuestionNumber > progressTarget ? `${progressTarget}+` : progressTarget;
            const remainingApprox = Math.max(progressTarget - this.administeredItems.length, 0);
            
            // Record question start time
            this.lastQuestionStartTime = Date.now();

            app.innerHTML = `
                <div class="container py-4 fade-in">
                    <div class="row justify-content-center">
                        <div class="col-xl-8 col-lg-9">
                            ${participantLabel ? `<div class="text-muted small mb-2">受験者: ${participantLabel}</div>` : ''}
                            <div class="mb-3">
                                <div class="progress vocab-progress-bar">
                                    <div class="progress-bar bg-primary" role="progressbar" style="width: ${progressPct}%"></div>
                                </div>
                                <div class="d-flex justify-content-between align-items-center text-muted small mt-2">
                                    <span>語彙問題 ${nextQuestionNumber} / ${totalLabel}</span>
                                    <span>残り目安 ${remainingApprox} 問</span>
                                </div>
                            </div>

                            <div class="card p-4 shadow-sm vocab-question-card">
                                <div class="d-flex justify-content-between align-items-center mb-3">
                                    <span class="badge bg-secondary">Level ${item.Level}</span>
                                    <span class="badge bg-light text-dark">${item.PartOfSpeech}</span>
                                </div>
                                <h2 class="text-center mb-3">${item.Item}</h2>
                                <p class="text-center text-muted mb-4">最も意味が近い英単語を選んでください</p>
                                <div class="d-grid gap-3">
                                    ${options.map(option => 
                                        `<button class='btn btn-outline-primary option-btn' data-option='${option}'>${option}</button>`
                                    ).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Add event listeners to option buttons
            document.querySelectorAll('.option-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    this.handleVocabResponse(e.target.getAttribute('data-option'));
                });
            });

        } else if (this.phase.startsWith('reading_')) {
            this.renderReadingPhase();

        } else if (this.phase === 'final') {
            // Final results page
            const vocabSize = Math.round(this.vocabFromTheta(this.theta));
            const accuracy = Math.round((this.responses.filter(r => r === 1).length / this.responses.length) * 100 * 10) / 10;
            const englishQualificationsDisplay = formatSurveyAnswer(this.participantInfo.englishQualifications);
            const studyAbroadDisplay = formatSurveyAnswer(this.participantInfo.studyAbroadExperience);
            const childhoodDisplay = formatSurveyAnswer(this.participantInfo.childhoodEnglishUsage);
            const surveySection = `
                <div class="mt-4 text-start">
                    <h5 class="mb-2">アンケート回答</h5>
                    <div class="bg-light rounded p-3">
                        <p class="mb-2"><strong>英語資格・スコア</strong><br>${englishQualificationsDisplay}</p>
                        <p class="mb-2"><strong>3ヶ月以上の留学・海外滞在経験</strong><br>${studyAbroadDisplay}</p>
                        <p class="mb-0"><strong>幼少期の英語使用状況</strong><br>${childhoodDisplay}</p>
                    </div>
                </div>
            `;

            app.innerHTML = `
                <div class="row pt-4 fade-in">
                    <div class="col-xl-8 col-lg-10 offset-xl-2 offset-lg-1">
                        <div class="card p-4 shadow-sm text-center">
                            <h2 class="mb-4">テスト完了</h2>
                            ${participantLabel ? `<div class="alert alert-light border text-start"><strong>受験者:</strong> ${participantLabel}</div>` : ''}
                            <div class="alert alert-success">
                                <h3 class="mb-3">推定語彙サイズ: ${vocabSize} 語</h3>
                                <p>読解レベル: ${this.readingLevel}Kレベル</p>
                                <p>語彙問題正答率: ${accuracy}%</p>
                            </div>
                            ${surveySection}
                            <div class="mt-4 d-flex flex-wrap justify-content-center gap-3">
                                <button id="downloadBtn" class="btn btn-success btn-lg">
                                    <i class="fas fa-file-excel me-2"></i>結果をExcelでダウンロード
                                </button>
                                <button id="restartBtn" class="btn btn-outline-secondary btn-lg">
                                    <i class="fas fa-redo me-2"></i>再テスト
                                </button>
                            </div>
                            <div class="mt-3 text-muted small">
                                Excelファイルには語彙・読解の詳細データとアンケート回答が含まれます。<br>
                                Session ID: ${this.dataCollector.currentSession.sessionId}
                            </div>
                        </div>
                    </div>
                </div>
            `;

            document.getElementById('downloadBtn').addEventListener('click', () => {
                this.exportToExcel();
            });

            document.getElementById('restartBtn').addEventListener('click', () => {
                if (confirm('新しいテストを開始しますか？現在のデータは保存されています。')) {
                    location.reload();
                }
            });
            
            // Log test completion
            this.dataCollector.logInteraction('test_completed', {
                finalVocabSize: vocabSize,
                accuracy: accuracy,
                totalDuration: Date.now() - this.dataCollector.currentSession.startTime.getTime(),
                participant: { ...this.participantInfo }
            });
        }
    }

    renderReadingPhase() {
        if (!this.currentReadingText) {
            console.error('No reading text available');
            this.showError(new Error('読解テキストが見つかりません'));
            return;
        }
        
        const app = document.getElementById('app');
        const currentType = this.phase.replace('reading_', '');
        const typeLabel = currentType === 'narrative' ? '物語文' : '説明文';
        const questionNum = this.readingStep === 'question1' ? 1 : 2;
        const participantLabel = this.formatParticipantLabel();

        if (this.readingStep === 'text') {
            // Log text presentation
            this.dataCollector.logInteraction('reading_text_shown', {
                type: currentType,
                level: this.readingLevel
            });
            
            // Show reading text
            app.innerHTML = `
                <div class="container py-4 fade-in reading-layout">
                    <div class="row justify-content-center">
                        <div class="col-xl-8 col-lg-10">
                            ${participantLabel ? `<div class="text-muted small mb-2">受験者: ${participantLabel}</div>` : ''}
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <div>
                                    <h4 class="mb-1">${typeLabel}読解</h4>
                                    <span class="badge bg-info">レベル ${this.readingLevel}K</span>
                                </div>
                                <span class="text-muted small"><i class="fas fa-book-open me-1"></i>全文を読んでから問題へ進んでください</span>
                            </div>
                            <div class="reading-text-pane shadow-sm" id="readingTextPane" tabindex="0">
                                ${this.currentReadingText.text.split('\n').filter(p => p.trim()).map(paragraph => 
                                    `<p>${this.escapeHtml(paragraph)}</p>`
                                ).join('')}
                            </div>
                            <div class="mt-4 d-flex flex-column flex-lg-row align-items-lg-center gap-3">
                                <div class="flex-grow-1 w-100">
                                    <div class="reading-scroll-indicator" aria-hidden="true">
                                        <div class="reading-scroll-progress" id="readingScrollProgress"></div>
                                    </div>
                                    <small id="readingScrollHint" class="text-muted reading-scroll-hint">
                                        <i class="fas fa-arrow-down status-icon me-1"></i>テキストを最後までスクロールするとボタンが有効になります
                                    </small>
                                </div>
                                <button id="continueBtn" class="btn btn-primary btn-lg" disabled aria-disabled="true">理解問題に進む</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            document.getElementById('continueBtn').addEventListener('click', () => {
                this.readingStep = 'question1';
                const currentType = this.phase.replace('reading_', '');
                this.readingTimes[currentType].question1Start = new Date();
                
                // Log reading time
                this.dataCollector.logInteraction('reading_text_finished', {
                    type: currentType,
                    readingTime: Date.now() - this.readingTimes[currentType].textStart.getTime()
                });
                
                this.render();
            });

            const textPane = document.getElementById('readingTextPane');
            const continueBtn = document.getElementById('continueBtn');
            const progressBar = document.getElementById('readingScrollProgress');
            const scrollHint = document.getElementById('readingScrollHint');
            let scrollCompleted = false;

            const updateScrollProgress = () => {
                if (!textPane || !continueBtn) return;
                const scrollableDistance = Math.max(0, textPane.scrollHeight - textPane.clientHeight);
                const nearBottom = scrollableDistance === 0 ||
                    textPane.scrollTop >= scrollableDistance - 2 ||
                    Math.ceil(textPane.scrollTop + textPane.clientHeight) >= textPane.scrollHeight - 1;
                let progressRatio = scrollableDistance === 0 ? 1 :
                    Math.min(1, Math.max(0, textPane.scrollTop / scrollableDistance));
                if (nearBottom) {
                    progressRatio = 1;
                }

                if (progressBar) {
                    progressBar.style.width = `${Math.round(progressRatio * 100)}%`;
                }

                if (nearBottom) {
                    if (!scrollCompleted) {
                        scrollCompleted = true;
                        this.dataCollector.logInteraction('reading_scroll_completed', {
                            type: currentType,
                            level: this.readingLevel
                        });
                    }
                    continueBtn.disabled = false;
                    continueBtn.setAttribute('aria-disabled', 'false');
                    continueBtn.classList.remove('disabled');
                    if (scrollHint) {
                        scrollHint.classList.add('complete');
                        scrollHint.innerHTML = '<i class="fas fa-check-circle status-icon me-1"></i>スクロール完了 - 続行できます';
                    }
                } else {
                    if (!scrollCompleted) {
                        continueBtn.disabled = true;
                        continueBtn.setAttribute('aria-disabled', 'true');
                    }
                    if (scrollHint && !scrollHint.classList.contains('complete')) {
                        scrollHint.innerHTML = '<i class="fas fa-arrow-down status-icon me-1"></i>テキストを最後までスクロールしてください';
                    }
                }
            };

            if (textPane) {
                textPane.scrollTop = 0;
                setTimeout(() => { textPane.scrollTop = 0; }, 0);
                textPane.addEventListener('scroll', updateScrollProgress, { passive: true });
                // Ensure initial state is calculated after layout
                setTimeout(updateScrollProgress, 50);
            }

        } else {
            // Show question
            const questionText = this.readingStep === 'question1' ? 
                this.currentReadingText.question1 : this.currentReadingText.question2;

            app.innerHTML = `
                <div class="container py-4 reading-layout fade-in">
                    <div class="row justify-content-center">
                        <div class="col-xl-10 col-lg-11">
                            ${participantLabel ? `<div class="text-muted small mb-2">受験者: ${participantLabel}</div>` : ''}
                            <div class="row g-4 align-items-stretch">
                                <div class="col-lg-7">
                                    <div class="reading-text-pane shadow-sm sticky-lg-top">
                                        <div class="d-flex justify-content-between align-items-center mb-3">
                                            <h6 class="mb-0">${typeLabel}テキスト</h6>
                                            <span class="badge bg-light text-dark">参照用</span>
                                        </div>
                                        ${this.currentReadingText.text.split('\n').filter(p => p.trim()).map(paragraph => 
                                            `<p>${this.escapeHtml(paragraph)}</p>`
                                        ).join('')}
                                    </div>
                                </div>
                                <div class="col-lg-5">
                                    <div class="card reading-question-pane h-100">
                                        <div class="card-body d-flex flex-column">
                                            <div class="mb-3">
                                                <h5 class="mb-2">問題 ${questionNum}</h5>
                                                <p class="text-muted small mb-3">文章の内容を踏まえて自由に回答してください。</p>
                                                <p>${this.escapeHtml(questionText)}</p>
                                            </div>
                                            <textarea id="answerText" class="form-control flex-grow-1 mb-3" rows="8" placeholder="こちらに回答を入力してください..."></textarea>
                                            <button id="submitAnswer" class="btn btn-primary btn-lg w-100 mt-auto">回答を提出</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Track text input
            let typingStarted = false;
            document.getElementById('answerText').addEventListener('input', (e) => {
                if (!typingStarted && e.target.value.length > 0) {
                    typingStarted = true;
                    this.dataCollector.logInteraction('answer_typing_started', {
                        question: this.readingStep,
                        type: currentType
                    });
                }
            });

            document.getElementById('submitAnswer').addEventListener('click', () => {
                const answer = document.getElementById('answerText').value.trim();
                if (answer) {
                    this.handleReadingAnswer(answer);
                } else {
                    alert('回答を入力してください。');
                }
            });
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const catTest = new VocabReadingCATTest();
});
