class AutoProxyMicTest {
    constructor() {
        this.ws = null;
        this.mediaRecorder = null;
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.lastNluResult = null;
        this.isRecording = false;
        
        // WebSocket URL
        // this.WEBSOCKET_URL = 'wss://partner-gateway.sktauto.ai/recognition';
        this.WEBSOCKET_URL = 'ws://localhost:8090/recognition';
        
        this.initializeElements();
        this.bindEvents();
    }

    initializeElements() {
        this.startBtn = document.getElementById('start-btn');
        this.stopBtn = document.getElementById('stop-btn');
        this.restartBtn = document.getElementById('restart-btn');
        this.metaBtn = document.getElementById('meta-btn');
        this.picklistBtn = document.getElementById('picklist-btn');
        this.connectionStatus = document.getElementById('connection-status');
        this.micStatus = document.getElementById('mic-status');
        this.output = document.getElementById('output');
        this.voiceLevelBar = document.getElementById('voice-level-bar');
        this.voiceLevelText = document.getElementById('voice-level-text');
    }

    bindEvents() {
        this.startBtn.addEventListener('click', () => this.startRecognition());
        this.stopBtn.addEventListener('click', () => this.stopRecognition());
        this.restartBtn.addEventListener('click', () => this.restart());
        this.metaBtn.addEventListener('click', () => this.sendRecognitionMeta());
        this.picklistBtn.addEventListener('click', () => this.sendPicklist());
    }

    log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.innerHTML = `<strong>[${timestamp}]</strong> ${message}`;
        
        this.output.appendChild(messageDiv);
        this.output.scrollTop = this.output.scrollHeight;
        
        console.log(`[${timestamp}] ${message}`);
    }

    updateConnectionStatus(status, isConnected) {
        this.connectionStatus.textContent = status;
        this.connectionStatus.className = `status ${isConnected ? 'connected' : 'disconnected'}`;
    }

    updateMicStatus(status, isActive) {
        this.micStatus.textContent = status;
        this.micStatus.className = `status ${isActive ? 'active' : 'inactive'}`;
    }

    updateVoiceLevel(level) {
        if (this.voiceLevelBar && this.voiceLevelText) {
            // 레벨을 0-100 범위로 정규화 (임계값 500 기준)
            const normalizedLevel = Math.min(100, (level / 500) * 100);
            this.voiceLevelBar.style.setProperty('--voice-level', `${normalizedLevel}%`);
            this.voiceLevelBar.style.setProperty('--voice-level-width', `${normalizedLevel}%`);
            this.voiceLevelText.textContent = Math.round(level);
        }
    }

    async startRecognition() {
        try {
            // 마이크 권한 요청 - Node.js 버전과 동일한 설정
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    sampleRate: 16000,  // 16kHz (Node.js 버전과 동일)
                    channelCount: 1,    // 모노
                    echoCancellation: false,  // 에코 캔슬레이션 비활성화
                    noiseSuppression: false,  // 노이즈 서프레션 비활성화
                    autoGainControl: false    // 자동 게인 컨트롤 비활성화
                } 
            });

            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 16000  // 16kHz로 강제 설정
            });
            
            // 오디오 컨텍스트가 일시정지 상태라면 재개
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
                this.log('오디오 컨텍스트 재개됨', 'info');
            }
            
            // AudioContext를 사용하여 PCM 데이터 수집
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 16000  // 16kHz로 강제 설정
            });
            
            // ScriptProcessorNode를 사용하여 원시 PCM 데이터 수집
            this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            
            this.microphone.connect(this.scriptProcessor);
            this.scriptProcessor.connect(this.audioContext.destination);
            
            this.stream = stream;
            this.log('마이크 연결 성공', 'success');
            
            // WebSocket 연결 후 오디오 스트리밍 시작
            this.connectWebSocket();
            
            this.isRecording = true;
            this.updateMicStatus('활성', true);
            this.startBtn.disabled = true;
            this.stopBtn.disabled = false;
            
            this.log('음성 인식이 시작되었습니다.', 'success');
            
        } catch (error) {
            this.log(`마이크 접근 오류: ${error.message}`, 'error');
        }
    }

    stopRecognition() {
        if (this.scriptProcessor) {
            this.scriptProcessor.disconnect();
            this.scriptProcessor = null;
        }
        
        if (this.microphone) {
            this.microphone.disconnect();
            this.microphone = null;
        }
        
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        if (this.ws) {
            this.ws.close();
        }
        
        this.isRecording = false;
        this.updateMicStatus('비활성', false);
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        this.picklistBtn.disabled = true;
        
        this.log('음성 인식이 중지되었습니다.', 'info');
    }

    connectWebSocket() {
        // URL에 BMW-Client-Id를 쿼리 파라미터로 추가
        const wsUrl = `${this.WEBSOCKET_URL}?BMW-Client-Id=testId123`;
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            this.updateConnectionStatus('연결됨', true);
            this.log('WebSocket 연결 성공, 마이크 시작', 'success');
            
            // WebSocket 연결 완료 후 오디오 스트리밍 시작 (Node.js 버전과 동일)
            this.startAudioStreaming();
        };
        
        this.ws.onmessage = (event) => {
            this.log(`서버 응답: ${event.data}`, 'info');
            
            try {
                const response = JSON.parse(event.data);
                
                // NLU 결과인지 확인하고 저장
                if (response.type === 'nlu' && response.result && response.result.intent) {
                    this.lastNluResult = response;
                    
                    // Nav_SetDestinationByContact인지 확인
                    if (response.result.intent.name === 'Nav_SetDestinationByContact') {
                        const contactIds = response.result.intent.slots.filter(slot => slot.Com_ContactID);
                        
                        if (contactIds.length > 1) {
                            this.log('여러 연락처가 발견되었습니다. "연락처 선택" 버튼을 눌러 picklist를 전송하세요.', 'info');
                            this.picklistBtn.disabled = false;
                        }
                    }
                }
            } catch (error) {
                this.log(`JSON 파싱 오류: ${error.message}`, 'error');
            }
        };
        
        this.ws.onerror = (error) => {
            this.log(`WebSocket 오류: ${error}`, 'error');
        };
        
        this.ws.onclose = () => {
            this.updateConnectionStatus('연결 안됨', false);
            this.log('WebSocket 연결 종료', 'info');
            this.lastNluResult = null;
        };
    }

    startAudioStreaming() {
        if (!this.isRecording || !this.scriptProcessor || !this.ws) {
            this.log('오디오 스트리밍 시작 실패: 필요한 컴포넌트가 없습니다', 'error');
            return;
        }
        
        let frameCount = 0;
        
        // ScriptProcessorNode 이벤트 핸들러 설정 (Node.js 버전과 동일)
        this.scriptProcessor.onaudioprocess = (event) => {
            if (!this.isRecording) return;
            
            const inputBuffer = event.inputBuffer;
            const inputData = inputBuffer.getChannelData(0); // 첫 번째 채널 (Float32Array)
            
            // Float32Array를 Int16Array로 변환 (16비트 PCM)
            const pcmData = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
                // Float32 (-1.0 ~ 1.0)를 Int16 (-32768 ~ 32767)로 변환
                pcmData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
            }
            
            // 오디오 레벨 계산
            const avgValue = pcmData.reduce((sum, val) => sum + Math.abs(val), 0) / pcmData.length;
            
            // 음성 레벨 표시기 업데이트
            this.updateVoiceLevel(avgValue);
            
            // WebSocket으로 PCM 데이터 전송 (Node.js 버전과 동일)
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(pcmData.buffer);
                
                frameCount++;
            }
        };
        
        this.log('PCM 오디오 데이터 스트리밍 시작', 'success');
    }
    


    restart() {
        this.log('재연결 중...', 'info');
        this.stopRecognition();
        setTimeout(() => {
            this.startRecognition();
        }, 1000);
    }

    sendRecognitionMeta() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const metaPayload = JSON.stringify({
                type: "recognitionmeta",
                groups: [
                    "Navigation",
                    "MyModesSet"
                ],
                location: {
                    latitude: "25.0000",
                    longitude: "-71.0000"
                }
            });

            this.ws.send(metaPayload);
            this.log(`recognitionmeta 전송: ${metaPayload}`, 'info');
        } else {
            this.log('WebSocket이 열려있지 않습니다. 연결 상태를 확인하세요.', 'error');
        }
    }

    sendPicklist() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN && this.lastNluResult) {
            // Nav_SetDestinationByContact이고 Com_ContactID가 2개 이상인지 확인
            if (this.lastNluResult.result.intent.name === 'Nav_SetDestinationByContact') {
                const contactIds = this.lastNluResult.result.intent.slots.filter(slot => slot.Com_ContactID);
                const contactNames = this.lastNluResult.result.intent.slots.filter(slot => slot.Com_ContactName);
                
                if (contactIds.length > 1) {
                    // picklist 생성
                    const picklist = contactIds.map((contactIdSlot, index) => {
                        const contactName = contactNames[index] || contactNames[0];
                        return {
                            id: contactIdSlot.Com_ContactID.value,
                            value: contactName.Com_ContactName.value
                        };
                    });

                    const metaPayload = JSON.stringify({
                        type: "recognitionmeta",
                        groups: [
                            "SelectBy"
                        ],
                        location: {
                            latitude: "25.0000",
                            longitude: "-71.0000"
                        },
                        picklist: picklist
                    });

                    this.ws.send(metaPayload);
                    this.log(`연락처 선택 recognitionmeta 전송: ${metaPayload}`, 'info');
                } else {
                    this.log('선택할 연락처가 2개 이상이 아닙니다.', 'error');
                }
            } else {
                this.log('Nav_SetDestinationByContact 결과가 아닙니다.', 'error');
            }
        } else {
            this.log('WebSocket이 열려있지 않거나 NLU 결과가 없습니다.', 'error');
        }
    }
}

// 애플리케이션 초기화
document.addEventListener('DOMContentLoaded', () => {
    new AutoProxyMicTest();
});
