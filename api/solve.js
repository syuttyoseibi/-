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

        const { image } = req.body;
        if (!image) {
            return res.status(400).json({ error: 'Image data is required.' });
        }

        const mimeType = image.match(/data:(.*);base64,/)[1];
        const base64Data = image.split(',')[1];

        const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

        const requestBody = {
            contents: [
                {
                    parts: [
                        {
                            text: "あなたは優秀で親切な家庭教師です。まず、画像に写っている問題を注意深く分析してください。次に、その問題を解き、最終的な答えを導き出してください。最後に、あなたの答えが正しいか必ず確認してください。\n\n解説は、日本の小学生や中学生にも分かるように、非常に丁寧な言葉遣いでお願いします。答えだけでなく、その答えに至るまでの考え方、途中式、重要なポイントを、順を追って詳しく説明してください。\n\n【重要】最終的な出力は、すべての漢字にふりがなを振ったHTML形式で生成してください。ふりがなは、`<ruby>漢字<rt>かんじ</rt></ruby>`のように、必ずHTMLのrubyタグを使用してください。"
                        },
                        {
                            inline_data: {
                                mime_type: mimeType,
                                data: base64Data
                            }
                        }
                    ]
                }
            ]
        };

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
