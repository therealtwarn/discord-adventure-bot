<?php
// Clean Discord Adventure Bot
// Deploy to Railway.app or Vercel for instant header support

// Configuration
$DISCORD_PUBLIC_KEY = 'dea357e01ffd2c26adaf0a4552f33e04f6010920d079ba00f81de64cf44519b9';
$COOLDOWN_SECONDS = 5400; // 1.5 hours

// Get Discord headers
$signature = $_SERVER['HTTP_X_SIGNATURE_ED25519'] ?? '';
$timestamp = $_SERVER['HTTP_X_SIGNATURE_TIMESTAMP'] ?? '';

// Verify we have the required headers
if (!$signature || !$timestamp) {
    http_response_code(401);
    die('Missing Discord headers');
}

// Read and verify the request
$body = file_get_contents('php://input');

if (!sodium_crypto_sign_verify_detached(
    hex2bin($signature),
    $timestamp . $body,
    hex2bin($DISCORD_PUBLIC_KEY)
)) {
    http_response_code(401);
    die('Invalid signature');
}

$payload = json_decode($body, true);

// Handle Discord ping
if ($payload['type'] === 1) {
    header('Content-Type: application/json');
    echo json_encode(['type' => 1]);
    exit;
}

// Handle /adventure command
if ($payload['type'] === 2 && $payload['data']['name'] === 'adventure') {
    
    // Immediate response to Discord
    header('Content-Type: application/json');
    echo json_encode(['type' => 5]); // Deferred response
    
    // Flush response
    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
    }
    
    // Get user ID
    $userId = $payload['member']['user']['id'] ?? $payload['user']['id'];
    
    // Simple cooldown check using file timestamps
    $cooldownFile = sys_get_temp_dir() . "/cool_$userId";
    if (file_exists($cooldownFile) && (time() - filemtime($cooldownFile)) < $COOLDOWN_SECONDS) {
        sendFollowUp($payload, "⏳ You're on cooldown! Try again later.");
        exit;
    }
    touch($cooldownFile);
    
    // Adventure logic
    $tier = random_int(1, 25);
    $reward = ($tier === 25) 
        ? (random_int(1, 100) <= 75 ? 1000 : 250)
        : random_int(50, 149);
    
    // Log wallet if provided
    $wallet = $payload['data']['options'][0]['value'] ?? '';
    if (preg_match('/^0x[a-fA-F0-9]{40}$/', $wallet)) {
        file_put_contents(
            __DIR__ . '/rewards.log',
            "$userId,$wallet,$reward," . date('c') . "\n",
            FILE_APPEND | LOCK_EX
        );
    }
    
    // Send result
    $message = "🎲 **Adventure Complete!**\n\nYou earned **{$reward} Sparks**! ⚡";
    if ($tier === 25) {
        $message .= "\n\n🌟 **LEGENDARY TIER!** 🌟";
    }
    
    sendFollowUp($payload, $message);
    exit;
}

http_response_code(400);
echo 'Unknown request';

function sendFollowUp($payload, $content) {
    $url = "https://discord.com/api/v10/webhooks/{$payload['application_id']}/{$payload['token']}/messages/@original";
    
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_CUSTOMREQUEST => 'PATCH',
        CURLOPT_POSTFIELDS => json_encode(['content' => $content]),
        CURLOPT_TIMEOUT => 10
    ]);
    
    curl_exec($ch);
    curl_close($ch);
}
?>
