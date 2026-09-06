import { useState, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker?url';
import './App.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// ---------- PDF EXTRACTION ----------
async function extractTextFromPDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str).join(" ");
    fullText += pageText + "\n\n";
  }
  return fullText;
}

// ---------- IMAGE TEXT EXTRACTION ----------
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function extractTextFromImage(file) {
  const base64 = await fileToBase64(file);
  const response = await fetch("http://localhost:3001/extract-image-text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64: base64, mimeType: file.type })
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Failed to extract text from image");
  }
  return data.text;
}

// ---------- AI NOTE GENERATION ----------
async function generateNotes(concept, style) {
  const response = await fetch("http://localhost:3001/generate-notes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ concept, style })
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Failed to generate notes");
  }
  return data.text;
}

function App() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const [voices, setVoices] = useState([]);
  const [selectedVoiceIndex, setSelectedVoiceIndex] = useState(0);

  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem('readoutHistory');
    return saved ? JSON.parse(saved) : [];
  });

  const [concept, setConcept] = useState("");
  const [noteStyle, setNoteStyle] = useState("brief");
  const [notes, setNotes] = useState("");
  const [notesLoading, setNotesLoading] = useState(false);

  useEffect(() => {
    const loadVoices = () => {
      const available = speechSynthesis.getVoices();
      setVoices(available);
      const preferredIndex = available.findIndex(
        v => v.name.includes("Google") || v.name.includes("Natural")
      );
      setSelectedVoiceIndex(preferredIndex !== -1 ? preferredIndex : 0);
    };

    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    try {
      const extractedText = await extractTextFromPDF(file);
      setText(extractedText);
    } catch (err) {
      console.error("Failed to read PDF:", err);
      alert("Something went wrong reading that PDF.");
    }
    setLoading(false);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    try {
      const extractedText = await extractTextFromImage(file);
      setText(extractedText);
    } catch (err) {
      console.error("Failed to read image:", err);
      alert("Something went wrong reading that image: " + err.message);
    }
    setLoading(false);
  };

  const speakText = (content) => {
    if (!content) return;
    speechSynthesis.cancel();

    const chunks = content.match(/[^.!?]+[.!?]+|\S+$/g) || [content];

    chunks.forEach((chunk) => {
      const utterance = new SpeechSynthesisUtterance(chunk.trim());
      if (voices[selectedVoiceIndex]) utterance.voice = voices[selectedVoiceIndex];
      speechSynthesis.speak(utterance);
    });

    saveToHistory(content);
  };

  const handleSpeakAll = () => {
    speakText(text);
  };

  const handleSpeakSelection = () => {
    const selectedText = window.getSelection().toString();
    if (!selectedText) {
      alert("Highlight some text first to read just that section.");
      return;
    }
    speakText(selectedText);
  };

  const handleStop = () => {
    speechSynthesis.cancel();
  };

  const saveToHistory = (content) => {
    const newEntry = {
      preview: content.slice(0, 100) + (content.length > 100 ? "..." : ""),
      fullText: content.length > 3000 ? content.slice(0, 3000) + "... [trimmed]" : content,
      date: new Date().toLocaleString()
    };

    const updatedHistory = [newEntry, ...history].slice(0, 20);

    setHistory(updatedHistory);

    try {
      localStorage.setItem('readoutHistory', JSON.stringify(updatedHistory));
    } catch (err) {
      console.error("Storage full, clearing oldest entries:", err);
      const trimmed = updatedHistory.slice(0, 5);
      setHistory(trimmed);
      localStorage.setItem('readoutHistory', JSON.stringify(trimmed));
    }
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('readoutHistory');
  };

  const handleGenerateNotes = async () => {
    if (!concept) return;
    setNotesLoading(true);
    try {
      const result = await generateNotes(concept, noteStyle);
      setNotes(result);
    } catch (err) {
      console.error("Failed to generate notes:", err);
      alert(err.message.includes("busy") || err.message.includes("Rate limit")
        ? "Gemini is busy right now — wait a minute and try again."
        : "Something went wrong generating notes.");
    }
    setNotesLoading(false);
  };

  return (
    <div className="app-container">
      <h1 className="app-title">🎙️ Voice Notes</h1>
      <p className="app-subtitle">Read anything aloud, generate notes, revisit your history</p>

      <div className="card">
        <h2>📖 Read Aloud</h2>

        <div className="upload-row">
          <label className="upload-label">📄 PDF <input type="file" accept="application/pdf" onChange={handleFileUpload} /></label>
          <label className="upload-label">🖼️ Image <input type="file" accept="image/*" onChange={handleImageUpload} /></label>
        </div>
        {loading && <p className="hint">Extracting text...</p>}

        <select value={selectedVoiceIndex} onChange={(e) => setSelectedVoiceIndex(Number(e.target.value))}>
          {voices.map((v, i) => (
            <option key={i} value={i}>{v.name} ({v.lang})</option>
          ))}
        </select>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste a paragraph, or upload a PDF/image above..."
          rows={10}
        />

        <div className="btn-row">
          <button onClick={handleSpeakAll}>🔊 Read All</button>
          <button className="secondary" onClick={handleSpeakSelection}>🔊 Read Selected</button>
          <button className="secondary" onClick={handleStop}>⏹️ Stop</button>
        </div>
        <p className="hint">Tip: highlight text above, then click "Read Selected" to hear just that part.</p>
      </div>

      <div className="card">
        <h2>✨ Generate Notes</h2>
        <input
          type="text"
          value={concept}
          onChange={(e) => setConcept(e.target.value)}
          placeholder="Enter a concept, e.g. Partial Differentiation"
          style={{ width: "100%", marginBottom: "12px" }}
        />
        <select value={noteStyle} onChange={(e) => setNoteStyle(e.target.value)}>
          <option value="brief">Brief summary</option>
          <option value="detailed">Detailed with examples</option>
          <option value="exam">Exam-focused</option>
        </select>
        <div className="btn-row">
          <button onClick={handleGenerateNotes} disabled={notesLoading}>
            {notesLoading ? "Generating..." : "✨ Generate Notes"}
          </button>
        </div>

        {notes && (
          <div className="notes-output">
            <pre>{notes}</pre>
            <button className="secondary" onClick={() => speakText(notes)}>🔊 Read These Notes</button>
          </div>
        )}
      </div>

      <div className="card">
        <h2>📜 Previous Readouts</h2>
        {history.length === 0 && <p className="empty-state">Nothing here yet — your readouts will show up as you go.</p>}
        {history.length > 0 && <button className="secondary" onClick={clearHistory}>Clear History</button>}
        {history.map((entry, index) => (
          <div key={index} className="history-entry">
            <p className="history-date">{entry.date}</p>
            <p className="history-preview">{entry.preview}</p>
            <button className="secondary" onClick={() => speakText(entry.fullText)}>▶️ Replay</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;