const fetch = require('node-fetch');

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

        const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

        let contents = [];

        if (image) { // Initial request
            const mimeType = image.match(/data:(.*);base64,/)[1];
            const base64Data = image.split(',')[1];
            contents.push({
                role: 'user',
                parts: [
                    {
                        text: `あなたは優秀で親切な家庭教師です。

【思考プロセス】
1. まず、画像に写っている問題や、特にグラフや図表を注意深く、詳細に観察・分析してください。軸のラベル、単位、データ点などを正確に読み取ります。
2. 次に、その分析結果に基づいて問題を解き、最終的な答えを導き出してください。
3. 最後に、あなたの答えが正しいか必ず確認してください。

【解説のルール】
解説は、日本の小学生や中学生にも分かるように、非常に丁寧な言葉遣いでお願いします。答えだけでなく、その答えに至るまでの考え方、途中式、重要なポイントを、順を追って詳しく説明してください。

【出力形式】
最終的な出力は、すべての漢字にふりがなを振ったHTML形式で生成してください。ふりがなは、<ruby>漢字<rt>かんじ</rt></ruby>のように、必ずHTMLのrubyタグを使用してください。`
                    },
                    {
                        inline_data: {
                            mime_type: mimeType,
                            data: base64Data
                        }
                    }
                ]
            });
        } else { // Follow-up request
            contents = history; // Restore conversation history
            contents.push({ role: 'user', parts: [{ text: question }] });
        }

        const requestBody = { contents };

        const apiRes = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        if (!apiRes.ok) {
            const errorBody = await apiRes.text();
            console.error('Gemini API Error:', errorBody);
            return res.status(apiRes.status).json({ error: `Gemini API error: ${apiRes.statusText}` });
        }

        const data = await apiRes.json();
        const text = data.candidates[0].content.parts[0].text;

        res.status(200).json({ result: text });

    } catch (error) {
        console.error('Server Error:', error);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
};