// プリセットサンプル問題
const PRESET_QUESTIONS = [
    { question: "日本で一番高い山は富士山ですが、日本で一番広い湖は何でしょう？", answer: "琵琶湖", explanation: "滋賀県にある湖で、面積は約670平方キロメートルです。" },
    { question: "「吾輩は猫である」や「坊っちゃん」などの名作を残した、日本の小説家は誰でしょう？", answer: "夏目漱石", explanation: "千円札の肖像としても親しまれました。" },
    { question: "元素記号「Au」で表される、日本語では「金」と呼ばれる金属は何でしょう？", answer: "金（ゴールド）", explanation: "ラテン語の「Aurum（光るもの）」に由来します。" },
    { question: "サッカーの1チームのピッチ上の選手数は11人ですが、バスケットボールの1チームのコート上の選手数は何人でしょう？", answer: "5人", explanation: "ベンチメンバーを含めて最大12名登録できます。" },
    { question: "慣用句で、非常に短い時間のことを「一」という漢字を使った四字熟語で何というでしょう？", answer: "一瞬 / 一朝一夕", explanation: "わずかな時間を表す言葉です。" }
];

// アプリ全体の状態管理
let questions = [...PRESET_QUESTIONS];
let currentQIndex = -1;
let isReading = false;
let isBuzzed = false;
let answerRevealed = false;
let spokenCharCount = 0;
let fallbackTimer = null;
let availableVoices = [];

let myPlayerName = 'プレイヤー ' + Math.floor(Math.random() * 900 + 100);
let scores = {};
scores[myPlayerName] = 0;

// DOM要素の読み込み
const changeNameBtn = document.getElementById('changeNameBtn');
const nameModal = document.getElementById('nameModal');
const nameModalInput = document.getElementById('nameModalInput');
const cancelNameModalBtn = document.getElementById('cancelNameModalBtn');
const saveNameModalBtn = document.getElementById('saveNameModalBtn');
const buzzBtn = document.getElementById('buzzBtn');
const questionDisplayText = document.getElementById('questionDisplayText');
const nextQBtn = document.getElementById('nextQBtn');
const judgeCorrectBtn = document.getElementById('judgeCorrectBtn');
const judgeWrongBtn = document.getElementById('judgeWrongBtn');
const showAnswerBtn = document.getElementById('showAnswerBtn');
const answerArea = document.getElementById('answerArea');
const answerText = document.getElementById('answerText');
const explanationText = document.getElementById('explanationText');
const statusBadge = document.getElementById('statusBadge');
const currentQNumEl = document.getElementById('currentQNum');
const totalQNumEl = document.getElementById('totalQNum');
const speechRateSelect = document.getElementById('speechRate');
const testAudioBtn = document.getElementById('testAudioBtn');
const buzzedNotice = document.getElementById('buzzedNotice');
const buzzerName = document.getElementById('buzzerName');
const buzzPointText = document.getElementById('buzzPointText');
const buzzPointContainer = document.getElementById('buzzPointContainer');
const scoreboardList = document.getElementById('scoreboardList');
const playerNameDisplay = document.getElementById('playerNameDisplay');
const showTextWhileReadingCheckbox = document.getElementById('showTextWhileReadingCheckbox');
const showBuzzPointCheckbox = document.getElementById('showBuzzPointCheckbox');
const csvFileInput = document.getElementById('csvFileInput');
const dropZone = document.getElementById('dropZone');
const loadedCount = document.getElementById('loadedCount');
const useSampleCheckbox = document.getElementById('useSampleCheckbox');
const clearQuestionsBtn = document.getElementById('clearQuestionsBtn');
const downloadSampleBtn = document.getElementById('downloadSampleBtn');
const resetScoreBtn = document.getElementById('resetScoreBtn');

// 初期表示セットアップ
playerNameDisplay.textContent = myPlayerName;
totalQNumEl.textContent = questions.length;
renderScoreboard();

// 音声エンジン（Web Speech API）の読み込み
function loadVoices() {
    if ('speechSynthesis' in window) {
        availableVoices = window.speechSynthesis.getVoices();
        window.speechSynthesis.onvoiceschanged = () => {
            availableVoices = window.speechSynthesis.getVoices();
        };
    }
}
loadVoices();

function getJapaneseVoice() {
    if (!availableVoices.length && 'speechSynthesis' in window) {
        availableVoices = window.speechSynthesis.getVoices();
    }
    return availableVoices.find(v => v.lang.includes('ja')) || null;
}

// 名前変更ダイアログ
changeNameBtn.addEventListener('click', () => {
    nameModalInput.value = myPlayerName;
    nameModal.classList.remove('hidden');
});
cancelNameModalBtn.addEventListener('click', () => nameModal.classList.add('hidden'));
saveNameModalBtn.addEventListener('click', savePlayerName);
nameModalInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') savePlayerName(); });

function savePlayerName() {
    const val = nameModalInput.value.trim();
    if (val) {
        const oldName = myPlayerName;
        myPlayerName = val;
        playerNameDisplay.textContent = val;
        scores[myPlayerName] = scores[oldName] || 0;
        if (oldName !== val) delete scores[oldName];
        renderScoreboard();
        nameModal.classList.add('hidden');
    }
}

// 問読みロジック
function startReadingQuestion(text) {
    stopSpeech();
    isReading = true;
    isBuzzed = false;
    answerRevealed = false;
    spokenCharCount = 0;

    judgeCorrectBtn.disabled = true;
    judgeWrongBtn.disabled = true;

    statusBadge.textContent = "問読み中...";
    statusBadge.className = "status-badge badge-reading";
    buzzedNotice.classList.add('hidden');
    answerArea.classList.add('hidden');

    questionDisplayText.textContent = '';

    if ('speechSynthesis' in window) {
        try {
            window.speechSynthesis.cancel();
            window.speechSynthesis.resume();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'ja-JP';
            utterance.rate = parseFloat(speechRateSelect.value);
            const voice = getJapaneseVoice();
            if (voice) utterance.voice = voice;

            utterance.onboundary = (e) => {
                if (e.charIndex !== undefined) {
                    spokenCharCount = e.charIndex + (e.charLength || 1);
                    revealTextProgress(text, spokenCharCount);
                }
            };

            utterance.onend = () => {
                if (!isBuzzed) {
                    isReading = false;
                    if (showTextWhileReadingCheckbox.checked) questionDisplayText.textContent = text;
                    statusBadge.textContent = "読み上げ完了";
                    statusBadge.className = "status-badge badge-idle";
                }
            };

            window.activeUtterance = utterance;
            window.speechSynthesis.speak(utterance);
        } catch(e) {}
    }

    // バックアップタイマー（文字表示同期）
    const charDelay = (180 / parseFloat(speechRateSelect.value));
    fallbackTimer = setInterval(() => {
        if (!isReading || isBuzzed) {
            clearInterval(fallbackTimer);
            return;
        }
        spokenCharCount = Math.min(spokenCharCount + 1, text.length);
        revealTextProgress(text, spokenCharCount);
        if (spokenCharCount >= text.length) {
            isReading = false;
            statusBadge.textContent = "読み上げ完了";
            statusBadge.className = "status-badge badge-idle";
            clearInterval(fallbackTimer);
        }
    }, charDelay);
}

function revealTextProgress(fullText, charIndex) {
    if (showTextWhileReadingCheckbox.checked) {
        questionDisplayText.textContent = fullText.substring(0, charIndex);
    } else {
        questionDisplayText.textContent = '（※音声を聞いて早押ししてください）';
    }
}

function stopSpeech() {
    if (fallbackTimer) clearInterval(fallbackTimer);
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    window.activeUtterance = null;
    isReading = false;
    statusBadge.textContent = "待機中";
    statusBadge.className = "status-badge badge-idle";
}

// 音声テスト
testAudioBtn.addEventListener('click', () => {
    if (!('speechSynthesis' in window)) return alert('お使いのブラウザはWeb Speech APIに対応していません。');
    stopSpeech();
    window.speechSynthesis.resume();
    const utterance = new SpeechSynthesisUtterance("問読みのテスト音声を再生しています。");
    utterance.lang = 'ja-JP';
    utterance.rate = parseFloat(speechRateSelect.value);
    const voice = getJapaneseVoice();
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
});

// 早押しボタン処理
function handleBuzz(pName = myPlayerName) {
    if (isBuzzed || currentQIndex < 0) return;
    stopSpeech();
    isBuzzed = true;

    const q = questions[currentQIndex];
    const currentFullText = q ? q.question : "";
    const buzzCutText = currentFullText.substring(0, spokenCharCount) || "（冒頭）";

    buzzerName.textContent = pName;
    buzzPointText.textContent = buzzCutText;

    if (showBuzzPointCheckbox.checked) buzzPointContainer.classList.remove('hidden');
    else buzzPointContainer.classList.add('hidden');

    buzzedNotice.classList.remove('hidden');
    statusBadge.textContent = "早押し発生！";
    statusBadge.className = "status-badge badge-buzzed";
}

function loadNextQuestion() {
    if (questions.length === 0) return alert('問題データがありません。');
    currentQIndex = (currentQIndex + 1) % questions.length;
    const q = questions[currentQIndex];

    currentQNumEl.textContent = currentQIndex + 1;
    totalQNumEl.textContent = questions.length;
    answerArea.classList.add('hidden');

    startReadingQuestion(q.question);
}

function judgeAnswer(isCorrect) {
    if (!answerRevealed) return alert('正誤判定を行う前に「答えを表示」を押してください。');
    if (currentQIndex < 0 || !questions[currentQIndex]) return;

    const target = buzzerName.textContent || myPlayerName;
    scores[target] = (scores[target] || 0) + (isCorrect ? 10 : -10);
    renderScoreboard();
    judgeCorrectBtn.disabled = true;
    judgeWrongBtn.disabled = true;
}

function showAnswer() {
    if (currentQIndex < 0) return;
    const q = questions[currentQIndex];
    if (!q) return;

    stopSpeech();
    questionDisplayText.textContent = q.question;
    answerText.textContent = q.answer;
    explanationText.textContent = q.explanation || "";
    answerArea.classList.remove('hidden');

    answerRevealed = true;
    judgeCorrectBtn.disabled = false;
    judgeWrongBtn.disabled = false;
}

function renderScoreboard() {
    scoreboardList.innerHTML = '';
    Object.entries(scores).sort((a,b) => b[1] - a[1]).forEach(([name, score], idx) => {
        const div = document.createElement('div');
        div.className = 'score-item';
        div.innerHTML = `<span>${idx + 1}. ${name}</span><strong style="color: ${score >= 0 ? '#34d399' : '#f87171'}">${score} pt</strong>`;
        scoreboardList.appendChild(div);
    });
}

// サンプル問題チェックボックス切替
useSampleCheckbox.addEventListener('change', (e) => {
    if (e.target.checked) {
        questions = [...PRESET_QUESTIONS];
        currentQIndex = -1;
        totalQNumEl.textContent = questions.length;
        currentQNumEl.textContent = '0';
        loadedCount.textContent = `${questions.length}問 セット中`;
        questionDisplayText.textContent = 'サンプル問題（5問）を読み込みました。「問題スタート」を押してください。';
    } else {
        questions = [];
        currentQIndex = -1;
        totalQNumEl.textContent = '0';
        currentQNumEl.textContent = '0';
        loadedCount.textContent = '0問';
        questionDisplayText.textContent = '問題データが空になりました。CSVファイルをアップロードしてください。';
    }
    stopSpeech();
});

clearQuestionsBtn.addEventListener('click', () => {
    useSampleCheckbox.checked = false;
    questions = [];
    currentQIndex = -1;
    totalQNumEl.textContent = '0';
    currentQNumEl.textContent = '0';
    loadedCount.textContent = '0問';
    questionDisplayText.textContent = '問題データがクリアされました。CSVファイルをアップロードしてください。';
    stopSpeech();
});

// CSV読み込み処理
function parseCSV(file) {
    if (typeof Papa === 'undefined') return alert('PapaParseライブラリが読み込まれていません。');
    Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        complete: function(results) {
            const parsed = [];
            results.data.forEach((row, i) => {
                if (i === 0 && row[0].includes('問題')) return;
                if (row.length >= 2 && row[0] && row[1]) {
                    parsed.push({ question: row[0].trim(), answer: row[1].trim(), explanation: row[2] ? row[2].trim() : '' });
                }
            });
            if (parsed.length > 0) {
                questions = parsed;
                currentQIndex = -1;
                totalQNumEl.textContent = questions.length;
                currentQNumEl.textContent = '0';
                loadedCount.textContent = `CSV: ${questions.length}問`;
                questionDisplayText.textContent = `CSVから ${questions.length} 問の自作問題を読み込みました。「問題スタート」を押してください。`;
                stopSpeech();
            } else {
                alert('有効な問題データが検出できませんでした。');
            }
        }
    });
}

// イベントリスナー
buzzBtn.addEventListener('click', () => handleBuzz(myPlayerName));
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        handleBuzz(myPlayerName);
    }
});

nextQBtn.addEventListener('click', loadNextQuestion);
judgeCorrectBtn.addEventListener('click', () => judgeAnswer(true));
judgeWrongBtn.addEventListener('click', () => judgeAnswer(false));
showAnswerBtn.addEventListener('click', showAnswer);
resetScoreBtn.addEventListener('click', () => { scores = {}; scores[myPlayerName] = 0; renderScoreboard(); });

downloadSampleBtn.addEventListener('click', () => {
    const csv = "data:text/csv;charset=utf-8,問題文,正解,解説\n日本で一番高い山は富士山ですが、日本で一番広い湖は何でしょう？,琵琶湖,滋賀県にある湖です\n";
    const a = document.createElement("a");
    a.href = encodeURI(csv);
    a.download = "quiz_sample.csv";
    a.click();
});

dropZone.addEventListener('click', () => csvFileInput.click());
csvFileInput.addEventListener('change', (e) => { if (e.target.files.length) parseCSV(e.target.files[0]); });
dropZone.addEventListener('dragover', (e) => e.preventDefault());
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) parseCSV(e.dataTransfer.files[0]);
});
