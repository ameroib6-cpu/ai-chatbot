// server.js
// هذا هو "الخادم" - العقل اللي يربط بين واجهة الموقع (اللي يشوفها المستخدم)
// وبين خدمة الذكاء الاصطناعي (OpenRouter).
// المستخدم ما يتواصل مع OpenRouter مباشرة أبداً؛ يمر دايماً من هنا.
// هذا مهم جداً للأمان: مفتاح الـ API يبقى مخفي على الخادم ولا يظهر للمستخدم أبداً.

require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// نقرأ المفتاح من "متغيرات البيئة" (Environment Variables) وليس من الكود مباشرة.
// هذا يعني إن المفتاح ما يكون مكتوب بالكود، فما ينكشف حتى لو شاف أحد الكود.
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.warn('⚠️  تحذير: ما فيه OPENROUTER_API_KEY بمتغيرات البيئة. البوت ما بيشتغل لين تضيفه.');
}

app.use(cors());
app.use(express.json());

// نخدم ملفات الواجهة (الصفحة اللي يشوفها المستخدم) من مجلد public
app.use(express.static(path.join(__dirname, 'public')));

// نحد عدد الرسائل المخزنة بكل جلسة عشان ما تكبر الذاكرة بلا داعي
const MAX_HISTORY_MESSAGES = 20;

// هذا هو المسار (endpoint) اللي تتواصل معه الواجهة لما المستخدم يرسل رسالة
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'الرسالة فارغة' });
    }

    if (!OPENROUTER_API_KEY) {
      return res.status(500).json({ error: 'الخادم غير مهيأ بعد. تأكد من إضافة مفتاح OpenRouter.' });
    }

    // نبني قائمة الرسائل: رسالة النظام (شخصية البوت) + آخر رسائل المحادثة + رسالة المستخدم الجديدة
    const messages = [
      {
        role: 'system',
        content: 'أنت مساعد ذكاء اصطناعي ودود ومفيد. ترد باللغة اللي يكتب فيها المستخدم. ردودك واضحة ومختصرة وعملية.',
      },
      ...(Array.isArray(history) ? history.slice(-MAX_HISTORY_MESSAGES) : []),
      { role: 'user', content: message },
    ];

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // نستخدم نموذج مجاني قوي. ممكن تغيّر هذا لاحقاً لأي موديل ثاني من OpenRouter.
        model: 'meta-llama/llama-3.3-70b-instruct:free',
        messages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('خطأ من OpenRouter:', response.status, errText);
      return res.status(502).json({ error: 'صار خطأ بالتواصل مع خدمة الذكاء الاصطناعي. حاول مرة ثانية بعد شوي.' });
    }

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content || 'ما قدرت أفهم، حاول تصيغ سؤالك بطريقة ثانية.';

    res.json({ reply });
  } catch (err) {
    console.error('خطأ داخلي:', err);
    res.status(500).json({ error: 'صار خطأ غير متوقع بالخادم.' });
  }
});

// أي مسار ثاني، نرجع صفحة الواجهة الرئيسية (مفيد لو صار توسع بالمستقبل)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ الخادم شغال على المنفذ ${PORT}`);
});
