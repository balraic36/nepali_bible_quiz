const socket = io();

socket.on('update_scoreboard', (teams) => {
    const sb = document.getElementById('scoreboard');
    sb.innerHTML = '';
    for(let id in teams) {
        sb.innerHTML += `<p><b>${teams[id].name}</b>: ${teams[id].score} अंक</p>`;
    }
});

function sendNextQuestion() {
    socket.emit('host_next_question');
}
