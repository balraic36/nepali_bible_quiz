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

// प्रश्नहरू भण्डारण गर्ने ठाउँ
let questionPool = [];

// 💡 जादुयी रिडर: जसले जुनसुकै नाम र हेडिङ भए पनि आफैं मिलाउँछ
function loadQuestions() {
    try {
        // कुन-कुन फाइल छन् भनेर खोज्ने
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

        // फाइल पढ्ने (xlsx ले भित्रभित्रै CSV पनि चिन्न सक्छ)
        const fileBuffer = fs.readFileSync(fileToRead);
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawData = xlsx.utils.sheet_to_json(sheet, { defval: "" });

        // हेडिङको नाम जे भए पनि आफैं मिलाउने (Auto-Mapping)
        questionPool = rawData.map(row => {
            return {
                q: row.questionText || row.Question_Text || row.question || "",
                options: [
                    row.optionA || row.Option_A || row.A || "",
                    row.optionB || row.Option_B || row.B || "",
                    row.optionC || row.Option_C || row.C || "",
                    row.optionD || row.Option_D || row.D || ""
                ].filter(Boolean), // खाली विकल्प आफैं हटाउने
                correctAns: String(row.correctAnswerText || row.Correct_Answer || row.answer || "").trim().toLowerCase(),
                reference: row.verseReference || row.bookDetails || (row.Book ? `${row.Book} ${row.Chapter}:${row.Verse}` : "")
            };
        }).filter(item => item.q !== ""); // खाली प्रश्नहरू हटाउने

        console.log(`✅ जादु! ${questionPool.length} वटा प्रश्नहरू '${fileToRead}' बाट सफलतापूर्वक लोड भए!`);
    } catch (err) {
        console.error("❌ फाइल पढ्दा समस्या भयो:", err);
    }
}

// सर्भर अन हुनेबित्तिकै प्रश्नहरू लोड गर्न लगाउने
loadQuestions();

let gameState = {
    teams: {},
    currentQuestionIndex: -1,
    currentQuestion: null,
    status: 'waiting',
    settings: { basePoints: 10, penalty: -2 }
};

io.on('connection', (socket) => {
    console.log(`नयाँ डिभाइस जोडियो: ${socket.id}`);

    // खेलाडी दर्ता गर्ने
    socket.on('register_team', (teamName) => {
        gameState.teams[socket.id] = { id: socket.id, name: teamName, score: 0 };
        io.emit('update_scoreboard', gameState.teams);
        socket.emit('registration_success', socket.id);
    });

    // होस्टले "अर्को प्रश्न पठाउनुहोस्" थिच्दा
    socket.on('host_next_question', () => {
        if (questionPool.length === 0) {
            console.log("प्रश्नहरू लोड भएका छैनन्। फाइल चेक गर्नुहोस्!");
            return; 
        }

        gameState.currentQuestionIndex++;
        
        if (gameState.currentQuestionIndex < questionPool.length) {
            gameState.currentQuestion = questionPool[gameState.currentQuestionIndex];
            gameState.status = 'reading';
            
            io.emit('receive_question', {
                q: gameState.currentQuestion.q,
                options: gameState.currentQuestion.options
            });
        } else {
            console.log("सबै प्रश्नहरू सकिए!");
        }
    });

    // उत्तर चेक गर्ने (सानो/ठूलो अक्षरले फरक नपर्ने गरी)
    socket.on('submit_answer', (answer) => {
        if (!gameState.teams[socket.id] || !gameState.currentQuestion) return;
        
        const team = gameState.teams[socket.id];
        const correctAns = gameState.currentQuestion.correctAns;
        const givenAns = String(answer).trim().toLowerCase();
        
        const isCorrect = (givenAns === correctAns);

        if (isCorrect) {
            team.score += gameState.settings.basePoints;
            const ref = gameState.currentQuestion.reference || "सही उत्तर!";
            io.emit('answer_result', { teamName: team.name, isCorrect: true, ref: ref });
        } else {
            team.score += gameState.settings.penalty;
            io.emit('answer_result', { teamName: team.name, isCorrect: false });
        }
        io.emit('update_scoreboard', gameState.teams);
    });

    socket.on('disconnect', () => {
        if (gameState.teams[socket.id]) {
            delete gameState.teams[socket.id];
            io.emit('update_scoreboard', gameState.teams);
            console.log(`डिभाइस छुट्यो: ${socket.id}`);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 सर्भर पोर्ट ${PORT} मा चलिरहेको छ`);
});
