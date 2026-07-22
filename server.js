const express = require('express');
const http = require('http');
const path = require('path');
const xlsx = require('xlsx');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

app.use(express.static(path.join(__dirname, 'public')));

let questionPool = [];

// एक्सेल/CSV बाट प्रश्नहरू तान्ने फङ्सन
function loadQuestions() {
    try {
        const filesToCheck = ['./questions.xlsx', './questions.csv', './nepali_bible_quiz__________1.csv'];
        let fileToRead = null;

        for (let file of filesToCheck) {
            if (fs.existsSync(file)) {
                fileToRead = file;
                break;
            }
        }

        if (!fileToRead) {
            console.error("❌ कुनै पनि प्रश्नको फाइल भेटिएन!");
            return;
        }

        const fileBuffer = fs.readFileSync(fileToRead);
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawData = xlsx.utils.sheet_to_json(sheet, { defval: "" });

        // यहाँ एक्सेलको डाटाहरूलाई यो नयाँ गेमले बुझ्ने ढाँचामा मिलाइएको छ
        questionPool = rawData.map((row) => {
            let opts = [
                String(row.optionA || row.Option_A || row.A || "").trim(),
                String(row.optionB || row.Option_B || row.B || "").trim(),
                String(row.optionC || row.Option_C || row.C || "").trim(),
                String(row.optionD || row.Option_D || row.D || "").trim()
            ].filter(Boolean);

            let correctAnsText = String(row.correctAnswerText || row.Correct_Answer || row.answer || "").trim();
            // सही उत्तरको इन्डेक्स पत्ता लगाउने (0 देखि 3 सम्म)
            let correctIndex = opts.findIndex(opt => opt.toLowerCase() === correctAnsText.toLowerCase());
            
            // यदि सही उत्तर पत्ता लागेन भने डिफल्ट 0 मान्ने
            if(correctIndex === -1) correctIndex = 0;

            return {
                q: String(row.questionText || row.Question_Text || row.question || "").trim(),
                o: opts,
                a: correctIndex,
                v: String(row.verseReference || row.bookDetails || "").trim()
            };
        }).filter(item => item.q !== "");

        console.log(`✅ ${questionPool.length} वटा प्रश्नहरू लोड भए!`);
    } catch (err) {
        console.error("❌ फाइल पढ्दा समस्या भयो:", err);
    }
}

loadQuestions();

// यो API ले ब्राउजरलाई प्रश्नहरू दिन्छ
app.get('/api/questions', (req, res) => {
    if (questionPool.length === 0) {
        // यदि फाइल भेटिएन भने एउटा नमुना प्रश्न पठाउने
        res.json([{
            q: "एक्सेल फाइलबाट प्रश्नहरू लोड हुन सकेन। कृपया फाइल चेक गर्नुहोस्।",
            o: ["अप्सन १", "अप्सन २", "अप्सन ३", "अप्सन ४"],
            a: 0,
            v: "त्रुटि"
        }]);
    } else {
        res.json(questionPool);
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 सर्भर पोर्ट ${PORT} मा चलिरहेको छ`);
});
