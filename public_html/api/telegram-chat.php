<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

$messagesFile = __DIR__ . '/chat_messages.json';

// Создаём файл если его нет
if (!file_exists($messagesFile)) {
    file_put_contents($messagesFile, json_encode([
        ['user' => 'Система', 'text' => 'Добро пожаловать в чат!', 'timestamp' => time()]
    ]));
}

try {
    $action = $_GET['action'] ?? $_POST['action'] ?? '';

    if ($action === 'get_messages') {
        $messages = json_decode(file_get_contents($messagesFile), true) ?: [];
        echo json_encode($messages);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'send_message') {
        $user = $_POST['user'] ?? 'Гость';
        $text = $_POST['text'] ?? '';

        if (empty($text)) {
            throw new Exception('Пустое сообщение');
        }

        $messages = json_decode(file_get_contents($messagesFile), true) ?: [];
        $messages[] = [
            'user' => $user,
            'text' => htmlspecialchars($text),
            'timestamp' => time()
        ];

        file_put_contents($messagesFile, json_encode($messages));
        echo json_encode(['success' => true]);
        exit;
    }

    throw new Exception('Неверный запрос');
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'error' => $e->getMessage(),
                     'success' => false
    ]);
}
?>
