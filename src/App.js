import React, { useState, useRef, useEffect } from 'react';
import './App.css';
import { convertToBackward } from './utils/hangulConverter';
import AdSense from './components/AdSense';

function App() {
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState(null);
  const [reversedAudio, setReversedAudio] = useState(null);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const streamRef = useRef(null);
  const recordedMimeTypeRef = useRef('');

  // 텍스트 변환 함수
  const handleConvert = () => {
    if (!inputText.trim()) {
      alert('텍스트를 입력해주세요.');
      return;
    }
    
    const converted = convertToBackward(inputText);
    setOutputText(converted);
  };

  // 음성 녹음 시작
  const startRecording = async () => {
    try {
      // 이전 녹음 정리
      if (recordedAudio) {
        URL.revokeObjectURL(recordedAudio);
        setRecordedAudio(null);
      }
      if (reversedAudio) {
        URL.revokeObjectURL(reversedAudio);
        setReversedAudio(null);
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];
      
      // 브라우저가 지원하는 MIME 타입 찾기
      const mimeTypes = ['audio/webm', 'audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/wav'];
      let selectedMimeType = '';
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }
      
      const mediaRecorder = new MediaRecorder(stream, selectedMimeType ? { mimeType: selectedMimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      
      // 실제 사용된 MIME 타입 저장
      recordedMimeTypeRef.current = mediaRecorder.mimeType || selectedMimeType || 'audio/webm';
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        // 모든 데이터가 수집될 때까지 약간 대기
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (audioChunksRef.current.length === 0) {
          setIsProcessing(false);
          alert('녹음된 데이터가 없습니다.');
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }
          return;
        }
        
        // MediaRecorder가 생성한 실제 MIME 타입 사용
        const actualMimeType = recordedMimeTypeRef.current;
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMimeType });
        
        // Blob 크기 확인
        if (audioBlob.size === 0) {
          setIsProcessing(false);
          alert('녹음된 오디오가 비어있습니다.');
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }
          return;
        }
        
        const audioUrl = URL.createObjectURL(audioBlob);
        setRecordedAudio(audioUrl);
        
        // 역재생 오디오 생성
        await createReversedAudio(audioBlob);
        
        // 스트림 정리
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };
      
      // timeslice를 설정하여 주기적으로 데이터 수집
      mediaRecorder.start(100);
      setIsRecording(true);
    } catch (error) {
      console.error('녹음 시작 실패:', error);
      alert('마이크 접근 권한이 필요합니다.');
    }
  };

  // 음성 녹음 중지
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessing(true);
    }
  };

  // 역재생 오디오 생성
  const createReversedAudio = async (audioBlob) => {
    try {
      // 이전 AudioContext 정리
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try {
          await audioContextRef.current.close();
        } catch (e) {
          // 이미 닫혔거나 닫을 수 없는 경우 무시
        }
      }
      
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;
      
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const reversedBuffer = audioContext.createBuffer(
        audioBuffer.numberOfChannels,
        audioBuffer.length,
        audioBuffer.sampleRate
      );
      
      // 각 채널을 역전
      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const channelData = audioBuffer.getChannelData(channel);
        const reversedData = reversedBuffer.getChannelData(channel);
        
        for (let i = 0; i < channelData.length; i++) {
          reversedData[i] = channelData[channelData.length - 1 - i];
        }
      }
      
      // AudioBuffer를 Blob으로 변환
      const wav = audioBufferToWav(reversedBuffer);
      const reversedBlob = new Blob([wav], { type: 'audio/wav' });
      const reversedUrl = URL.createObjectURL(reversedBlob);
      
      setReversedAudio(reversedUrl);
      setIsProcessing(false);
    } catch (error) {
      console.error('역재생 오디오 생성 실패:', error);
      setIsProcessing(false);
      alert('오디오 처리 중 오류가 발생했습니다.');
    }
  };

  // AudioBuffer를 WAV로 변환
  const audioBufferToWav = (buffer) => {
    const length = buffer.length;
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
    const view = new DataView(arrayBuffer);
    const channels = [];
    let offset = 0;
    let pos = 0;

    // WAV 헤더 작성
    const writeString = (str) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(pos + i, str.charCodeAt(i));
      }
      pos += str.length;
    };

    writeString('RIFF');
    view.setUint32(pos, 36 + length * numberOfChannels * 2, true);
    pos += 4;
    writeString('WAVE');
    writeString('fmt ');
    view.setUint32(pos, 16, true);
    pos += 4;
    view.setUint16(pos, 1, true);
    pos += 2;
    view.setUint16(pos, numberOfChannels, true);
    pos += 2;
    view.setUint32(pos, sampleRate, true);
    pos += 4;
    view.setUint32(pos, sampleRate * numberOfChannels * 2, true);
    pos += 4;
    view.setUint16(pos, numberOfChannels * 2, true);
    pos += 2;
    view.setUint16(pos, 16, true);
    pos += 2;
    writeString('data');
    view.setUint32(pos, length * numberOfChannels * 2, true);
    pos += 4;

    // 채널 데이터 작성
    for (let i = 0; i < numberOfChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

    while (pos < arrayBuffer.byteLength) {
      for (let i = 0; i < numberOfChannels; i++) {
        let sample = Math.max(-1, Math.min(1, channels[i][offset]));
        sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(pos, sample, true);
        pos += 2;
      }
      offset++;
    }

    return arrayBuffer;
  };

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      // AudioContext 정리
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {
          // 닫기 실패 시 무시
        });
      }
      // 스트림 정리
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      // 오디오 URL 정리
      if (recordedAudio) {
        URL.revokeObjectURL(recordedAudio);
      }
      if (reversedAudio) {
        URL.revokeObjectURL(reversedAudio);
      }
    };
  }, [recordedAudio, reversedAudio]);
  
  // 녹음 중지 시 스트림 정리
  useEffect(() => {
    if (!isRecording && streamRef.current) {
      // 약간의 지연 후 정리 (onstop 이벤트가 완료되도록)
      const timer = setTimeout(() => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => {
            if (track.readyState === 'live') {
              track.stop();
            }
          });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isRecording]);

  return (
    <div className="app">
      <div className="header">
        <h1>한국어 역재생 발음 생성기</h1>
        <p>한글 텍스트를 역재생 발음으로 변환하거나 음성을 녹음하여 역재생하세요</p>
      </div>
      
      {/* 상단 광고 영역 */}
      <AdSense 
        adSlot="" 
        className="ad-top"
        style={{ margin: '20px auto', maxWidth: '800px' }}
      />
      
      <div className="container">
        <div className="input-section">
          <label htmlFor="text-input">한글 텍스트 입력</label>
          <input
            id="text-input"
            type="text"
            className="text-input"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="예: 안녕하세요"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleConvert();
              }
            }}
          />
        </div>

        <div className="button-group">
          <button className="btn btn-primary" onClick={handleConvert}>
            변환하기
          </button>
          <button
            className="btn btn-secondary"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
          >
            {isRecording ? '녹음 중지' : '음성 녹음'}
          </button>
        </div>

        {(isRecording || isProcessing) && (
          <div className={`recording-status ${isRecording ? 'recording' : 'processing'}`}>
            {isRecording ? '🔴 녹음 중...' : '⏳ 처리 중...'}
          </div>
        )}

        {/* 콘텐츠 사이 광고 영역 */}
        <AdSense 
          adSlot="" 
          className="ad-inline"
          style={{ margin: '30px 0' }}
        />

        <div className="output-section">
          <label htmlFor="output-text">변환된 역재생 발음</label>
          <div id="output-text" className="output-text">
            {outputText || '(변환 결과가 여기에 표시됩니다)'}
          </div>
        </div>

        {(recordedAudio || reversedAudio) && (
          <div className="audio-controls">
            {recordedAudio && (
              <div>
                <p>원본 녹음</p>
                <audio 
                  controls 
                  preload="auto"
                  key={recordedAudio}
                >
                  <source src={recordedAudio} type={recordedMimeTypeRef.current || 'audio/webm'} />
                  브라우저가 오디오 재생을 지원하지 않습니다.
                </audio>
              </div>
            )}
            {reversedAudio && (
              <div>
                <p>역재생</p>
                <audio 
                  controls 
                  preload="auto"
                  key={reversedAudio}
                >
                  <source src={reversedAudio} type="audio/wav" />
                  브라우저가 오디오 재생을 지원하지 않습니다.
                </audio>
              </div>
            )}
          </div>
        )}

        {/* 오디오 컨트롤 아래 광고 영역 */}
        {(recordedAudio || reversedAudio) && (
          <AdSense 
            adSlot="" 
            className="ad-after-audio"
            style={{ margin: '30px 0' }}
          />
        )}
      </div>
      
      {/* 푸터 위 광고 영역 */}
      <AdSense 
        adSlot="" 
        className="ad-bottom"
        style={{ margin: '20px auto', maxWidth: '800px' }}
      />
      
      <footer className="footer">
        <p>© 2025 Cheolwoon Park. All rights reserved.</p>
        <p className="subtitle">한국어 역재생 발음 생성기</p>
      </footer>
    </div>
  );
}

export default App;

