import React, { useState, useEffect, useRef } from 'react';
import { Message, Role, Mood } from '../types';
import { sendMessageToGemini, generateSpeech, connectToLiveSession } from '../services/geminiService';
import { base64ToUint8Array, pcmToAudioBuffer, playAudio, createPcmBlob } from '../utils/audioUtils';
import { LiveServerMessage } from '@google/genai';

// Icons
const MicIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
);
const SendIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
);
const SpeakerIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
);
const WaveformIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 10v3"/><path d="M6 6v11"/><path d="M10 3v18"/><path d="M14 8v7"/><path d="M18 5v13"/><path d="M22 10v4"/></svg>
);
const StopIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
);

const getMoodColor = (mood?: Mood) => {
  switch (mood) {
    case Mood.CALM: return 'shadow-blue-900/50 border-blue-900 text-blue-100';
    case Mood.INTENSE: return 'shadow-red-600/50 border-red-600 text-red-100';
    case Mood.JOYFUL: return 'shadow-amber-500/50 border-amber-500 text-amber-100';
    case Mood.MELANCHOLIC: return 'shadow-purple-900/50 border-purple-900 text-purple-100';
    case Mood.MYSTERIOUS: return 'shadow-emerald-900/50 border-emerald-900 text-emerald-100';
    default: return 'shadow-zinc-800 border-zinc-800 text-gray-200';
  }
};

const getMoodGlow = (mood?: Mood) => {
  switch (mood) {
    case Mood.CALM: return 'from-blue-900/10 to-black';
    case Mood.INTENSE: return 'from-red-900/10 to-black';
    case Mood.JOYFUL: return 'from-amber-900/10 to-black';
    case Mood.MELANCHOLIC: return 'from-purple-900/10 to-black';
    case Mood.MYSTERIOUS: return 'from-emerald-900/10 to-black';
    default: return 'from-zinc-900/10 to-black';
  }
};

const getMoodLabel = (mood?: Mood) => {
  switch (mood) {
    case Mood.CALM: return 'VIBE: CHILL';
    case Mood.INTENSE: return 'VIBE: LOCKED IN';
    case Mood.JOYFUL: return 'VIBE: IMMACULATE';
    case Mood.MELANCHOLIC: return 'VIBE: DOWN BAD';
    case Mood.MYSTERIOUS: return 'VIBE: SUS';
    default: return 'VIBE: MID';
  }
};

export const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentMood, setCurrentMood] = useState<Mood>(Mood.NEUTRAL);
  const [isRecording, setIsRecording] = useState(false); // For old webkit speech
  const [isLiveActive, setIsLiveActive] = useState(false); // For new Live API
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const liveInputContextRef = useRef<AudioContext | null>(null);
  const recognitionRef = useRef<any>(null);
  
  // Live API Refs
  const liveSessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef<number>(0);
  const liveAudioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  // Live Transcription Buffer
  const currentInputTranscription = useRef('');
  const currentOutputTranscription = useRef('');

  // Load persistence
  useEffect(() => {
    const saved = localStorage.getItem('crimson_history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setMessages(parsed);
        if (parsed.length > 0) {
            const lastModelMsg = [...parsed].reverse().find((m: Message) => m.role === Role.MODEL);
            if (lastModelMsg?.mood) setCurrentMood(lastModelMsg.mood);
        }
      } catch (e) { console.error("History load error", e); }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('crimson_history', JSON.stringify(messages));
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // ----- Standard Interaction Logic -----

  // Text-to-Speech (Speaker Button)
  const handleSpeakMessage = async (text: string) => {
    if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
    }
    if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();

    try {
        const b64Data = await generateSpeech(text);
        if (b64Data) {
            const bytes = base64ToUint8Array(b64Data);
            const buffer = pcmToAudioBuffer(bytes, audioContextRef.current);
            playAudio(buffer, audioContextRef.current);
        }
    } catch (e) {
        console.error("TTS Playback failed", e);
    }
  };

  // Webkit Speech (Legacy/Simple input)
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputValue(transcript);
        handleSend(transcript);
      };
      recognitionRef.current.onend = () => setIsRecording(false);
    }
  }, []);

  const toggleRecording = () => {
    if (isLiveActive) return; // Disable standard mic in Live mode
    if (!recognitionRef.current) return;
    if (isRecording) recognitionRef.current.stop();
    else {
      setIsRecording(true);
      recognitionRef.current.start();
    }
  };

  const handleSend = async (textOverride?: string) => {
    const text = textOverride || inputValue;
    if (!text.trim() || isLoading) return;

    setInputValue('');
    setIsLoading(true);

    const newUserMsg: Message = {
      id: Date.now().toString(),
      role: Role.USER,
      text: text,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, newUserMsg]);

    try {
      const response = await sendMessageToGemini(messages.concat(newUserMsg), text);
      const newModelMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: Role.MODEL,
        text: response.text,
        timestamp: Date.now(),
        mood: response.mood
      };
      setMessages(prev => [...prev, newModelMsg]);
      setCurrentMood(response.mood);
    } catch (error) {
      console.error("Send error", error);
    } finally {
      setIsLoading(false);
    }
  };

  // ----- Live API Logic -----

  const stopLiveSession = () => {
    // Close Session
    if (liveSessionRef.current) {
        try {
             // Try to close if method exists
             liveSessionRef.current.close && liveSessionRef.current.close();
        } catch(e) { console.log("Session close error", e); }
        liveSessionRef.current = null;
    }
    
    // Stop Microphone
    if (liveInputContextRef.current) {
        liveInputContextRef.current.close();
        liveInputContextRef.current = null;
    }

    // Stop all playing audio sources
    liveAudioSourcesRef.current.forEach(source => {
        try { source.stop(); } catch(e) {}
    });
    liveAudioSourcesRef.current.clear();
    
    setIsLiveActive(false);
  };

  const startLiveSession = async () => {
    if (isLiveActive) {
        stopLiveSession();
        return;
    }

    setIsLiveActive(true);

    try {
        // 1. Setup Audio Output Context
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
        }
        if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();
        nextStartTimeRef.current = audioContextRef.current.currentTime;

        // 2. Setup Audio Input (Microphone)
        liveInputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 16000});
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        const source = liveInputContextRef.current.createMediaStreamSource(stream);
        const scriptProcessor = liveInputContextRef.current.createScriptProcessor(4096, 1, 1);
        
        scriptProcessor.onaudioprocess = (e) => {
             if (!liveSessionRef.current) return;
             const inputData = e.inputBuffer.getChannelData(0);
             const pcmBlob = createPcmBlob(inputData);
             liveSessionRef.current.sendRealtimeInput({ media: pcmBlob });
        };

        source.connect(scriptProcessor);
        scriptProcessor.connect(liveInputContextRef.current.destination);

        // 3. Connect to Gemini Live
        const session = await connectToLiveSession({
            onOpen: () => console.log("Live Session Opened"),
            onClose: () => stopLiveSession(),
            onError: (e) => {
                console.error("Live Error", e);
                stopLiveSession();
            },
            onMessage: async (msg: LiveServerMessage) => {
                // Handle Audio Output
                const b64Audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                if (b64Audio && audioContextRef.current) {
                    const bytes = base64ToUint8Array(b64Audio);
                    const buffer = pcmToAudioBuffer(bytes, audioContextRef.current);
                    
                    nextStartTimeRef.current = Math.max(nextStartTimeRef.current, audioContextRef.current.currentTime);
                    
                    const source = audioContextRef.current.createBufferSource();
                    source.buffer = buffer;
                    source.connect(audioContextRef.current.destination);
                    source.onended = () => liveAudioSourcesRef.current.delete(source);
                    source.start(nextStartTimeRef.current);
                    
                    liveAudioSourcesRef.current.add(source);
                    nextStartTimeRef.current += buffer.duration;
                }

                // Handle Transcription (Text Persistence)
                if (msg.serverContent?.outputTranscription?.text) {
                    currentOutputTranscription.current += msg.serverContent.outputTranscription.text;
                }
                if (msg.serverContent?.inputTranscription?.text) {
                    currentInputTranscription.current += msg.serverContent.inputTranscription.text;
                }

                if (msg.serverContent?.turnComplete) {
                     // Flush transcription to chat history
                     if (currentInputTranscription.current.trim()) {
                         setMessages(prev => [...prev, {
                             id: Date.now().toString(),
                             role: Role.USER,
                             text: currentInputTranscription.current,
                             timestamp: Date.now()
                         }]);
                         currentInputTranscription.current = '';
                     }
                     if (currentOutputTranscription.current.trim()) {
                         setMessages(prev => [...prev, {
                             id: (Date.now()+1).toString(),
                             role: Role.MODEL,
                             text: currentOutputTranscription.current,
                             timestamp: Date.now(),
                             mood: Mood.MYSTERIOUS // Default mood for voice, or parse if possible
                         }]);
                         currentOutputTranscription.current = '';
                     }
                }
                
                // Handle Interruption
                if (msg.serverContent?.interrupted) {
                     liveAudioSourcesRef.current.forEach(s => {
                         try { s.stop(); } catch(e) {}
                     });
                     liveAudioSourcesRef.current.clear();
                     nextStartTimeRef.current = 0;
                     currentInputTranscription.current = '';
                     currentOutputTranscription.current = '';
                }
            }
        });

        liveSessionRef.current = session;

    } catch (e) {
        console.error("Failed to start live session", e);
        stopLiveSession(); // Cleanup any partial setup
    }
  };


  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={`relative flex flex-col h-screen w-full bg-black overflow-hidden transition-colors duration-1000 bg-gradient-to-br ${getMoodGlow(currentMood)}`}>
      
      {/* Header */}
      <header className="p-4 border-b border-white/5 flex justify-between items-center z-20 backdrop-blur-md bg-black/40">
        <h2 className="font-display text-2xl tracking-widest text-red-500 drop-shadow-[0_0_8px_rgba(220,38,38,0.8)]">
          CRIMSON
        </h2>
        <div className="flex items-center gap-4">
            <button 
                onClick={() => setMessages([])} 
                className="text-xs text-zinc-500 hover:text-red-400 uppercase tracking-widest transition-colors"
            >
                Clear Memory
            </button>
            
            {/* Live Mode Toggle */}
            <button 
                onClick={startLiveSession}
                className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-300 ${
                    isLiveActive 
                    ? 'bg-red-900/40 border-red-500 text-red-100 shadow-[0_0_20px_rgba(220,38,38,0.6)] animate-pulse'
                    : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-red-400 hover:border-red-900'
                }`}
            >
                {isLiveActive ? <StopIcon /> : <WaveformIcon />}
                <span className="text-xs uppercase tracking-widest font-bold">
                    {isLiveActive ? "End Session" : "Commune"}
                </span>
            </button>
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 z-10 relative">
        {/* Live Session Overlay/Indicator */}
        {isLiveActive && (
             <div className="sticky top-0 z-30 w-full flex justify-center mb-6">
                 <div className="bg-red-900/80 backdrop-blur-md border border-red-500/50 px-6 py-2 rounded-full flex items-center gap-3 shadow-[0_0_30px_rgba(220,38,38,0.3)]">
                     <span className="w-2 h-2 bg-red-400 rounded-full animate-ping"/>
                     <span className="text-red-100 text-xs tracking-widest uppercase">Live Connection Active</span>
                 </div>
             </div>
        )}

        {messages.length === 0 && !isLiveActive && (
          <div className="flex flex-col items-center justify-center h-full text-zinc-700 opacity-50 select-none">
            <p className="font-display text-4xl tracking-[0.5em] mb-4">SILENCE</p>
            <p className="font-light tracking-wide text-sm">Speak to break the void.</p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex w-full ${msg.role === Role.USER ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] md:max-w-[70%] p-4 md:p-6 rounded-2xl relative backdrop-blur-sm border transition-all duration-500 group
                ${msg.role === Role.USER 
                  ? 'bg-zinc-900/60 border-zinc-700 text-zinc-200 rounded-tr-sm' 
                  : `bg-black/80 rounded-tl-sm ${getMoodColor(msg.mood)}`
                }
              `}
            >
               {msg.role === Role.MODEL && msg.mood && (
                   <div className={`absolute -top-1 -left-1 w-2 h-2 rounded-full animate-pulse ${getMoodColor(msg.mood).split(' ')[1].replace('border-', 'bg-')}`} />
               )}
               
               {/* Speaker Option Button */}
               {msg.role === Role.MODEL && (
                   <button 
                     onClick={() => handleSpeakMessage(msg.text)}
                     className="absolute -top-3 -right-3 p-1.5 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-500 opacity-0 group-hover:opacity-100 hover:text-red-400 hover:border-red-500 transition-all shadow-lg"
                     title="Read Aloud"
                   >
                       <SpeakerIcon />
                   </button>
               )}

              <p className="whitespace-pre-wrap leading-relaxed text-sm md:text-base font-light">
                {msg.text}
              </p>
              <div className="mt-2 text-[10px] uppercase tracking-wider opacity-40 text-right">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
            <div className="flex justify-start w-full">
                <div className={`p-4 rounded-2xl bg-black/40 border border-zinc-800 text-red-500/50 flex items-center gap-2`}>
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}/>
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}/>
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}/>
                </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className={`p-4 md:p-6 z-20 backdrop-blur-xl bg-black/60 border-t border-white/5 transition-all duration-500 ${isLiveActive ? 'opacity-50 pointer-events-none grayscale' : 'opacity-100'}`}>
        <div className="max-w-4xl mx-auto relative flex items-center gap-4">
          <button
            onClick={toggleRecording}
            className={`p-3 rounded-full border transition-all duration-300 ${
              isRecording 
              ? 'bg-red-500/20 border-red-500 text-red-500 animate-pulse shadow-[0_0_15px_rgba(220,38,38,0.5)]' 
              : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <MicIcon />
          </button>
          
          <div className="flex-1 relative">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isLiveActive ? "Communing with the spirit..." : "Share your thoughts..."}
              rows={1}
              className="w-full bg-zinc-900/50 border border-zinc-800 text-zinc-200 p-4 pr-12 rounded-xl focus:outline-none focus:border-red-900/50 focus:bg-black transition-all resize-none overflow-hidden"
              style={{ minHeight: '56px' }}
            />
          </div>

          <button
            onClick={() => handleSend()}
            disabled={!inputValue.trim() || isLoading}
            className="p-3 bg-red-900/20 text-red-500 rounded-xl border border-red-900/50 hover:bg-red-900/40 hover:shadow-[0_0_15px_rgba(153,27,27,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <SendIcon />
          </button>
        </div>
        
        {/* Ambient Mood Status */}
        <div className="text-center mt-2">
            <span className={`text-[10px] tracking-[0.3em] uppercase opacity-30 ${getMoodColor(currentMood).split(' ')[2]}`}>
                {getMoodLabel(currentMood)}
            </span>
        </div>
      </div>
    </div>
  );
};