document.addEventListener('DOMContentLoaded', () => {
    // DOM要素の取得
    const video = document.getElementById('video');
    const captureBtn = document.getElementById('capture-btn');
    const startCameraBtn = document.getElementById('start-camera-btn');
    const uploadBtn = document.getElementById('upload-btn');
    const cameraContainer = document.getElementById('camera-container');
    const previewContainer = document.getElementById('preview-container');
    const previewImg = document.getElementById('preview-img');
    const solveBtn = document.getElementById('solve-btn');
    const resultText = document.getElementById('result-text');
    const loading = document.getElementById('loading');
    const historyList = document.getElementById('history-list');
    const clearHistoryBtn = document.getElementById('clear-history-btn');
    const chatContainer = document.getElementById('chat-container');
    const chatHistory = document.getElementById('chat-history');
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');

    let stream;
    let imageDataUrl = '';
    let conversationHistory = [];

    // === 初期化処理 ===
    loadHistory();

    // === イベントリスナー ===
    startCameraBtn.addEventListener('click', startCamera);
    captureBtn.addEventListener('click', captureImage);
    uploadBtn.addEventListener('change', handleFileUpload);
    solveBtn.addEventListener('click', handleInitialQuestion);
    chatForm.addEventListener('submit', handleFollowUpQuestion);
    clearHistoryBtn.addEventListener('click', clearHistory);

    // === カメラ関連の関数 ===
    async function startCamera() {
        cameraContainer.style.display = 'block';
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            video.srcObject = stream;
        } catch (err) {
            console.error("カメラの起動に失敗しました: ", err);
            alert("カメラを起動できませんでした。ブラウザの権限を確認してください。");
        }
    }

    function captureImage() {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        imageDataUrl = canvas.toDataURL('image/jpeg');
        showPreview(imageDataUrl);
        stopCamera();
    }

    function handleFileUpload(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                imageDataUrl = e.target.result;
                showPreview(imageDataUrl);
                stopCamera();
            };
            reader.readAsDataURL(file);
        }
    }

    function showPreview(dataUrl) {
        previewImg.src = dataUrl;
        previewContainer.style.display = 'block';
        cameraContainer.style.display = 'none';
    }

    function stopCamera() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            cameraContainer.style.display = 'none';
        }
    }

    // === AIとのやり取り関連 ===
    async function handleInitialQuestion() {
        if (!imageDataUrl) {
            alert('画像がありません。');
            return;
        }
        loading.style.display = 'block';
        resultText.innerHTML = '';
        chatContainer.style.display = 'none';
        conversationHistory = [];

        try {
            const response = await fetch('/api/solve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: imageDataUrl }),
            });

            if (!response.ok) throw new Error(await response.text());

            const data = await response.json();
            const initialAnswer = data.result;

            resultText.innerHTML = initialAnswer;
            saveToHistory(imageDataUrl, initialAnswer);

            // 会話履歴を初期化
            conversationHistory.push({ role: 'user', parts: [{ text: '画像の問題を解いてください。'}] });
            conversationHistory.push({ role: 'model', parts: [{ text: initialAnswer }] });

            chatContainer.style.display = 'block';
            chatHistory.innerHTML = '';

        } catch (error) {
            console.error('Error:', error);
            resultText.innerHTML = `エラーが発生しました: ${error.message}`;
        } finally {
            loading.style.display = 'none';
        }
    }

    async function handleFollowUpQuestion(event) {
        event.preventDefault();
        const userQuestion = chatInput.value.trim();
        if (!userQuestion) return;

        appendChatMessage(userQuestion, 'user');
        chatInput.value = '';
        loading.style.display = 'block';

        try {
            const response = await fetch('/api/solve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: userQuestion, history: conversationHistory }),
            });

            if (!response.ok) throw new Error(await response.text());

            const data = await response.json();
            const modelAnswer = data.result;

            appendChatMessage(modelAnswer, 'model');
            
            // 会話履歴を更新
            conversationHistory.push({ role: 'user', parts: [{ text: userQuestion }] });
            conversationHistory.push({ role: 'model', parts: [{ text: modelAnswer }] });

        } catch (error) {
            console.error('Error:', error);
            appendChatMessage(`エラーが発生しました: ${error.message}`, 'model');
        } finally {
            loading.style.display = 'none';
        }
    }

    function appendChatMessage(message, role) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${role}-message`;
        messageDiv.innerHTML = message;
        chatHistory.appendChild(messageDiv);
        chatHistory.scrollTop = chatHistory.scrollHeight; // 自動スクロール
    }

    // === 学習の記録（履歴）関連 ===
    function saveToHistory(image, result) {
        const history = getHistory();
        history.unshift({ image, result });
        if (history.length > 20) history.pop();
        localStorage.setItem('qaHistory', JSON.stringify(history));
        loadHistory();
    }

    function loadHistory() {
        const history = getHistory();
        historyList.innerHTML = '';
        if (history.length === 0) {
            historyList.innerHTML = '<p>まだ記録はありません。</p>';
            return;
        }
        history.forEach(item => {
            const div = document.createElement('div');
            div.className = 'history-item';
            const img = document.createElement('img');
            img.src = item.image;
            const p = document.createElement('p');
            p.innerHTML = item.result.substring(0, 200) + '...'; // innerHTMLに変更
            div.appendChild(img);
            div.appendChild(p);
            historyList.appendChild(div);
        });
    }

    function getHistory() {
        return JSON.parse(localStorage.getItem('qaHistory')) || [];
    }

    function clearHistory() {
        if (confirm('本当にすべての記録を消去しますか？')) {
            localStorage.removeItem('qaHistory');
            loadHistory();
        }
    }
});