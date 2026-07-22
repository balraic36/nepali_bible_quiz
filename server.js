const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const xlsx = require('xlsx');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// एक्सेल फाइलबाट प्रश्नहरू तान्ने (Load Questions)
let questionPool = [];
try {
    const workbook = xlsx.readFile('./data/बाइबल_NNRV_Bible_Questions_Master.xlsx');
    const sheet_name_list = workbook.SheetNames;
    questionPool = xlsx.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]]);
    console.log(`✅ ${questionPool.length} वटा प्रश्नहरू लोड भए!`);
} catch (err) {
    console.error("❌ एक्सेल फाइल भेटिएन वा पढ्न सकिएन!", err);
}

// Game State
let gameState = {
    teams: {},
    currentQuestionIndex: -1,
    currentQuestion: null,
    status: 'waiting',
    settings: { basePoints: 10, penalty: -2 }
};

io.on('connection', (socket) => {
    console.log(`नयाँ डिभाइस जोडियो: ${socket.id}`);

    // खेलाडी दर्ता
    socket.on('register_team', (teamName) => {
        gameState.teams[socket.id] = { id: socket.id, name: teamName, score: 0 };
        io.emit('update_scoreboard', gameState.teams);
        socket.emit('registration_success', socket.id);
    });

    // होस्टले नयाँ प्रश्न पठाउँदा
    socket.on('host_next_question', () => {
        gameState.currentQuestionIndex++;
        if (gameState.currentQuestionIndex < questionPool.length) {
            gameState.currentQuestion = questionPool[gameState.currentQuestionIndex];
            gameState.status = 'reading';
            io.emit('receive_question', {
                q: gameState.currentQuestion.Question_Text,
                options: [
                    gameState.currentQuestion.Option_A, 
                    gameState.currentQuestion.Option_B, 
                    gameState.currentQuestion.Option_C, 
                    gameState.currentQuestion.Option_D
                ]
            });
        }
    });

    // उत्तर चेक गर्ने
    socket.on('submit_answer', (answer) => {
        if (!gameState.teams[socket.id]) return;
        const team = gameState.teams[socket.id];
        const isCorrect = answer === gameState.currentQuestion.Correct_Answer;

        if (isCorrect) {
            team.score += gameState.settings.basePoints;
            const ref = `${gameState.currentQuestion.Book} ${gameState.currentQuestion.Chapter}:${gameState.currentQuestion.Verse}`;
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
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 सर्भर पोर्ट ${PORT} मा चलिरहेको छ`);
});
