const fetch = require('node-fetch');

// 汎用的なGemini API呼び出し関数
async function callGemini(apiKey, requestBody) {
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
    
    const apiRes = await fetch(GEMINI_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
    });

    if (!apiRes.ok) {
        const errorBody = await apiRes.text();
        console.error('Gemini API Error:', errorBody);
        throw new Error(`Gemini API error: ${apiRes.statusText}`);
    }

    const data = await apiRes.json();
    // 安全なアクセス
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'API key is not configured.' });
        }

        const { image, question, history } = req.body;

        if (!image && !question) {
            return res.status(400).json({ error: 'Image or question is required.' });
        }

        let finalAnswer = '';

        if (image) { // 初回の画像付きリクエスト
            const mimeType = image.match(/data:(.*);base64,/)[1];
            const base64Data = image.split(',')[1];

            // --- ステップ1: データ抽出AI ---
            const extractorPrompt = {
                contents: [{
                    role: 'user',
                    parts: [
                        { text: `あなたは、画像から構造化データを抽出する専門家です。画像に含まれるグラフや表から、以下の情報を正確に読み取り、JSON形式で出力してください。
- グラフのタイトル (title)
- X軸のラベルと単位 (xAxis: { label, unit })
- Y軸のラベルと単位 (yAxis: { label, unit })
- グラフ上のすべてのデータ点 (dataPoints: [{x, y}, ...])

余計な説明は一切せず、JSONオブジェクトのみを厳密に出力してください。` },
                        { inline_data: { mime_type: mimeType, data: base64Data } }
                    ]
                }]
            };
            console.log("Calling Extractor AI...");
            const jsonResponse = await callGemini(apiKey, extractorPrompt);
            console.log("Extractor AI Response:", jsonResponse);

            let extractedData;
            try {
                // AIの出力からJSON部分だけを抜き出す
                const jsonMatch = jsonResponse.match(/```json\n([\s\S]*?)\n```/);
                const jsonString = jsonMatch ? jsonMatch[1] : jsonResponse;
                extractedData = JSON.parse(jsonString);
            } catch (e) {
                console.error("JSON Parse Error:", e);
                // JSONの解析に失敗した場合、AIに直接問題を解かせるフォールバック
                extractedData = { error: "グラフのデータ抽出に失敗しました。画像から直接問題に答えてください。", originalResponse: jsonResponse };
            }

            // --- ステップ2: 問題解決AI ---
            const solverPromptText = `あなたは優秀で親切な家庭教師です。

以下のデータは、あるグラフから抽出されたものです。

${JSON.stringify(extractedData, null, 2)}

このデータに基づいて、ユーザーの最初の質問である「このグラフの問題を解いてください」に答えてください。

【解説のルール】
解説は、日本の小学生や中学生にも分かるように、非常に丁寧な言葉遣いでお願いします。答えだけでなく、その答えに至るまでの考え方、途中式、重要なポイントを、順を追って詳しく説明してください。

【出力形式】
最終的な出力は、すべての漢字にふりがなを振ったHTML形式で生成してください。ふりがなは、<ruby>漢字<rt>かんじ</rt></ruby>のように、必ずHTMLのrubyタグを使用してください。`;

            const solverPrompt = { contents: [{ role: 'user', parts: [{ text: solverPromptText }] }] };
            console.log("Calling Solver AI...");
            finalAnswer = await callGemini(apiKey, solverPrompt);

        } else { // 会話の続きのリクエスト
            let conversation = [...history];
            conversation.push({ role: 'user', parts: [{ text: question }] });
            const followUpPrompt = { contents: conversation };
            console.log("Calling Follow-up AI...");
            finalAnswer = await callGemini(apiKey, followUpPrompt);
        }

        res.status(200).json({ result: finalAnswer });

    } catch (error) {
        console.error('Server Error:', error);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
};