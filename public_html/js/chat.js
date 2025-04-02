
document.addEventListener('DOMContentLoaded', function() {
    const chatMessages = document.getElementById('chat-messages');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const tgConnectBtn = document.getElementById('tg-connect');

    let isTelegramConnected = false;
    let userName = 'Гость';

    // Загрузка сообщений при загрузке документа
    loadMessages();

    // Загрузка сообщений
    function loadMessages() {
        fetch('api/telegram-chat.php?action=get_messages')
        .then(response => response.text().then(text => {
            try {
                return JSON.parse(text);
            } catch (e) {
                throw new Error(`Invalid JSON: ${text.substring(0, 100)}`);
            }
        }))
        .then(messages => {
            if (!Array.isArray(messages)) {
                throw new Error('Некорректный формат сообщений');
            }
            chatMessages.innerHTML = '';
            messages.forEach(msg => {
                addMessageToChat(msg.user, msg.text, new Date(msg.timestamp * 1000));
            });
        })
        .catch(error => {
            console.error('Ошибка:', error);
            addSystemMessage('Ошибка загрузки: ' + error.message);
        });
    }

    // Добавление сообщения в чат
    function addMessageToChat(user, text, timestamp) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';

        const userDiv = document.createElement('div');
        userDiv.className = 'message-user';
        userDiv.textContent = user;

        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        textDiv.textContent = text;

        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = formatTime(timestamp);

        messageDiv.appendChild(userDiv);
        messageDiv.appendChild(textDiv);
        messageDiv.appendChild(timeDiv);
        chatMessages.appendChild(messageDiv);
    }

    // Форматирование времени
    function formatTime(timestamp) {
        const options = { hour: '2-digit', minute: '2-digit', second: '2-digit' };
        return timestamp.toLocaleString('ru-RU', options);
    }

    // Добавление системного сообщения
    function addSystemMessage(text) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'system-message';
        messageDiv.textContent = text;
        chatMessages.appendChild(messageDiv);
    }

    // Отправка сообщения
    sendBtn.addEventListener('click', function() {
        const messageText = messageInput.value.trim();
        if (messageText) {
            sendMessage(userName, messageText);
            messageInput.value = ''; // Очистить поле ввода
        }
    });

    function sendMessage(user, text) {
        fetch('api/telegram-chat.php?action=send_message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user: user, text: text })
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                loadMessages(); // Обновляем сообщения после отправки
            } else {
                addSystemMessage('Ошибка при отправке сообщения: ' + result.error);
            }
        })
        .catch(error => {
            console.error('Ошибка:', error);
            addSystemMessage('Ошибка при отправке сообщения: ' + error.message);
        });
    }

    // Дополнительная логика, например, соединение с Telegram
    tgConnectBtn.addEventListener('click', function() {
        // Пример логики для подключения Telegram
        isTelegramConnected = !isTelegramConnected;
        tgConnectBtn.textContent = isTelegramConnected ? 'Отключиться от Telegram' : 'Подключиться к Telegram';
        addSystemMessage(isTelegramConnected ? 'Подключено к Telegram' : 'Отключено от Telegram');
    });
});
