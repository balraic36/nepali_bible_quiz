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

        questionPool = rawData.map((row, index) => {
            let opts = [
                row.optionA || row.Option_A || row.A || "",
                row.optionB || row.Option_B || row.B || "",
                row.optionC || row.Option_C || row.C || "",
                row.optionD || row.Option_D || row.D || "",
                row.optionE || row.Option_E || row.E || "",
                row.optionF || row.Option_F || row.F || ""
            ].filter(Boolean); // ४ भन्दा बढी विकल्प भए पनि स्वचालित रूपमा लिन्छ

            return {
                id: index,
                q: row.questionText || row.Question_Text || row.question || "",
                options: opts,
                correctAns: String(row.correctAnswerText || row.Correct_Answer || row.answer || "").trim().toLowerCase(),
                reference: row.verseReference || row.bookDetails || (row.Book ? `${row.Book} ${row.Chapter}:${row.Verse}` : "")
            };
        }).filter(item => item.q !== "");

        console.log(`✅ ${questionPool.length} वटा प्रश्नहरू लोड भए!`);
    } catch (err) {
        console.error("❌ फाइल पढ्दा समस्या भयो:", err);
    }
}

loadQuestions();

let gameState = {
    teams: {},
    currentQuestion: null,
    isAnswered: false, // कोहीले सहि उत्तर दिएपछि अर्कोले दिन नपाउने बनाउन
    settings: { basePoints: 10, penalty: -2 }
};

io.on('connection', (socket) => {
    console.log(`नयाँ डिभाइस जोडियो: ${socket.id}`);

    // होस्ट कनेक्ट हुँदा सबै प्रश्नहरूको लिस्ट पठाउने
    socket.on('get_host_data', () => {
        socket.emit('load_question_list', questionPool);
        socket.emit('update_scoreboard', gameState.teams);
    });

    socket.on('register_team', (teamName) => {
        gameState.teams[socket.id] = { id: socket.id, name: teamName, score: 0 };
        io.emit('update_scoreboard', gameState.teams);
        socket.emit('registration_success', socket.id);
    });

    // होस्टले निश्चित गरेको प्रश्न पठाउँदा
    socket.on('host_select_question', (qIndex) => {
        if (questionPool[qIndex]) {
            gameState.currentQuestion = questionPool[qIndex];
            gameState.isAnswered = false; // नयाँ प्रश्नको लागि अनलक
            
            io.emit('receive_question', {
                q: gameState.currentQuestion.q,
                options: gameState.currentQuestion.options
            });
        }
    });

    // उत्तर चेक गर्ने (पहिले उत्तर दिनेले मात्र अंक पाउने)
    socket.on('submit_answer', (answer) => {
        if (!gameState.teams[socket.id] || !gameState.currentQuestion) return;
        if (gameState.isAnswered) return; // यदि अघјै कोहीले सही उत्तर दिइसकेको छ भने रोक्ने

        const team = gameState.teams[socket.id];
        const correctAns = gameState.currentQuestion.correctAns;
        const givenAns = String(answer).trim().toLowerCase();
        
        // सहि उत्तर चेक गर्ने (अक्षर वा अप्सनको टेक्स्ट मिलेको आधारमा)
        const isCorrect = (givenAns === correctAns || String(answer).trim().toLowerCase() === correctAns);

        if (isCorrect) {
            gameState.isAnswered = true; // अब अरूलाई बन्द गर्ने
            team.score += gameState.settings.basePoints;
            const ref = gameState.currentQuestion.reference || "सहि उत्तर!";
            
            io.emit('answer_result', { 
                teamName: team.name, 
                isCorrect: true, 
                ref: ref,
                winnerId: socket.id 
            });
        } else {
            team.score += gameState.settings.penalty; // गलत भएमा नेगेटिभ मार्किङ
            socket.emit('wrong_answer_personal', { penalty: gameState.settings.penalty });
        }
        io.emit('update_scoreboard', gameState.teams);
    });

    socket.on('disconnect', () => {
        if (gameState.teams[socket.id]) {
            delete gameState.teams[socket.id];
            io.emit('update_scoreboard', gameState.teams);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 सर्भर पोर्ट ${PORT} मा चलिरहेको छ`);
});
