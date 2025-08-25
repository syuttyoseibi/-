document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('video');
    const captureBtn = document.getElementById('capture-btn');
    const startCameraBtn = document.getElementById('start-camera-btn');
    const uploadBtn = document.getElementById('upload-btn');
    const cameraContainer = document.getElementById('camera-container');
    
    const previewContainer = document.getElementById('preview-container');
    const previewImg = document.getElementById('preview-img');
    const solveBtn = document.getElementById('solve-btn');

    const resultContainer = document.getElementById('result-container');
    const loading = document.getElementById('loading');
    const resultText = document.getElementById('result-text');

    const historyList = document.getElementById('history-list');
    const clearHistoryBtn = document.getElementById('clear-history-btn');

    let stream;
    let imageDataUrl = '';

    // カメラ起動
    startCameraBtn.addEventListener('click', async () => {
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
    });

    // 写真を撮影
    captureBtn.addEventListener('click', () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        imageDataUrl = canvas.toDataURL('image/jpeg');
        showPreview(imageDataUrl);
        stopCamera();
    });

    // 画像をアップロード
    uploadBtn.addEventListener('change', (event) => {
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
    });

    // プレビュー表示
    function showPreview(dataUrl) {
        previewImg.src = dataUrl;
        previewContainer.style.display = 'block';
        cameraContainer.style.display = 'none';
    }

    // カメラ停止
    function stopCamera() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            cameraContainer.style.display = 'none';
        }
    }

    // AIに質問
    solveBtn.addEventListener('click', async () => {
        if (!imageDataUrl) {
            alert('画像がありません。');
            return;
        }

        loading.style.display = 'block';
        resultText.textContent = 'ここに解説が表示されます。';

        try {
            const response = await fetch('/api/solve', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ image: imageDataUrl }),
            });

            if (!response.ok) {
                const errorText = await response.text(); // エラー応答をテキストとして読み取る
                throw new Error(errorText || 'サーバーでエラーが発生しました。');
            }

            const data = await response.json();
            resultText.textContent = data.result;
            saveToHistory(imageDataUrl, data.result);

        } catch (error) {
            console.error('Error:', error);
            resultText.textContent = `エラーが発生しました: ${error.message}`;
        } finally {
            loading.style.display = 'none';
        }
    });

    // 履歴を保存
    function saveToHistory(image, result) {
        const history = getHistory();
        history.unshift({ image, result }); // 新しいものを先頭に追加
        if (history.length > 20) { // 履歴は最大20件まで
            history.pop();
        }
        localStorage.setItem('qaHistory', JSON.stringify(history));
        loadHistory();
    }

    // 履歴を読み込み
    function loadHistory() {
        const history = getHistory();
        historyList.innerHTML = ''; // いったんクリア
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
            p.textContent = item.result.substring(0, 100) + '...'; // 冒頭100文字だけ表示

            div.appendChild(img);
            div.appendChild(p);
            historyList.appendChild(div);
        });
    }

    // 履歴を取得
    function getHistory() {
        return JSON.parse(localStorage.getItem('qaHistory')) || [];
    }

    // 履歴を消去
    clearHistoryBtn.addEventListener('click', () => {
        if (confirm('本当にすべての記録を消去しますか？')) {
            localStorage.removeItem('qaHistory');
            loadHistory();
        }
    });

    // 初期読み込み
    loadHistory();
});
