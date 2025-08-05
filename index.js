const WebSocket = require('ws');
const record = require('node-record-lpcm16');
const readline = require('readline');

const WEBSOCKET_URL = 'wss://partner-gateway.sktauto.ai/recognition';

let ws = null;
let mic = null;

function initMic() {
  return record.start({
    sampleRateHertz: 16000,
    threshold: 0,
    verbose: false,
    recordProgram: 'rec',
    silence: '10.0',
  });
}

function startRecognition() {
  ws = new WebSocket(WEBSOCKET_URL, {
    headers: {
      'BMW-Client-Id': 'testId123',
    }
  });

  ws.on('open', () => {
    console.log('WebSocket 연결 성공, 녹음 시작');
    mic = initMic();
    mic.on('data', (data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });
    mic.on('error', (err) => {
      console.error('마이크 에러:', err);
    });
  });

  ws.on('message', (data) => {
    console.log('서버 응답:', data.toString());
  });

  ws.on('error', (error) => {
    console.error('WebSocket 오류:', error);
  });

  ws.on('close', () => {
    console.log('WebSocket 연결 종료');
    if (mic) {
      record.stop(); // 마이크 녹음 중지
      mic = null;
    }
  });
}

// 키 입력 감지하여 r 누르면 재시작
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("음성을 말하세요... (r을 누르면 재시작)");

startRecognition();

rl.on('line', (input) => {
  if (input.trim() === 'r') {
    console.log('재연결합니다...');
    if (ws) {
      ws.close();
    }
    // 잠시 후 재연결
    setTimeout(startRecognition, 1000);
  }
});

