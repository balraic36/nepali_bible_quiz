const socket = io();

function registerTeam() {
    const name = document.getElementById('teamName').value;
    if(name) socket.emit('register_team', name);
}

socket.on('registration_success', () => {
    document.getElementById('register-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'block';
});

socket.on('update_scoreboard', (teams) => {
    const sb = document.getElementById('scoreboard');
    sb.innerHTML = '<b>स्कोरबोर्ड:</b> ';
    for(let id in teams) {
        sb.innerHTML += `<span style="margin-left:15px">🏆 ${teams[id].name}: ${teams[id].score}</span>`;
    }
});

socket.on('receive_question', (data) => {
    const qText = document.getElementById('question-text');
    const optionsContainer = document.getElementById('options-container');
    
    qText.innerHTML = '';
    optionsContainer.innerHTML = '';
    
    // Typewriter Effect
    let i = 0;
    const typeWriter = setInterval(() => {
        qText.innerHTML += data.q.charAt(i);
        i++;
        if (i >= data.q.length) {
            clearInterval(typeWriter);
            data.options.forEach(opt => {
                if(opt) {
                    const btn = document.createElement('button');
                    btn.innerText = opt;
                    btn.onclick = () => socket.emit('submit_answer', opt);
                    optionsContainer.appendChild(btn);
                }
            });
        }
    }, 30);
});

socket.on('answer_result', (data) => {
    const toast = document.getElementById('toast');
    if(data.isCorrect) {
        toast.innerHTML = `✅ ${data.teamName} को सही उत्तर! <br><small>${data.ref}</small>`;
        toast.className = "show correct";
    } else {
        toast.innerHTML = `❌ ${data.teamName} को गलत उत्तर!`;
        toast.className = "show wrong";
    }
    setTimeout(() => { toast.className = ""; }, 4000);
});
