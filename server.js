const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const xlsx = require('xlsx');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let questionPool = [];

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

        questionPool = rawData.map((row) => {
            let opts = [
                row.optionA || row.Option_A || row.A || "",
                row.optionB || row.Option_B || row.B || "",
                row.optionC || row.Option_C || row.C || "",
                row.optionD || row.Option_D || row.D || ""
            ].filter(Boolean);

            return {
                q: row.questionText || row.Question_Text || row.question || "",
                options: opts,
                correctText: String(row.correctAnswerText || row.Correct_Answer || row.answer || "").trim(),
                ref: row.verseReference || row.bookDetails || ""
            };
        }).filter(item => item.q !== "");

        console.log(`✅ ${questionPool.length} वटा प्रश्नहरू '${fileToRead}' बाट सफलतापूर्वक लोड भए!`);
    } catch (err) {
        console.error("❌ फाइल पढ्दा समस्या भयो:", err);
    }
}

loadQuestions();

// एप खुल्नेबित्तिकै ब्राउजरलाई प्रश्नहरू पठाउने API
app.get('/api/questions', (req, res) => {
    res.json(questionPool);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 सर्भर पोर्ट ${PORT} मा चलिरहेको छ`);
});
