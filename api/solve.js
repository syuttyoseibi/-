const fetch = require('node-fetch');

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // Vercelの環境変数からAPIキーを取得
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'API key is not configured.' });
        }

        const { image } = req.body;
        if (!image) {
            return res.status(400).json({ error: 'Image data is required.' });
        }

        // Base64データからMIMEタイプと純粋なデータ部分を分離
        const mimeType = image.match(/data:(.*);base64,/)[1];
        const base64Data = image.split(',')[1];

        const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

        const requestBody = {
            contents: [
                {
                    parts: [
                        {
                            text: "この画像に写っている問題や質問を、日本の学生に分かりやすく、ステップ・バイ・ステップで解説してください。数式も使って、答えだけでなく考え方も詳しく説明してください。"
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
        
        // レスポンスからテキストを抽出
        const text = data.candidates[0].content.parts[0].text;
        
        res.status(200).json({ result: text });

    } catch (error) {
        console.error('Server Error:', error);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
}
